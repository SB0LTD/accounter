import {
  and3,
  anyEquals,
  arrayContains,
  compareUuid,
  dateToTimestamp,
  deletable,
  distinctUuids,
  floatText,
  floatToNumericText,
  greatestDate,
  groupByKey,
  leastDate,
  maxDate,
  maxTime,
  minDate,
  minTime,
  not3,
  or3,
  overlaps,
  sumFloat,
  sumNumericText,
  type Bool3,
} from '../_helpers.js';
import { nullRowOf } from '../_rows.js';
import type {
  IBatchUpdateChargesQuery,
  IDeleteChargesByIdsQuery,
  IGenerateChargeQuery,
  IGetChargesByFiltersQuery,
  IGetChargesByFiltersResult,
  IGetChargesByIdsQuery,
  IGetChargesByMissingRequiredInfoQuery,
  IGetChargesByTransactionIdsQuery,
  IGetSimilarChargesQuery,
  IUpdateAccountantApprovalQuery,
  IUpdateChargeQuery,
} from '../../../../../modules/charges/__generated__/charges.types.js';
import type { Row } from '../../../../catalog.js';
import {
  coalesce,
  coalescePatch,
  compareEnum,
  containsInsensitive,
  inList,
  limitOffset,
  Numeric,
  toDateString,
} from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

type Charge = Row<'charges'>;
type Transaction = Row<'transactions'>;
type Document = Row<'documents'>;

/** SELECT * FROM charges WHERE id IN $$chargeIds */
export const getChargesByIds = port<IGetChargesByIdsQuery>(async ({ chargeIds }, db) =>
  db.whereIn('charges', 'id', chargeIds),
);

/**
 * SELECT t.id AS transaction_id, c.* FROM transactions t LEFT JOIN charges c ON t.charge_id = c.id
 * WHERE t.id IN $$transactionIds
 */
export const getChargesByTransactionIds = port<IGetChargesByTransactionIdsQuery>(
  async ({ transactionIds }, db) => {
    const result = [];
    for (const t of await db.whereIn('transactions', 'id', transactionIds)) {
      const [charge] = await db.where('charges', { id: t.charge_id });
      result.push({ transaction_id: t.id, ...(charge ?? nullRowOf('charges')) });
    }
    return result as never;
  },
);

/**
 * SELECT c.* FROM charges c LEFT JOIN charge_tags t ON t.charge_id = c.id
 * WHERE c.user_description IS NULL OR t.tag_id IS NULL
 *
 * One row per (charge, tag) pair, so an undescribed charge with two tags comes twice.
 */
export const getChargesByMissingRequiredInfo = port<IGetChargesByMissingRequiredInfoQuery>(
  async (_params, db) => {
    const tagsByCharge = groupByKey(await db.rows('charge_tags'), t => t.charge_id);
    const result: Charge[] = [];
    for (const c of await db.rows('charges')) {
      const tags = tagsByCharge.get(c.id) ?? [null];
      for (const t of tags) {
        if (c.user_description == null || t?.tag_id == null) result.push(c);
      }
    }
    return result;
  },
);

/** The `SET col = COALESCE($param, col)` list shared by updateCharge and batchUpdateCharges. */
function chargePatch(p: {
  userDescription?: string | null | void;
  type?: string | null | void;
  isInvoicePaymentDifferentCurrency?: boolean | null | void;
  accountantStatus?: string | null | void;
  taxCategoryId?: string | null | void;
  optionalVAT?: boolean | null | void;
  optionalDocuments?: boolean | null | void;
  isProperty?: boolean | null | void;
}): Partial<Charge> {
  return coalescePatch({
    user_description: p.userDescription,
    type: p.type,
    invoice_payment_currency_diff: p.isInvoicePaymentDifferentCurrency,
    accountant_status: p.accountantStatus,
    tax_category_id: p.taxCategoryId,
    optional_vat: p.optionalVAT,
    documents_optional_flag: p.optionalDocuments,
    is_property: p.isProperty,
  }) as Partial<Charge>;
}

/**
 * UPDATE charges SET user_description = COALESCE($userDescription, user_description), type = ...,
 *   invoice_payment_currency_diff, accountant_status, tax_category_id, optional_vat,
 *   documents_optional_flag, is_property (each COALESCE($param, column))
 * WHERE id = $chargeId RETURNING *
 */
export const updateCharge = port<IUpdateChargeQuery>(async (params, db) => {
  if (params.chargeId == null) return [];
  const result = [];
  for (const charge of await db.where('charges', { id: params.chargeId })) {
    result.push(await db.update('charges', charge, chargePatch(params)));
  }
  return result;
});

/** Same SET list as updateCharge, WHERE id IN $$chargeIds RETURNING * */
export const batchUpdateCharges = port<IBatchUpdateChargesQuery>(async (params, db) => {
  const result = [];
  for (const charge of await db.whereIn('charges', 'id', params.chargeIds)) {
    result.push(await db.update('charges', charge, chargePatch(params)));
  }
  return result;
});

/** UPDATE charges SET accountant_status = $accountantStatus WHERE id = $chargeId RETURNING * */
export const updateAccountantApproval = port<IUpdateAccountantApprovalQuery>(
  async ({ accountantStatus, chargeId }, db) => {
    if (chargeId == null) return [];
    const result = [];
    for (const charge of await db.where('charges', { id: chargeId })) {
      result.push(
        await db.update('charges', charge, {
          accountant_status: (accountantStatus ?? null) as never,
        }),
      );
    }
    return result;
  },
);

/**
 * INSERT INTO charges (owner_id, type, accountant_status, user_description, tax_category_id,
 *   optional_vat, documents_optional_flag, is_property) VALUES (...) RETURNING *
 */
export const generateCharge = port<IGenerateChargeQuery>(async (p, db) => {
  const row = await db.insert('charges', {
    owner_id: (p.ownerId ?? null) as never,
    type: p.type ?? null,
    accountant_status: (p.accountantStatus ?? null) as never,
    user_description: p.userDescription ?? null,
    tax_category_id: p.taxCategoryId ?? null,
    optional_vat: (p.optionalVAT ?? null) as never,
    documents_optional_flag: (p.optionalDocuments ?? null) as never,
    is_property: (p.isProperty ?? null) as never,
  });
  return row ? [row] : [];
});

/** DELETE FROM charges WHERE id IN $$chargeIds */
export const deleteChargesByIds = port<IDeleteChargesByIdsQuery>(async ({ chargeIds }, db) => {
  for (const charge of deletable(db, await db.whereIn('charges', 'id', chargeIds))) {
    await db.delete('charges', charge);
  }
  return [];
});

// =============================================================================================
// getChargesByFilters
// =============================================================================================

const INVOICE_TYPES = new Set(['INVOICE', 'INVOICE_RECEIPT', 'CREDIT_INVOICE']);
const RECEIPT_TYPES = new Set(['RECEIPT', 'INVOICE_RECEIPT']);
const ACCOUNTING_TYPES = new Set(['INVOICE', 'INVOICE_RECEIPT', 'RECEIPT', 'CREDIT_INVOICE']);

const sortCurrencies = (values: Iterable<string>) =>
  [...new Set(values)].sort((a, b) => compareEnum('currency', a, b));

/** `numeric::TEXT ILIKE '%' || $text || '%' OR ABS(numeric)::TEXT ILIKE ...` */
function numericMatches(value: string | null, text: string): boolean {
  if (value == null) return false;
  const n = Numeric.of(value);
  return containsInsensitive(n.toString(), text) || containsInsensitive(n.abs().toString(), text);
}

/** The same for a double precision column. */
function floatMatches(value: number | null, text: string): boolean {
  if (value == null) return false;
  return (
    containsInsensitive(floatText(value), text) ||
    containsInsensitive(floatText(Math.abs(value)), text)
  );
}

interface TextSearchTables {
  charges: readonly Charge[];
  transactions: readonly Transaction[];
  documents: readonly Document[];
  entityNames: Map<string, string>;
}

/**
 * The UNION branches of `search_matches` / `excluded_matches` that need a parameter: charge ids
 * whose transactions, documents or counterparties mention `text`, or whose amounts contain
 * `numeric`. The charge-description branch differs between the two CTEs and is added by the caller.
 */
function textMatches(
  tables: TextSearchTables,
  text: string | null,
  numeric: string | null,
  ids: Set<string | null>,
) {
  if (text != null) {
    for (const t of tables.transactions) {
      if (
        containsInsensitive(t.source_description, text) ||
        containsInsensitive(t.source_reference, text)
      ) {
        ids.add(t.charge_id);
      }
    }
    for (const d of tables.documents) {
      if (
        containsInsensitive(d.description, text) ||
        containsInsensitive(d.remarks, text) ||
        containsInsensitive(d.serial_number, text)
      ) {
        ids.add(d.charge_id);
      }
    }
  }
  if (numeric != null) {
    for (const t of tables.transactions)
      if (numericMatches(t.amount, numeric)) ids.add(t.charge_id);
    for (const d of tables.documents) {
      if (floatMatches(d.total_amount, numeric) || floatMatches(d.vat_amount, numeric)) {
        ids.add(d.charge_id);
      }
    }
  }
  if (text != null) {
    const nameMatches = (entityId: string | null) => {
      if (entityId == null) return false;
      const name = tables.entityNames.get(entityId);
      return name != null && containsInsensitive(name, text);
    };
    for (const t of tables.transactions) if (nameMatches(t.business_id)) ids.add(t.charge_id);
    for (const d of tables.documents) if (nameMatches(d.creditor_id)) ids.add(d.charge_id);
    for (const d of tables.documents) if (nameMatches(d.debtor_id)) ids.add(d.charge_id);
  }
}

/** transactions_by_charge for the given charges. */
function transactionsByCharge(transactions: readonly Transaction[], chargeIds: Set<string>) {
  const result = new Map<string, ReturnType<typeof aggregateTransactions>>();
  const groups = groupByKey(
    transactions.filter(t => chargeIds.has(t.charge_id)),
    t => t.charge_id,
  );
  for (const [chargeId, rows] of groups) result.set(chargeId, aggregateTransactions(rows));
  return result;
}

function aggregateTransactions(rows: readonly Transaction[]) {
  const debitDates = rows.map(t => t.debit_date_override ?? t.debit_date);
  const debitTimes = rows.map(
    t => t.debit_timestamp ?? (t.debit_date == null ? null : dateToTimestamp(t.debit_date)),
  );
  const notFees = rows.filter(t => t.is_fee !== true);
  return {
    min_event_date: minDate(rows.map(t => t.event_date)),
    max_event_date: maxDate(rows.map(t => t.event_date)),
    min_debit_date: minDate(debitDates),
    max_debit_date: maxDate(debitDates),
    min_debit_timestamp: minTime(debitTimes),
    max_debit_timestamp: maxTime(debitTimes),
    fee_excluded_event_amount: coalesce(
      sumNumericText(notFees.map(t => t.amount)),
      sumNumericText(rows.map(t => t.amount)),
    ),
    fee_excluded_currency_array: notFees.length
      ? sortCurrencies(notFees.map(t => t.currency))
      : sortCurrencies(rows.map(t => t.currency)),
    event_amount: sumNumericText(rows.map(t => t.amount)),
    transactions_count: String(rows.length),
    invalid_transactions: rows.some(
      t => t.business_id == null || (t.debit_date_override ?? t.debit_date) == null,
    ),
    missing_counterparty_transactions: rows.some(t => t.business_id == null),
    currency_array: sortCurrencies(rows.map(t => t.currency)),
    account_array: distinctUuids(rows.map(t => t.account_id)),
  };
}

/** One document of a charge, LEFT JOINed with its counterparty business and issued status. */
interface DocumentJoin {
  doc: Document;
  ownerId: string;
  canSettle: boolean | null;
  status: string | null;
}

function documentsByCharge(joins: readonly DocumentJoin[]) {
  const result = new Map<string, ReturnType<typeof aggregateDocuments>>();
  for (const [chargeId, rows] of groupByKey(joins, j => j.doc.charge_id!)) {
    result.set(chargeId, aggregateDocuments(rows));
  }
  return result;
}

function aggregateDocuments(rows: readonly DocumentJoin[]) {
  // CASE WHEN d.creditor_id = fc.owner_id THEN 1 ELSE -1 END
  const creditorSign = (j: DocumentJoin) => (j.doc.creditor_id === j.ownerId ? 1 : -1);
  // CASE WHEN d.debtor_id = fc.owner_id THEN -1 ELSE 1 END
  const debtorSign = (j: DocumentJoin) => (j.doc.debtor_id === j.ownerId ? -1 : 1);
  const times = (value: number | null, sign: number) => (value == null ? null : value * sign);
  const accounting = rows.filter(j => ACCOUNTING_TYPES.has(j.doc.type));
  const settledReceipts = rows.filter(j => j.canSettle === true && RECEIPT_TYPES.has(j.doc.type));
  const invoices = rows.filter(j => INVOICE_TYPES.has(j.doc.type));
  const receipts = rows.filter(j => RECEIPT_TYPES.has(j.doc.type));
  const proformas = rows.filter(j => j.doc.type === 'PROFORMA');
  const currencyRows = rows.filter(
    j => (j.canSettle === true && RECEIPT_TYPES.has(j.doc.type)) || INVOICE_TYPES.has(j.doc.type),
  );
  const distinctCurrencies = (list: readonly DocumentJoin[]) => {
    const values = list.map(j => j.doc.currency_code).filter(c => c != null);
    return values.length ? sortCurrencies(values) : null;
  };
  let openFlag: boolean | null = null;
  for (const j of rows) if (j.status != null) openFlag = (openFlag ?? false) || j.status === 'OPEN';

  return {
    min_event_date: minDate(accounting.map(j => j.doc.date)),
    min_any_event_date: minDate(rows.map(j => j.doc.date)),
    max_event_date: maxDate(accounting.map(j => j.doc.date)),
    max_any_event_date: maxDate(rows.map(j => j.doc.date)),
    receipt_event_amount: sumFloat(
      settledReceipts.map(j => times(j.doc.total_amount, creditorSign(j))),
    ),
    invoice_event_amount: sumFloat(invoices.map(j => times(j.doc.total_amount, creditorSign(j)))),
    receipt_vat_amount: sumFloat(
      settledReceipts.map(j => times(j.doc.vat_amount, creditorSign(j))),
    ),
    invoice_vat_amount: sumFloat(invoices.map(j => times(j.doc.vat_amount, creditorSign(j)))),
    invoices_count: invoices.length,
    receipts_count: receipts.length,
    documents_count: rows.length,
    invalid_documents: rows.some(
      j =>
        (ACCOUNTING_TYPES.has(j.doc.type) &&
          (j.doc.debtor_id == null ||
            j.doc.creditor_id == null ||
            j.doc.date == null ||
            j.doc.serial_number == null ||
            j.doc.vat_amount == null ||
            j.doc.total_amount == null ||
            j.doc.charge_id == null ||
            j.doc.currency_code == null)) ||
        j.doc.type === 'UNPROCESSED',
    ),
    missing_counterparty_documents: accounting.some(
      j => j.doc.creditor_id == null || j.doc.debtor_id == null,
    ),
    currency_array: currencyRows.length ? currencyRows.map(j => j.doc.currency_code) : null,
    js_invoice_event_amount: sumFloat(invoices.map(j => times(j.doc.total_amount, debtorSign(j)))),
    js_receipt_event_amount: sumFloat(receipts.map(j => times(j.doc.total_amount, debtorSign(j)))),
    js_proforma_event_amount: sumFloat(
      proformas.map(j => times(j.doc.total_amount, debtorSign(j))),
    ),
    js_invoice_vat_amount: sumFloat(invoices.map(j => times(j.doc.vat_amount, debtorSign(j)))),
    js_receipt_vat_amount: sumFloat(receipts.map(j => times(j.doc.vat_amount, debtorSign(j)))),
    js_accountancy_currency_array: distinctCurrencies(accounting),
    js_proforma_currency_array: distinctCurrencies(proformas),
    open_docs_flag: openFlag ?? false,
  };
}

/**
 * businesses_by_charge: the UNION (distinct) of (charge, business, is_fee) triples, grouped per
 * charge into all businesses and the non-fee ones, both without the owner.
 */
function businessesByCharge(
  triples: Iterable<[string, string | null, boolean]>,
  ownerOf: (chargeId: string) => string,
) {
  const distinct = new Map<string, [string, string, boolean]>();
  for (const [chargeId, businessId, isFee] of triples) {
    if (businessId == null) continue;
    distinct.set(`${chargeId}|${businessId}|${isFee}`, [chargeId, businessId, isFee]);
  }
  const result = new Map<string, { business_array: string[]; filtered_business_array: string[] }>();
  for (const [chargeId, rows] of groupByKey([...distinct.values()], r => r[0])) {
    const owner = ownerOf(chargeId);
    result.set(chargeId, {
      business_array: distinctUuids(rows.map(r => r[1])).filter(id => id !== owner),
      filtered_business_array: distinctUuids(rows.map(r => (r[2] ? null : r[1]))).filter(
        id => id !== owner,
      ),
    });
  }
  return result;
}

/** ledger_by_charge: record count, entities (NULLs removed), date ranges. */
function ledgerByCharge(records: readonly Row<'ledger_records'>[], chargeIds: Set<string>) {
  const result = new Map<
    string,
    {
      ledger_count: string;
      ledger_financial_entities: string[];
      min_value_date: string | null;
      max_value_date: string | null;
      min_invoice_date: string | null;
      max_invoice_date: string | null;
    }
  >();
  const groups = groupByKey(
    records.filter(r => chargeIds.has(r.charge_id)),
    r => r.charge_id,
  );
  for (const [chargeId, rows] of groups) {
    result.set(chargeId, {
      ledger_count: String(new Set(rows.map(r => r.id)).size),
      ledger_financial_entities: distinctUuids(
        rows.flatMap(r => [r.credit_entity1, r.credit_entity2, r.debit_entity1, r.debit_entity2]),
      ),
      min_value_date: minDate(rows.map(r => r.value_date)),
      max_value_date: maxDate(rows.map(r => r.value_date)),
      min_invoice_date: minDate(rows.map(r => r.invoice_date)),
      max_invoice_date: maxDate(rows.map(r => r.invoice_date)),
    });
  }
  return result;
}

/** Postgres record ordering: field by field, a NULL field after every non-null one. */
function compareRecord(
  a: readonly unknown[],
  b: readonly unknown[],
  cmp: ((x: never, y: never) => number)[],
) {
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x == null && y == null) continue;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = cmp[i]!(x as never, y as never);
    if (c !== 0) return c;
  }
  return 0;
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const compareNumeric = (a: string, b: string) => Numeric.of(a).cmp(b);

/**
 * The charges list: charges matching free text (charge description, transaction texts, document
 * texts, amounts as text, counterparty names) and many filters, each enriched with the aggregates
 * of its transactions, documents, businesses, tags, ledger records, securities executions and
 * spread, then sorted and paged. The SQL (charges.provider.ts) is ~670 lines; each step below is
 * named after the CTE it ports:
 *
 *   search_matches / excluded_matches   UNION of matching charge ids (free text, numeric text)
 *   filtered_charges                    charges in search_matches, by IDs / owners, not excluded
 *   years_of_relevance, transactions_by_charge, documents_by_charge, businesses_by_charge,
 *   tags_by_charge, ledger_by_charge, securities_executions_by_charge   per-charge aggregates
 *   enriched_charges                    the charge row plus the aggregates (LEFT JOINs)
 *   final SELECT                        WHERE filters, ABS(event_amount), COUNT(*) OVER (),
 *                                       ORDER BY (sort column, direction, id), LIMIT / OFFSET
 *
 * Money: transaction amounts are numeric (exact, via Numeric); document amounts are double precision
 * in the SQL too, summed as doubles and cast with `::numeric` (15 significant digits) where the SQL
 * casts them. `tags` and `years_of_relevance` are `array_agg` without ORDER BY: Postgres's element
 * order depends on the plan, so the verifier may report ARRAY-ORDER (SOFT) for them; here they follow
 * the tables' row order.
 */
export const getChargesByFilters = port<IGetChargesByFiltersQuery>(async (p, db) => {
  const [
    charges,
    transactions,
    documents,
    entities,
    businesses,
    documentsIssued,
    ledgerRecords,
    miscExpenses,
    chargeTags,
    chargeSpread,
    taxCategoryMatches,
    tripCharges,
    securitiesExecutions,
    securities,
  ] = await Promise.all([
    db.rows('charges'),
    db.rows('transactions'),
    db.rows('documents'),
    db.rows('financial_entities'),
    db.rows('businesses'),
    db.rows('documents_issued'),
    db.rows('ledger_records'),
    db.rows('misc_expenses'),
    db.rows('charge_tags'),
    db.rows('charge_spread'),
    db.rows('business_tax_category_match'),
    db.rows('business_trip_charges'),
    db.rows('charges_securities_executions'),
    db.rows('poalim_securities_transactions'),
  ]);
  const tables: TextSearchTables = {
    charges,
    transactions,
    documents,
    entityNames: new Map(entities.map(fe => [fe.id, fe.name])),
  };
  const freeText = p.freeText ?? null;
  const freeTextNumeric = p.freeTextNumeric ?? null;
  const excludedFreeText = p.excludedFreeText ?? null;
  const excludedFreeTextNumeric = p.excludedFreeTextNumeric ?? null;

  // search_matches
  const searchMatches = new Set<string | null>();
  for (const c of charges) {
    if (freeText == null || containsInsensitive(c.user_description, freeText))
      searchMatches.add(c.id);
  }
  textMatches(tables, freeText, freeTextNumeric, searchMatches);

  // excluded_matches
  const excludedMatches = new Set<string | null>();
  if (excludedFreeText != null) {
    for (const c of charges) {
      if (containsInsensitive(c.user_description, excludedFreeText)) excludedMatches.add(c.id);
    }
  }
  textMatches(tables, excludedFreeText, excludedFreeTextNumeric, excludedMatches);

  // filtered_charges
  const inIds = inList(p.IDs);
  const inOwners = inList(p.ownerIds);
  const filtered = charges.filter(
    c =>
      searchMatches.has(c.id) &&
      (p.isIDs === 0 || inIds(c.id)) &&
      (p.isOwnerIds === 0 || inOwners(c.owner_id)) &&
      ((excludedFreeText == null && excludedFreeTextNumeric == null) || !excludedMatches.has(c.id)),
  );
  const fcIds = new Set(filtered.map(c => c.id));
  const ownerOf = new Map(filtered.map(c => [c.id, c.owner_id]));

  // years_of_relevance
  const years = groupByKey(
    chargeSpread.filter(cs => fcIds.has(cs.charge_id)),
    cs => cs.charge_id,
  );

  // transactions_by_charge
  const tbc = transactionsByCharge(transactions, fcIds);

  // documents_by_charge: JOIN filtered_charges, LEFT JOIN businesses ON businesses.id = CASE
  // WHEN creditor = owner THEN debtor WHEN debtor = owner THEN creditor END, LEFT JOIN documents_issued
  const businessById = new Map(businesses.map(b => [b.id, b]));
  const issuedById = new Map(documentsIssued.map(d => [d.id, d]));
  const docJoins: DocumentJoin[] = [];
  for (const doc of documents) {
    if (doc.charge_id == null || !fcIds.has(doc.charge_id)) continue;
    const ownerId = ownerOf.get(doc.charge_id)!;
    const counterparty =
      doc.creditor_id === ownerId
        ? doc.debtor_id
        : doc.debtor_id === ownerId
          ? doc.creditor_id
          : null;
    const business = counterparty == null ? undefined : businessById.get(counterparty);
    docJoins.push({
      doc,
      ownerId,
      canSettle: business?.can_settle_with_receipt ?? null,
      status: issuedById.get(doc.id)?.status ?? null,
    });
  }
  const dbc = documentsByCharge(docJoins);

  // businesses_by_charge
  const triples: [string, string | null, boolean][] = [];
  for (const t of transactions)
    if (fcIds.has(t.charge_id)) triples.push([t.charge_id, t.business_id, t.is_fee]);
  for (const d of documents) {
    if (d.charge_id != null && fcIds.has(d.charge_id))
      triples.push([d.charge_id, d.creditor_id, false]);
  }
  for (const d of documents) {
    if (d.charge_id != null && fcIds.has(d.charge_id))
      triples.push([d.charge_id, d.debtor_id, false]);
  }
  const ledger = ledgerRecords.filter(l => fcIds.has(l.charge_id));
  for (const l of ledger) triples.push([l.charge_id, l.credit_entity1, true]);
  for (const l of ledger) triples.push([l.charge_id, l.credit_entity2, true]);
  for (const l of ledger) triples.push([l.charge_id, l.debit_entity1, true]);
  for (const l of ledger) triples.push([l.charge_id, l.debit_entity2, true]);
  const misc = miscExpenses.filter(m => fcIds.has(m.charge_id));
  for (const m of misc) triples.push([m.charge_id, m.creditor_id, true]);
  for (const m of misc) triples.push([m.charge_id, m.debtor_id, true]);
  const bbc = businessesByCharge(triples, id => ownerOf.get(id)!);

  // tags_by_charge
  const tagsByCharge = groupByKey(
    chargeTags.filter(ct => fcIds.has(ct.charge_id)),
    ct => ct.charge_id,
  );

  // ledger_by_charge
  const lbc = ledgerByCharge(ledgerRecords, fcIds);

  // securities_executions_by_charge
  const securityById = new Map(securities.map(s => [s.id, s]));
  const sebc = new Map<string, { min_date: string | null; max_date: string | null }>();
  const executionGroups = groupByKey(
    securitiesExecutions.filter(
      cse =>
        cse.charge_id != null && fcIds.has(cse.charge_id) && securityById.has(cse.execution_id),
    ),
    cse => cse.charge_id!,
  );
  for (const [chargeId, rows] of executionGroups) {
    const dates = rows.map(cse => {
      const pst = securityById.get(cse.execution_id)!;
      return pst.value_date ?? pst.trade_date;
    });
    sebc.set(chargeId, { min_date: minDate(dates), max_date: maxDate(dates) });
  }

  // enriched_charges
  const taxCategoryByBusiness = new Map(
    taxCategoryMatches.map(m => [`${m.business_id}|${m.owner_id}`, m.tax_category_id]),
  );
  const tripByCharge = new Map(tripCharges.map(btc => [btc.charge_id, btc.business_trip_id]));
  const enriched = filtered.map(c => {
    const t = tbc.get(c.id);
    const d = dbc.get(c.id);
    const bb = bbc.get(c.id);
    const b =
      bb && bb.filtered_business_array.length === 1
        ? businessById.get(bb.filtered_business_array[0]!)
        : undefined;
    const matchedTaxCategory = b ? taxCategoryByBusiness.get(`${b.id}|${c.owner_id}`) : undefined;
    const l = lbc.get(c.id);
    const se = sebc.get(c.id);
    const tags = tagsByCharge.get(c.id);
    const y = years.get(c.id);
    const single = <T>(array: readonly T[] | null | undefined): T | null =>
      array && array.length === 1 ? array[0]! : null;
    const documentAmount = d
      ? d.invoices_count > 0
        ? d.js_invoice_event_amount
        : d.receipts_count > 0
          ? d.js_receipt_event_amount
          : d.js_proforma_event_amount
      : null;
    return {
      id: c.id,
      owner_id: c.owner_id,
      is_property: c.is_property,
      accountant_status: c.accountant_status,
      user_description: c.user_description,
      created_at: c.created_at,
      updated_at: c.updated_at,
      tax_category_id: c.tax_category_id ?? matchedTaxCategory ?? null,
      event_amount: floatToNumericText(documentAmount) ?? t?.event_amount ?? null,
      transactions_min_event_date: t?.min_event_date ?? null,
      transactions_max_event_date: t?.max_event_date ?? null,
      transactions_min_debit_date: t?.min_debit_date ?? null,
      transactions_max_debit_date: t?.max_debit_date ?? null,
      transactions_min_debit_timestamp: t?.min_debit_timestamp ?? null,
      transactions_max_debit_timestamp: t?.max_debit_timestamp ?? null,
      transactions_fee_excluded_amount: t?.fee_excluded_event_amount ?? null,
      account_array: t ? [...t.account_array] : null,
      transactions_fee_excluded_currencies: t ? [...t.fee_excluded_currency_array] : null,
      transactions_event_amount: t?.event_amount ?? null,
      transactions_currency: single(t?.currency_array),
      transactions_count: t?.transactions_count ?? null,
      invalid_transactions: t?.invalid_transactions ?? null,
      missing_counterparty_transactions: t?.missing_counterparty_transactions ?? null,
      missing_counterparty_documents: d?.missing_counterparty_documents ?? null,
      documents_min_date: d ? (d.min_event_date ?? d.min_any_event_date) : null,
      documents_max_date: d ? (d.max_event_date ?? d.max_any_event_date) : null,
      documents_event_amount: d ? (d.invoice_event_amount ?? d.receipt_event_amount) : null,
      documents_vat_amount: d ? (d.invoice_vat_amount ?? d.receipt_vat_amount) : null,
      documents_invoice_amount: d?.js_invoice_event_amount ?? null,
      documents_receipt_amount: d?.js_receipt_event_amount ?? null,
      documents_proforma_amount: d?.js_proforma_event_amount ?? null,
      documents_invoice_vat_amount: d?.js_invoice_vat_amount ?? null,
      documents_receipt_vat_amount: d?.js_receipt_vat_amount ?? null,
      documents_accountancy_currencies: d?.js_accountancy_currency_array ?? null,
      documents_proforma_currencies: d?.js_proforma_currency_array ?? null,
      documents_currency: single(d?.currency_array),
      invoices_count: d ? String(d.invoices_count) : null,
      receipts_count: d ? String(d.receipts_count) : null,
      documents_count: d ? String(d.documents_count) : null,
      invalid_documents: d?.invalid_documents ?? null,
      open_docs_flag: d?.open_docs_flag ?? null,
      business_array: bb ? [...bb.business_array] : null,
      main_business_array: bb ? [...bb.filtered_business_array] : null,
      business_id: b?.id ?? null,
      can_settle_with_receipt: b?.can_settle_with_receipt ?? false,
      tags: tags ? tags.map(ct => ct.tag_id) : null,
      business_trip_id: tripByCharge.get(c.id) ?? null,
      ledger_count: l?.ledger_count ?? null,
      ledger_financial_entities: l ? [...l.ledger_financial_entities] : null,
      ledger_min_value_date: l?.min_value_date ?? null,
      ledger_max_value_date: l?.max_value_date ?? null,
      ledger_min_invoice_date: l?.min_invoice_date ?? null,
      ledger_max_invoice_date: l?.max_invoice_date ?? null,
      securities_executions_min_date: se?.min_date ?? null,
      securities_executions_max_date: se?.max_date ?? null,
      years_of_relevance: y ? y.map(cs => cs.year_of_relevance) : null,
      invoice_payment_currency_diff: c.invoice_payment_currency_diff,
      type: c.type,
      optional_vat: c.optional_vat,
      no_invoices_required: b?.no_invoices_required ?? false,
      documents_optional_flag: c.documents_optional_flag,
    };
  });
  type Enriched = (typeof enriched)[number];

  // WHERE (each `$flag = 0 OR ...` / `$flag = FALSE OR ...` passes the row when its condition is true)
  const date = (value: string | null | void) => (value == null ? null : toDateString(value));
  const fromDate = date(p.fromDate);
  const fromAnyDate = date(p.fromAnyDate);
  const toDate = date(p.toDate);
  const toAnyDate = date(p.toAnyDate);
  const isZero = (count: string | null) => count == null || Number(count) === 0;
  const passes = (ec: Enriched): Bool3 =>
    and3(
      p.isBusinessIds === 0 || overlaps(ec.business_array, p.businessIds),
      p.isExcludedBusinessIds === 0 ||
        not3(overlaps(ec.business_array, p.excludedBusinessIds) ?? false),
      fromDate == null
        ? true
        : cmpDate(
            coalesce(
              ec.documents_min_date,
              ec.transactions_min_event_date,
              ec.securities_executions_min_date,
            ),
            fromDate,
            (x, y) => x >= y,
          ),
      fromAnyDate == null
        ? true
        : cmpDate(
            greatestDate(
              ec.documents_max_date,
              ec.transactions_max_event_date,
              ec.transactions_max_debit_date,
              ec.ledger_max_invoice_date,
              ec.ledger_max_value_date,
              ec.securities_executions_max_date,
            ),
            fromAnyDate,
            (x, y) => x >= y,
          ),
      toDate == null
        ? true
        : cmpDate(
            coalesce(
              ec.documents_max_date,
              ec.transactions_max_event_date,
              ec.securities_executions_max_date,
            ),
            toDate,
            (x, y) => x <= y,
          ),
      toAnyDate == null
        ? true
        : cmpDate(
            leastDate(
              ec.documents_min_date,
              ec.transactions_min_event_date,
              ec.transactions_min_debit_date,
              ec.ledger_min_invoice_date,
              ec.ledger_min_value_date,
              ec.securities_executions_min_date,
            ),
            toAnyDate,
            (x, y) => x <= y,
          ),
      or3(
        eqText(p.chargeType, 'ALL'),
        and3(
          eqText(p.chargeType, 'INCOME'),
          ec.transactions_event_amount == null
            ? null
            : Numeric.of(ec.transactions_event_amount).gt(0),
        ),
        and3(
          eqText(p.chargeType, 'EXPENSE'),
          ec.transactions_event_amount == null
            ? null
            : !Numeric.of(ec.transactions_event_amount).gt(0),
        ),
      ),
      p.type == null || (ec.type == null ? null : ec.type === p.type),
      p.withoutInvoice === false || isZero(ec.invoices_count),
      p.withoutReceipt === false ||
        (isZero(ec.receipts_count) && ec.no_invoices_required === false),
      p.withoutDocuments === false || isZero(ec.documents_count),
      p.withoutTransactions === false || isZero(ec.transactions_count),
      p.withOpenDocuments === false || ec.open_docs_flag === true,
      p.withoutLedger === false || isZero(ec.ledger_count),
      p.isAccountantStatuses === 0 || anyEquals(ec.accountant_status, p.accountantStatuses),
      p.isTags === 0 || overlaps(ec.tags, p.tags),
      p.isExcludedTags === 0 || not3(overlaps(ec.tags, p.excludedTags) ?? false),
      p.withoutTags === false || (ec.tags?.length ?? 0) === 0,
      p.isBusinessTripIds === 0 || anyEquals(ec.business_trip_id, p.businessTripIds),
      p.isAccountIds === 0 || overlaps(ec.account_array, p.accountIds),
      p.isExcludedAccountIds === 0 ||
        not3(overlaps(ec.account_array, p.excludedAccountIds) ?? false),
      p.withMissingCounterparty === false ||
        ec.missing_counterparty_transactions === true ||
        ec.missing_counterparty_documents === true,
    );
  const matching = enriched.filter(ec => passes(ec) === true);

  // ORDER BY
  const asc = p.asc ?? null;
  const sortColumn = p.sortColumn ?? null;
  const eventDateKey = (ec: Enriched) => [
    coalesce(
      ec.transactions_min_debit_date,
      ec.transactions_min_event_date,
      ec.documents_min_date,
      ec.ledger_min_value_date,
      ec.ledger_min_invoice_date,
      ec.securities_executions_min_date,
    ),
    coalesce(ec.documents_min_date, ec.transactions_min_event_date),
    ec.id,
  ];
  const absAmount = (ec: Enriched) =>
    ec.event_amount == null ? null : Numeric.of(ec.event_amount).abs().toString();
  let primary: ((x: Enriched, y: Enriched) => number) | null = null;
  if (sortColumn === 'event_date' && asc !== null) {
    primary = (x, y) =>
      compareRecord(eventDateKey(x), eventDateKey(y), [compareText, compareText, compareUuid]);
  } else if (sortColumn === 'event_amount' && asc !== null) {
    primary = (x, y) =>
      compareRecord([x.event_amount, x.id], [y.event_amount, y.id], [compareNumeric, compareUuid]);
  } else if (sortColumn === 'abs_event_amount' && asc !== null) {
    primary = (x, y) => compareRecord([absAmount(x)], [absAmount(y)], [compareNumeric]);
  }
  const ordered = [...matching].sort((x, y) => {
    if (primary) {
      const c = primary(x, y);
      if (c !== 0) return asc ? c : -c;
    }
    return compareUuid(x.id, y.id);
  });

  const totalCount = String(matching.length);
  return limitOffset(ordered, p.limit ?? null, p.offset ?? null).map(
    (ec): IGetChargesByFiltersResult =>
      ({
        ...ec,
        abs_event_amount: absAmount(ec),
        total_count: totalCount,
      }) as never,
  );
});

/** `a <op> b` on dates with NULL as unknown. */
function cmpDate(a: string | null, b: string, op: (x: string, y: string) => boolean): Bool3 {
  return a == null ? null : op(a, b);
}

/** `$param = 'literal'` with a NULL parameter as unknown. */
function eqText(param: string | null | void, literal: string): Bool3 {
  return param == null ? null : param === literal;
}

// =============================================================================================
// getSimilarCharges
// =============================================================================================

/**
 * The owner's charges that look like a given one: same single main business, or exactly the same
 * set of businesses; optionally only those missing tags / a description, or whose tags /
 * description differ from given ones. Ordered by their first date, newest first.
 *
 *   WITH owner_charges AS (SELECT c.* FROM charges c WHERE c.owner_id = $ownerId),
 *        transactions_by_charge, documents_by_charge, businesses_by_charge, tags_by_charge,
 *        ledger_by_charge  (as in getChargesByFilters, without misc expenses)
 *   SELECT c.* FROM owner_charges c LEFT JOIN ... LEFT JOIN businesses b
 *     ON b.id = bbc.filtered_business_array[1] AND array_length(bbc.filtered_business_array, 1) = 1
 *   WHERE ($withMissingTags IS NOT TRUE OR tgc.tags_array IS NULL)
 *     AND ($withMissingDescription IS NOT TRUE OR c.user_description IS NULL)
 *     AND ($tagsDifferentThan::UUID[] IS NULL OR NOT (tags @> $tagsDifferentThan AND tags <@ $tagsDifferentThan))
 *     AND ($descriptionDifferentThan::TEXT IS NULL OR c.user_description IS DISTINCT FROM $descriptionDifferentThan)
 *     AND ((b.id IS NOT NULL AND b.id = $businessId)
 *          OR (bbc.business_array IS NOT NULL AND bbc.business_array @> $businessArray AND bbc.business_array <@ $businessArray))
 *   ORDER BY (COALESCE(documents min date, min debit date, min event date, ledger min value date,
 *             ledger min invoice date), COALESCE(min event date, documents min date), c.id) DESC
 */
export const getSimilarCharges = port<IGetSimilarChargesQuery>(async (p, db) => {
  const ownerId = p.ownerId ?? null;
  const [allCharges, transactions, documents, businesses, ledgerRecords, chargeTags] =
    await Promise.all([
      db.rows('charges'),
      db.rows('transactions'),
      db.rows('documents'),
      db.rows('businesses'),
      db.rows('ledger_records'),
      db.rows('charge_tags'),
    ]);
  const ownerCharges = allCharges.filter(c => ownerId != null && c.owner_id === ownerId);
  const ids = new Set(ownerCharges.map(c => c.id));
  const ownerOf = new Map(ownerCharges.map(c => [c.id, c.owner_id]));

  const tbc = transactionsByCharge(transactions, ids);
  // documents_by_charge: only its dates reach the result, and the businesses join cannot repeat a
  // document (one side of a document is the owner), so the dates are over the charge's documents.
  const dbc = new Map<
    string,
    { min_event_date: string | null; min_any_event_date: string | null }
  >();
  for (const [chargeId, rows] of groupByKey(
    documents.filter(d => d.charge_id != null && ids.has(d.charge_id)),
    d => d.charge_id!,
  )) {
    dbc.set(chargeId, {
      min_event_date: minDate(rows.filter(d => ACCOUNTING_TYPES.has(d.type)).map(d => d.date)),
      min_any_event_date: minDate(rows.map(d => d.date)),
    });
  }
  const triples: [string, string | null, boolean][] = [];
  for (const t of transactions)
    if (ids.has(t.charge_id)) triples.push([t.charge_id, t.business_id, t.is_fee]);
  for (const d of documents)
    if (d.charge_id != null && ids.has(d.charge_id))
      triples.push([d.charge_id, d.creditor_id, false]);
  for (const d of documents)
    if (d.charge_id != null && ids.has(d.charge_id))
      triples.push([d.charge_id, d.debtor_id, false]);
  for (const l of ledgerRecords) {
    if (!ids.has(l.charge_id)) continue;
    triples.push([l.charge_id, l.credit_entity1, true]);
    triples.push([l.charge_id, l.credit_entity2, true]);
    triples.push([l.charge_id, l.debit_entity1, true]);
    triples.push([l.charge_id, l.debit_entity2, true]);
  }
  const bbc = businessesByCharge(triples, id => ownerOf.get(id)!);
  const tagsByCharge = groupByKey(
    chargeTags.filter(ct => ids.has(ct.charge_id)),
    ct => ct.charge_id,
  );
  const lbc = ledgerByCharge(ledgerRecords, ids);
  const businessIds = new Set(businesses.map(b => b.id));

  const tagsDifferentThan = p.tagsDifferentThan ?? null;
  const descriptionDifferentThan = p.descriptionDifferentThan ?? null;
  const businessArray = p.businessArray ?? null;
  const businessId = p.businessId ?? null;

  const rows = ownerCharges.flatMap(c => {
    const bb = bbc.get(c.id);
    const bId =
      bb &&
      bb.filtered_business_array.length === 1 &&
      businessIds.has(bb.filtered_business_array[0]!)
        ? bb.filtered_business_array[0]!
        : null;
    const tags = tagsByCharge.get(c.id)?.map(ct => ct.tag_id) ?? null;
    const pass = and3(
      p.withMissingTags !== true || tags == null,
      p.withMissingDescription !== true || c.user_description == null,
      tagsDifferentThan == null ||
        not3(and3(arrayContains(tags, tagsDifferentThan), arrayContains(tagsDifferentThan, tags))),
      descriptionDifferentThan == null || c.user_description !== descriptionDifferentThan,
      or3(
        bId == null ? false : businessId == null ? null : bId === businessId,
        bb == null
          ? false
          : and3(
              arrayContains(bb.business_array, businessArray),
              arrayContains(businessArray, bb.business_array),
            ),
      ),
    );
    if (pass !== true) return [];
    const t = tbc.get(c.id);
    const d = dbc.get(c.id);
    const l = lbc.get(c.id);
    const documentsMin = d ? (d.min_event_date ?? d.min_any_event_date) : null;
    const key = [
      coalesce(
        documentsMin,
        t?.min_debit_date,
        t?.min_event_date,
        l?.min_value_date,
        l?.min_invoice_date,
      ),
      coalesce(t?.min_event_date, documentsMin),
      c.id,
    ];
    return [{ c, key }];
  });
  rows.sort((x, y) => -compareRecord(x.key, y.key, [compareText, compareText, compareUuid]));
  return rows.map(r => r.c);
});
