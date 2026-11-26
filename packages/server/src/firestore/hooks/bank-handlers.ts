/**
 * AFTER INSERT handlers of the raw bank and card tables (the `insert_*_transaction_handler`
 * functions): file the raw row in `transactions_raw_list`, find the account and its owner, match or
 * create the charge, and create the transaction.
 *
 * Each handler is a statement-by-statement port of its PL/pgSQL function (the bodies are in
 * `scripts/firestore/reference/schema.sql`; `bank-handlers.sql` there mislabels two of them and
 * lacks the amex and isracard ones). Triggers run as the invoker, so their writes go through
 * `tx.insert` with RLS applied, as in Postgres. `scripts/firestore/verify-bank-handlers.ts` proves
 * them against Postgres.
 *
 * Postgres semantics kept on purpose:
 * - `SELECT ... INTO` takes the first row a lookup returns and leaves NULLs when none does;
 * - three-valued logic in IF / WHERE (NULL is not true), `concat` (NULL as '') vs `concat_ws`
 *   (NULL skipped), `TRIM` cutting spaces only, `LEFT`/`RIGHT` with negative lengths;
 * - numeric math on exact decimal strings, with Postgres's result scales;
 * - RAISE EXCEPTION is SQLSTATE P0001; a failed cast is 22P02 / 22008; two handlers reference
 *   something that does not exist on their error path (`SQLERRM` outside a handler, a missing
 *   NEW field) and so fail with 42703 there, which is kept;
 * - the RLS WITH CHECK of an INSERT runs before its NOT NULL checks (`insertAsInvoker`).
 */
import { enums, tableInfo, type AnyRow } from '../catalog.js';
import { DbError, rlsViolation } from '../errors.js';
import { Numeric } from '../numeric.js';
import { concat, concatWs, like, timestampToDate } from '../sql-helpers.js';
import type { Transaction } from '../transaction.js';
import { toDateString, type StoredRow } from '../values.js';

export type InsertHandler = (tx: Transaction, row: StoredRow) => Promise<void>;

// ---------------------------------------------------------------------------------------------
// SQL building blocks
// ---------------------------------------------------------------------------------------------

/** Three-valued boolean: SQL's TRUE / FALSE / NULL. */
type Bool3 = boolean | null;

const and3 = (a: Bool3, b: Bool3): Bool3 =>
  a === false || b === false ? false : a === null || b === null ? null : true;
const or3 = (a: Bool3, b: Bool3): Bool3 =>
  a === true || b === true ? true : a === null || b === null ? null : false;
const not3 = (a: Bool3): Bool3 => (a === null ? null : !a);

/** `x IN (list)` / `x NOT IN (list)` for a non-null list without NULLs. */
const in3 = (value: unknown, list: readonly unknown[]): Bool3 =>
  value == null ? null : list.includes(value);

/** `a = b` on numerics. */
const numEq = (a: unknown, b: unknown): Bool3 =>
  a == null || b == null ? null : Numeric.of(a as string).eq(b as string);

/** `a <> b` on numerics / integers. */
const numNe = (a: unknown, b: unknown): Bool3 => not3(numEq(a, b));

const numeric = (value: unknown): Numeric | null =>
  value == null ? null : Numeric.of(typeof value === 'number' ? String(value) : (value as string));

/** `x * -1` */
const negate = (value: unknown): string | null => numeric(value)?.mul(-1).toString() ?? null;

/** `x::text` for scalars as Postgres prints them. */
const text = (value: unknown): string | null => (value == null ? null : String(value));

/** `TRIM(x)`: spaces only, as `btrim(x, ' ')`. */
const trim = (value: string | null): string | null =>
  value == null ? null : value.replace(/^ +| +$/g, '');

const nullif = (value: string | null, other: string): string | null =>
  value === other ? null : value;

/** `LEFT(s, n)` in characters; a negative n drops |n| characters from the end. */
function left(value: string, n: number): string {
  const chars = [...value];
  return (n >= 0 ? chars.slice(0, n) : chars.slice(0, Math.max(0, chars.length + n))).join('');
}

/** `RIGHT(s, n)` in characters; a negative n drops |n| characters from the start. */
function right(value: string, n: number): string {
  const chars = [...value];
  return (
    n >= 0 ? chars.slice(Math.max(0, chars.length - n)) : chars.slice(Math.min(chars.length, -n))
  ).join('');
}

const length = (value: string): number => [...value].length;

/** `text::numeric` (numeric_in). */
function numericIn(value: string): Numeric {
  try {
    return Numeric.parse(value);
  } catch {
    throw new DbError(`invalid input syntax for type numeric: "${value}"`, '22P02');
  }
}

/** `text::accounter_schema.<enum>` */
function castEnum(type: string, value: unknown): string | null {
  if (value == null) return null;
  const label = String(value);
  if (!enums[type]?.includes(label)) {
    throw new DbError(`invalid input value for enum accounter_schema.${type}: "${label}"`, '22P02');
  }
  return label;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

function validDate(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

const formatDate = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;

/**
 * `to_date(s, 'DD/MM/YYYY')`: leading spaces skipped, any one non-digit as each separator, 1-2
 * digit day and month, a year of any length, trailing text ignored, ranges checked (22008).
 */
function toDateDMY(value: unknown): string | null {
  if (value == null) return null;
  const input = String(value);
  if (input.trim() === '') return '0001-01-01 BC'; // what Postgres makes of an empty string
  const match = /^\s*(\d{1,2})\D(\d{1,2})\D(\d+)/.exec(input);
  const outOfRange = () => new DbError(`date/time field value out of range: "${input}"`, '22008');
  if (!match) throw outOfRange();
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!validDate(year, month, day)) throw outOfRange();
  return formatDate(year, month, day);
}

/** `text::date` for the ISO forms the scrapers produce (`YYYY-MM-DD[T| ]...`, `YYYYMMDD`). */
function textToDate(value: unknown): string | null {
  if (value == null) return null;
  const input = String(value).trim();
  const match = /^(\d{4})-?(\d{2})-?(\d{2})(?:$|[T\s])/.exec(input);
  if (!match) throw new DbError(`invalid input syntax for type date: "${input}"`, '22007');
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!validDate(year, month, day)) {
    throw new DbError(`date/time field value out of range: "${input}"`, '22008');
  }
  return formatDate(year, month, day);
}

/** `date + time` → timestamp without time zone (a local-time `Date`, as pg parses one). */
function dateplusTime(date: unknown, time: unknown): Date | null {
  if (date == null || time == null) return null;
  const [y, m, d] = toDateString(date).split('-').map(Number) as [number, number, number];
  const [hh, mm, rest = '0'] = String(time).split(':');
  const seconds = Number(rest);
  const whole = Math.floor(seconds);
  return new Date(y, m - 1, d, Number(hh), Number(mm), whole, Math.round((seconds - whole) * 1000));
}

/** RAISE EXCEPTION: SQLSTATE P0001; `%` prints NULL as `<NULL>`. */
function raise(message: string, ...args: unknown[]): DbError {
  let i = 0;
  const formatted = message.replace(/%/g, () => {
    const arg = args[i++];
    return arg == null ? '<NULL>' : arg instanceof Error ? arg.message : String(arg);
  });
  return new DbError(formatted, 'P0001');
}

// ---------------------------------------------------------------------------------------------
// Statements every handler runs
// ---------------------------------------------------------------------------------------------

/**
 * An INSERT as the invoker. Postgres checks the RLS WITH CHECK policy before the row's NOT NULL
 * constraints, so a NULL or foreign owner is 42501 even when another column is NULL too.
 */
async function insertAsInvoker(tx: Transaction, table: string, values: AnyRow): Promise<StoredRow> {
  const info = tableInfo(table);
  if (info.tenancy === 'owner') {
    const owner = values[info.ownerColumn!];
    if (owner == null || !tx.ctx.businessId || owner !== tx.ctx.businessId) {
      throw rlsViolation(table);
    }
  }
  return (await tx.insert(table, values))!;
}

/** `INSERT INTO transactions_raw_list (<column>) VALUES (NEW.id) RETURNING id INTO merged_id` */
async function fileRawRow(tx: Transaction, column: string, rawId: unknown): Promise<string> {
  const row = await insertAsInvoker(tx, 'transactions_raw_list', { [column]: rawId });
  return row.id as string;
}

/**
 * `SELECT id, owner INTO account_id_var, owner_id_var FROM financial_accounts
 *  WHERE account_number = $1 [AND type = $2]`
 */
async function findAccount(
  tx: Transaction,
  accountNumber: string | null,
  type?: string,
): Promise<{ accountId: string | null; ownerId: string | null }> {
  if (accountNumber == null) return { accountId: null, ownerId: null };
  const rows = await tx.lookup('financial_accounts', ['account_number'], [accountNumber]);
  const row = rows.find(r => type === undefined || r.type === type);
  return {
    accountId: (row?.id as string | undefined) ?? null,
    ownerId: (row?.owner as string | undefined) ?? null,
  };
}

/** `INSERT INTO charges (owner_id[, type]) VALUES (owner_id_var[, type]) RETURNING id` */
async function createCharge(
  tx: Transaction,
  ownerId: string | null,
  type?: string | null,
): Promise<string> {
  const values: AnyRow = { owner_id: ownerId };
  if (type !== undefined) values.type = type;
  const row = await insertAsInvoker(tx, 'charges', values);
  return row.id as string;
}

/** `INSERT INTO transactions (<the keys of values>) VALUES (...)` */
async function createTransaction(tx: Transaction, values: AnyRow): Promise<void> {
  await insertAsInvoker(tx, 'transactions', values);
}

/**
 * The poalim charge match: the charge of an already-filed transaction whose raw row is one of
 * `candidates` (`s`), joined as
 *   LEFT JOIN transactions_raw_list tr ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
 *   LEFT JOIN transactions t ON tr.id = t.source_id
 *   WHERE t.charge_id IS NOT NULL [AND t.owner_id = owner_id_var]
 * First match, as `SELECT ... INTO` takes the first row.
 */
async function chargeOfFiledRow(
  tx: Transaction,
  candidates: readonly StoredRow[],
  ownerId: string | null | undefined,
): Promise<string | null> {
  for (const s of candidates) {
    const filed = [
      ...(await tx.lookup('transactions_raw_list', ['poalim_ils_id'], [s.id])),
      ...(await tx.lookup('transactions_raw_list', ['poalim_foreign_id'], [s.id])),
    ].filter(tr => (tr.poalim_ils_id ?? tr.poalim_foreign_id) === s.id);
    for (const tr of new Set(filed)) {
      for (const t of await tx.lookup('transactions', ['source_id'], [tr.id])) {
        if (t.charge_id == null) continue;
        if (ownerId !== undefined && (ownerId === null || t.owner_id !== ownerId)) continue;
        return t.charge_id as string;
      }
    }
  }
  return null;
}

/** `CASE WHEN contra_account_number <> 0 THEN concat(bank, '-', branch, '-', account) ELSE NULL END` */
const poalimCounterAccount = (row: StoredRow): string | null =>
  numNe(row.contra_account_number, 0) === true
    ? concat(row.contra_bank_number, '-', row.contra_branch_number, '-', row.contra_account_number)
    : null;

/** `CASE WHEN event_activity_type_code = 2 THEN event_amount * -1 ELSE event_amount END` */
const poalimAmount = (row: StoredRow): string | null =>
  numEq(row.event_activity_type_code, 2) === true
    ? negate(row.event_amount)
    : text(row.event_amount);

// ---------------------------------------------------------------------------------------------
// Isracard and Amex (insert_creditcard_transaction_handler, insert_amex_transaction_handler)
// ---------------------------------------------------------------------------------------------

const SUMMARY_SUPPLIERS = ['TOTAL FOR DATE', 'CASH ADVANCE FEE'];
/** Summary lines (literals checked byte-for-byte against the PL/pgSQL source). */
const SUMMARY_SUPPLIER_NAMES = ['סך חיוב בש"ח:', 'סך חיוב  ב-$:'];
/** Card fee lines, left out when their payment sum is 0. */
const CARD_FEE_SUPPLIER_NAMES = ['דמי כרטיס הנחה', 'פועלים- דמי כרט'];

/** `CASE WHEN currency_id = 'ש"ח' THEN 'ILS' WHEN 'NIS' ... WHEN 'דולר' THEN 'USD' ... ELSE 'ILS' END` */
const CARD_CURRENCIES = new Map<unknown, string>([
  ['ש"ח', 'ILS'],
  ['NIS', 'ILS'],
  ['דולר', 'USD'],
  ['USD', 'USD'],
  ['EUR', 'EUR'],
  ['GBP', 'GBP'],
]);

const isracardStyleHandler =
  (rawListColumn: 'creditcard_id' | 'amex_id', sourceOrigin: 'ISRACARD' | 'AMEX'): InsertHandler =>
  async (tx, NEW) => {
    // filter summarize records
    const outbound = NEW.full_supplier_name_outbound as string | null;
    const supplier = NEW.supplier_name as string | null;
    const keep = and3(
      or3(not3(in3(outbound, SUMMARY_SUPPLIERS)), outbound == null),
      or3(
        and3(
          not3(in3(supplier, SUMMARY_SUPPLIER_NAMES)),
          not3(and3(in3(supplier, CARD_FEE_SUPPLIER_NAMES), numEq(NEW.payment_sum, '0.00'))),
        ),
        supplier == null,
      ),
    );
    if (keep !== true) return;

    const mergedId = await fileRawRow(tx, rawListColumn, NEW.id);
    const { accountId, ownerId } = await findAccount(tx, text(NEW.card));
    const chargeId = await createCharge(tx, ownerId);

    const heb = NEW.full_supplier_name_heb as string | null;
    const purchase = NEW.full_purchase_date as string | null;
    const purchaseOutbound = NEW.full_purchase_date_outbound as string | null;
    await createTransaction(tx, {
      owner_id: ownerId,
      account_id: accountId,
      charge_id: chargeId,
      source_id: mergedId,
      source_description:
        outbound == null
          ? heb
          : heb == null
            ? concat(outbound) + (NEW.city == null ? '' : `/${NEW.city as string}`)
            : null,
      currency: castEnum('currency', CARD_CURRENCIES.get(NEW.currency_id) ?? 'ILS'),
      event_date:
        purchase == null
          ? toDateDMY(purchaseOutbound)
          : purchaseOutbound == null
            ? toDateDMY(purchase)
            : null,
      debit_date: toDateDMY(NEW.full_payment_date ?? NEW.charging_date),
      amount:
        NEW.payment_sum == null
          ? negate(NEW.payment_sum_outbound)
          : NEW.payment_sum_outbound == null
            ? negate(NEW.payment_sum)
            : null,
      current_balance: '0',
      source_reference: text(NEW.voucher_number) ?? text(NEW.voucher_number_ratz),
      source_origin: sourceOrigin,
      counter_account:
        NEW.supplier_id != null && numNe(NEW.supplier_id, 0) === true
          ? text(NEW.supplier_id)
          : outbound,
      origin_key: text(NEW.id),
    });
  };

// ---------------------------------------------------------------------------------------------
// Bank Discount, Cal, Max
// ---------------------------------------------------------------------------------------------

/** insert_bank_discount_transaction_handler */
const bankDiscount: InsertHandler = async (tx, NEW) => {
  const mergedId = await fileRawRow(tx, 'bank_discount_id', NEW.id);
  const { accountId, ownerId } = await findAccount(tx, text(NEW.account_number));
  const chargeId = await createCharge(tx, ownerId);
  await createTransaction(tx, {
    owner_id: ownerId,
    account_id: accountId,
    charge_id: chargeId,
    source_id: mergedId,
    source_description: NEW.operation_description ?? null,
    currency: 'ILS',
    event_date: toDateDMY(NEW.operation_date),
    debit_date: toDateDMY(NEW.value_date),
    amount: negate(NEW.operation_amount),
    current_balance: NEW.balance_after_operation ?? null,
    source_reference: NEW.urn ?? null,
    source_origin: 'BANK_DISCOUNT',
    counter_account:
      NEW.operation_number != null && numNe(NEW.operation_number, 0) === true
        ? concat(NEW.operation_bank, '-', NEW.operation_branch, '-', NEW.operation_number)
        : null,
    origin_key: text(NEW.id),
  });
};

/** insert_cal_creditcard_transaction_handler */
const cal: InsertHandler = async (tx, NEW) => {
  const mergedId = await fileRawRow(tx, 'cal_id', NEW.id);
  const { accountId, ownerId } = await findAccount(tx, text(NEW.card));
  const chargeId = await createCharge(tx, ownerId);
  await createTransaction(tx, {
    owner_id: ownerId,
    account_id: accountId,
    charge_id: chargeId,
    source_id: mergedId,
    source_description: NEW.merchant_name ?? null,
    currency: castEnum('currency', NEW.trn_currency_symbol),
    event_date: toDateDMY(NEW.trn_purchase_date),
    debit_date: toDateDMY(NEW.deb_crd_date),
    amount: negate(NEW.trn_amt),
    current_balance: '0',
    source_reference: NEW.trn_int_id ?? null,
    source_origin: 'CAL',
    counter_account: NEW.merchant_id ?? NEW.merchant_name ?? null,
    origin_key: text(NEW.id),
  });
};

/** insert_max_creditcard_transaction_handler */
const max: InsertHandler = async (tx, NEW) => {
  const mergedId = await fileRawRow(tx, 'max_creditcard_id', NEW.id);
  const { accountId, ownerId } = await findAccount(tx, text(NEW.short_card_number));
  if (accountId == null) {
    throw raise('No matching account found for card number: %', NEW.short_card_number);
  }
  const chargeId = await createCharge(tx, ownerId);
  if (not3(in3(NEW.original_currency, ['ILS'])) === true) {
    throw raise('Unknown currency: %', NEW.original_currency);
  }
  if (NEW.actual_payment_amount == null) throw raise('Transaction amount cannot be null');
  await createTransaction(tx, {
    owner_id: ownerId,
    account_id: accountId,
    charge_id: chargeId,
    source_id: mergedId,
    source_description: concatWs(' | ', NEW.merchant_name, NEW.comments),
    currency: 'ILS',
    event_date: NEW.purchase_date ?? null,
    debit_date: NEW.payment_date ?? null,
    amount: negate(NEW.actual_payment_amount),
    current_balance: '0',
    source_reference: NEW.arn ?? null,
    currency_rate: NEW.deal_data_exchange_rate ?? null,
    debit_timestamp: dateplusTime(NEW.payment_date, NEW.deal_data_purchase_time),
    source_origin: 'MAX',
    counter_account:
      NEW.merchant_tax_id != null && text(NEW.merchant_tax_id) !== ''
        ? text(NEW.merchant_tax_id)
        : (NEW.merchant_name ?? null),
    origin_key: text(NEW.id),
  });
};

// ---------------------------------------------------------------------------------------------
// Otsar Hahayal
// ---------------------------------------------------------------------------------------------

/** `CASE NEW.charge_currency WHEN ... END`; anything else is NULL, which RAISEs. */
const OTSAR_CHARGE_CURRENCIES = new Map<unknown, string>([
  ['שקל חדש', 'ILS'],
  ['דולר ארה"ב', 'USD'],
  ['אירו', 'EUR'],
]);
const OTSAR_CARD_FEE = '%דמי כרטיס%';
/** Fee descriptions of the foreign account (LIKE patterns). */
const OTSAR_FOREIGN_FEES = [
  '%עמלה בגין%',
  '%עמלת העברות%',
  '%עמלות מכותבים%',
  '%החזר תשלום עמלות%',
];
/** Fee descriptions of the ILS account (LIKE patterns). */
const OTSAR_ILS_FEES = ['%עמלת מסלול%', '%עמלת מטח%', '%עמלת בנקאות ישירה%'];

/** `text LIKE p1 OR text LIKE p2 ...` (NULL text: NULL). */
const likeAny = (value: unknown, patterns: readonly string[]): Bool3 =>
  value == null ? null : patterns.some(pattern => like(value, pattern));

/** insert_otsar_hahayal_creditcard_transaction_handler */
const otsarCreditCard: InsertHandler = async (tx, NEW) => {
  const mergedId = await fileRawRow(tx, 'otsar_hahayal_creditcard_id', NEW.id);
  const { accountId, ownerId } = await findAccount(tx, text(NEW.masked_pan), 'CREDIT_CARD');
  if (accountId == null || ownerId == null) {
    throw raise('Credit card account not found or has no owner for masked PAN: %', NEW.masked_pan);
  }
  const currency = OTSAR_CHARGE_CURRENCIES.get(NEW.charge_currency) ?? null;
  if (currency == null) throw raise('Unknown charge_currency: %', NEW.charge_currency);
  const isFee = likeAny(NEW.name, [OTSAR_CARD_FEE]);
  const chargeId = await createCharge(tx, ownerId);
  await createTransaction(tx, {
    owner_id: ownerId,
    account_id: accountId,
    charge_id: chargeId,
    source_id: mergedId,
    source_description: nullif(
      trim(
        concatWs(
          ' ',
          nullif(trim(NEW.name as string | null), ''),
          nullif(trim(NEW.notes as string | null), ''),
        ),
      ),
      '',
    ),
    currency,
    event_date: NEW.date ?? null,
    debit_date: NEW.charge_date ?? null,
    amount: negate(NEW.charge_amount),
    current_balance: '0',
    source_reference: text(NEW.resource_id),
    source_origin: 'OTSAR_HAHAYAL_CREDIT_CARD',
    counter_account: null,
    is_fee: isFee,
    origin_key: text(NEW.id),
  });
};

/** insert_otsar_hahayal_foreign_transaction_handler */
const otsarForeign: InsertHandler = async (tx, NEW) => {
  const mergedId = await fileRawRow(tx, 'otsar_hahayal_foreign_id', NEW.id);
  const { accountId, ownerId } = await findAccount(tx, text(NEW.account), 'BANK_ACCOUNT');
  if (accountId == null || ownerId == null) {
    // The RAISE names NEW.account_number, which this table does not have: Postgres fails on that.
    throw new DbError('record "new" has no field "account_number"', '42703');
  }
  const isFee = likeAny(NEW.description, OTSAR_FOREIGN_FEES);
  const chargeId = await createCharge(tx, ownerId);
  await createTransaction(tx, {
    owner_id: ownerId,
    account_id: accountId,
    charge_id: chargeId,
    source_id: mergedId,
    source_description: nullif(trim(NEW.description as string | null), ''),
    currency: castEnum('currency', NEW.currency),
    event_date: NEW.value_date ?? null,
    debit_date: NEW.date ?? null,
    amount: numNe(NEW.debit, 0) === true ? negate(NEW.debit) : text(NEW.credit),
    current_balance: NEW.balance ?? '0',
    source_reference: NEW.reference ?? null,
    source_origin: 'OTSAR_HAHAYAL',
    counter_account: null,
    is_fee: isFee,
    origin_key: text(NEW.id),
  });
};

/** insert_otsar_hahayal_ils_transaction_handler */
const otsarIls: InsertHandler = async (tx, NEW) => {
  const mergedId = await fileRawRow(tx, 'otsar_hahayal_ils_id', NEW.id);
  const { accountId, ownerId } = await findAccount(tx, text(NEW.account_number), 'BANK_ACCOUNT');
  if (accountId == null || ownerId == null) {
    throw raise(
      'Financial account not found or has no owner for account number: %',
      NEW.account_number,
    );
  }
  const isFee = likeAny(NEW.description, OTSAR_ILS_FEES);
  const chargeId = await createCharge(tx, ownerId);
  const part = (value: unknown) => nullif(trim(value as string | null), '');
  await createTransaction(tx, {
    owner_id: ownerId,
    account_id: accountId,
    charge_id: chargeId,
    source_id: mergedId,
    source_description: nullif(
      trim(
        concatWs(
          ' ',
          part(NEW.name),
          part(NEW.customer_name),
          part(NEW.description),
          part(NEW.transaction_reason),
        ),
      ),
      '',
    ),
    currency: 'ILS',
    event_date:
      NEW.date_of_registration == null ? null : timestampToDate(NEW.date_of_registration as Date),
    debit_date:
      NEW.date_of_business_day == null ? null : timestampToDate(NEW.date_of_business_day as Date),
    amount:
      numNe(NEW.debit_amount, 0) === true ? negate(NEW.debit_amount) : text(NEW.credit_amount),
    current_balance: NEW.closing_balance ?? null,
    source_reference: text(NEW.reference),
    source_origin: 'OTSAR_HAHAYAL',
    counter_account:
      numNe(NEW.correspondent_account, 0) === true
        ? concat(
            NEW.correspondent_bank,
            '-',
            NEW.correspondent_branch,
            '-',
            NEW.correspondent_account,
            ' (',
            NEW.correspondent_account_type,
            ')',
          )
        : null,
    is_fee: isFee,
    origin_key: text(NEW.id),
  });
};

// ---------------------------------------------------------------------------------------------
// Poalim
// ---------------------------------------------------------------------------------------------

const FOREIGN_CONVERSION_CODES = [884, 957, 1058, 1966];
const ILS_CONVERSION_TEXT_CODES = [22, 23, 861, 863];

/** Rows of `table` whose reference/catenated reference/value date equal NEW's. */
async function sameReference(
  tx: Transaction,
  table: 'poalim_foreign_account_transactions' | 'poalim_ils_account_transactions',
  NEW: StoredRow,
): Promise<StoredRow[]> {
  if (NEW.reference_number == null) return [];
  const key =
    table === 'poalim_ils_account_transactions'
      ? String(NEW.reference_number)
      : Number(NEW.reference_number);
  const rows = await tx.lookup(table, ['reference_number'], [key]);
  return rows.filter(
    s =>
      numEq(s.reference_catenated_number, NEW.reference_catenated_number) === true &&
      s.value_date != null &&
      s.value_date === NEW.value_date,
  );
}

/** insert_poalim_foreign_transaction_handler */
const poalimForeign: InsertHandler = async (tx, NEW) => {
  const mergedId = await fileRawRow(tx, 'poalim_foreign_id', NEW.id);
  const { accountId, ownerId } = await findAccount(tx, text(NEW.account_number));

  let chargeId: string | null = null;
  let isConversion = false;
  if (in3(NEW.activity_type_code, FOREIGN_CONVERSION_CODES) === true) {
    isConversion = true;
    // s: foreign conversions UNION ALL ILS conversions
    const candidates = [
      ...(await sameReference(tx, 'poalim_foreign_account_transactions', NEW)).filter(
        s => in3(s.activity_type_code, FOREIGN_CONVERSION_CODES) === true,
      ),
      ...(await sameReference(tx, 'poalim_ils_account_transactions', NEW)).filter(
        s => in3(s.text_code, ILS_CONVERSION_TEXT_CODES) === true,
      ),
    ];
    chargeId = await chargeOfFiledRow(tx, candidates, ownerId);
  }

  if (chargeId == null) {
    chargeId = await createCharge(tx, ownerId, isConversion ? 'CONVERSION' : null);
  }

  const eventAmount = numeric(NEW.event_amount);
  const isFee =
    (numEq(NEW.activity_type_code, 1279) === true &&
      eventAmount !== null &&
      !eventAmount.lt(0) &&
      !eventAmount.gt(30)) ||
    (numEq(NEW.activity_type_code, 884) === true && numEq(NEW.original_system_id, 390) === true);

  await createTransaction(tx, {
    account_id: accountId,
    charge_id: chargeId,
    source_id: mergedId,
    source_description: concatWs(
      ' ',
      NEW.activity_description,
      NEW.event_details,
      NEW.account_name,
    ),
    currency: NEW.currency ?? null,
    event_date: NEW.executing_date ?? null,
    debit_date: NEW.value_date ?? null,
    amount: poalimAmount(NEW),
    current_balance: NEW.current_balance ?? null,
    is_fee: isFee,
    source_reference: text(NEW.reference_number),
    source_origin: 'POALIM',
    currency_rate: NEW.currency_rate ?? null,
    counter_account: poalimCounterAccount(NEW),
    origin_key: text(NEW.id),
    owner_id: ownerId,
  });
};

/** insert_poalim_ils_transaction_handler */
const poalimIls: InsertHandler = async (tx, NEW) => {
  const mergedId = await fileRawRow(tx, 'poalim_ils_id', NEW.id);
  const { accountId, ownerId } = await findAccount(tx, text(NEW.account_number));

  let chargeId: string | null = null;
  let isConversion = false;
  if (in3(NEW.text_code, ILS_CONVERSION_TEXT_CODES) === true) {
    isConversion = true;
    const candidates = (await sameReference(tx, 'poalim_foreign_account_transactions', NEW)).filter(
      s => in3(s.activity_type_code, FOREIGN_CONVERSION_CODES) === true,
    );
    chargeId = await chargeOfFiledRow(tx, candidates, ownerId);
  }

  if (chargeId == null) {
    chargeId = await createCharge(tx, ownerId, isConversion ? 'CONVERSION' : null);
  }

  const code = NEW.activity_type_code;
  const textCode = NEW.text_code;
  const isFee =
    (numEq(code, 452) === true && in3(textCode, [105, 547]) === true) ||
    (numEq(code, 473) === true &&
      in3(textCode, [378, 395, 437, 502, 602, 603, 716, 771, 774]) === true) ||
    (numEq(code, 471) === true && in3(textCode, [615, 617]) === true);

  await createTransaction(tx, {
    account_id: accountId,
    charge_id: chargeId,
    source_id: mergedId,
    source_description: concatWs(
      ' ',
      NEW.activity_description,
      NEW.beneficiary_details_data_party_name,
      NEW.beneficiary_details_data_message_detail,
      NEW.english_action_desc,
    ),
    currency: 'ILS',
    event_date: NEW.event_date ?? null,
    debit_date: NEW.event_date ?? null,
    amount: poalimAmount(NEW),
    current_balance: NEW.current_balance ?? null,
    source_reference: text(NEW.reference_number),
    source_origin: 'POALIM',
    counter_account: poalimCounterAccount(NEW),
    is_fee: isFee,
    origin_key: text(NEW.id),
    owner_id: ownerId,
  });
};

/** insert_poalim_swift_transaction_handler: files only the fee a SWIFT transfer was charged. */
const poalimSwift: InsertHandler = async (tx, NEW) => {
  const amount33b = NEW.swift_currency_instructed_amount_33b as string | null;
  const amount32a = NEW.swift_value_date_currency_amount_32a as string | null;
  const rate36 = NEW.swift_exchange_rate_36 as string | null;
  const set = (value: string | null): value is string => value != null && value !== ' ';

  // extract amount
  let instructedAmount: Numeric | null;
  try {
    instructedAmount = set(amount33b)
      ? numericIn(right(amount33b, length(amount33b) - 3).replaceAll(',', '.'))
      : null;
  } catch (error) {
    throw raise('Invalid instructed amount for SWIFT. got: [%]; error: %', amount33b, error);
  }
  let valueDateAmount: Numeric | null;
  try {
    valueDateAmount = set(amount32a)
      ? numericIn(right(amount32a, length(amount32a) - 9).replaceAll(',', '.'))
      : null;
  } catch (error) {
    throw raise('Invalid value date amount for SWIFT. got: [%]; error: %', amount32a, error);
  }
  let transactionAmount = instructedAmount ?? valueDateAmount;

  // extract currency
  let instructedCurrency: string | null;
  try {
    instructedCurrency = set(amount33b) ? castEnum('currency', left(amount33b, 3)) : null;
  } catch (error) {
    throw raise(
      'Invalid instructed currency for SWIFT transaction. got: [%]; error: %',
      amount33b,
      error,
    );
  }
  let valueDateCurrency: string | null;
  try {
    valueDateCurrency = set(amount32a) ? castEnum('currency', right(left(amount32a, 9), 3)) : null;
  } catch (error) {
    throw raise(
      'Invalid value date currency for SWIFT transaction. got: [%]; error: %',
      amount32a,
      error,
    );
  }
  const currencyCode = instructedCurrency ?? valueDateCurrency;

  // handle multiple currencies
  let exchangeRate: Numeric | null;
  try {
    exchangeRate = set(rate36) ? numericIn(rate36.replaceAll(',', '.')) : null;
  } catch (error) {
    throw raise(
      'Invalid exchange rate format in SWIFT fields. Got this: [%]; Error: %',
      rate36,
      error,
    );
  }
  if (
    instructedAmount !== null &&
    valueDateCurrency !== null &&
    instructedCurrency !== null &&
    valueDateCurrency !== instructedCurrency
  ) {
    if (exchangeRate === null) {
      // This RAISE passes SQLERRM outside an exception handler, which Postgres rejects.
      throw new DbError('column "sqlerrm" does not exist', '42703');
    }
    transactionAmount = instructedAmount.mul(exchangeRate).round(2);
  }

  const feeAmount =
    transactionAmount === null || valueDateAmount === null
      ? null
      : transactionAmount.sub(valueDateAmount);
  if (feeAmount === null || feeAmount.lt(0)) return;

  const mergedId = await fileRawRow(tx, 'poalim_swift_id', NEW.id);
  const { accountId, ownerId } = await findAccount(tx, text(NEW.account_number));
  if (accountId == null) throw raise('Account not found for account number: %', NEW.account_number);

  // check if matching charge exists for source
  let chargeId: string | null = null;
  if (NEW.formatted_start_date != null && currencyCode !== null) {
    const partyName = NEW.charge_party_name as string | null;
    const pattern = partyName == null ? null : `%${trim(left(partyName, 13))}%`;
    const negated = transactionAmount!.mul(-1);
    const candidates = (
      await tx.lookup(
        'poalim_foreign_account_transactions',
        ['formatted_value_date'],
        [String(NEW.formatted_start_date)],
      )
    ).filter(s => {
      if (s.currency !== currencyCode) return false;
      const detailsMatch =
        pattern === null || s.event_details == null ? null : like(s.event_details, pattern);
      const byName =
        detailsMatch === true &&
        NEW.amount != null &&
        s.event_amount != null &&
        numericIn(String(NEW.amount)).eq(s.event_amount as string);
      const byAmount = s.event_amount != null && negated.eq(s.event_amount as string);
      return byName || byAmount;
    });
    chargeId = await chargeOfFiledRow(tx, candidates, undefined);
  }

  // if no match, create new charge
  if (chargeId == null) chargeId = await createCharge(tx, ownerId);

  // create new transaction for fee
  await createTransaction(tx, {
    owner_id: ownerId,
    account_id: accountId,
    charge_id: chargeId,
    source_id: mergedId,
    source_description: concatWs(
      ' ',
      'Swift Fee:',
      NEW.charge_party_name,
      NEW.reference_number,
      NEW.swift_remittance_information_70,
    ),
    currency: currencyCode,
    event_date: textToDate(NEW.formatted_start_date),
    debit_date: textToDate(NEW.formatted_start_date),
    amount: feeAmount.mul(-1).toString(),
    current_balance: '0',
    business_id: null,
    is_fee: true,
    source_reference: NEW.reference_number ?? null,
    counter_account: 'SWIFT',
    source_origin: 'POALIM',
    origin_key: text(NEW.id),
  });
};

export const BANK_INSERT_HANDLERS: Record<string, InsertHandler> = {
  amex_creditcard_transactions: isracardStyleHandler('amex_id', 'AMEX'),
  bank_discount_transactions: bankDiscount,
  cal_creditcard_transactions: cal,
  isracard_creditcard_transactions: isracardStyleHandler('creditcard_id', 'ISRACARD'),
  max_creditcard_transactions: max,
  otsar_hahayal_creditcard_transactions: otsarCreditCard,
  otsar_hahayal_foreign_account_transactions: otsarForeign,
  otsar_hahayal_ils_account_transactions: otsarIls,
  poalim_foreign_account_transactions: poalimForeign,
  poalim_ils_account_transactions: poalimIls,
  poalim_swift_account_transactions: poalimSwift,
};
