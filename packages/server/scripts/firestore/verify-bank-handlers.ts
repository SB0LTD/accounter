/**
 * Proves the raw bank/card AFTER INSERT handlers (src/firestore/hooks/bank-handlers.ts) against the
 * PL/pgSQL triggers they port.
 *
 *   POSTGRES_HOST=localhost POSTGRES_PORT=54329 POSTGRES_DB=<your verify db> \
 *     tsx scripts/firestore/verify-bank-handlers.ts [--only <table substring>] [--verbose]
 *
 * The query harness (verify.ts) compares a statement's RETURNING rows only; a trigger's work is
 * invisible to it. Here each scenario inserts realistic raw rows into one raw table on both sides
 * and compares everything the inserts wrote to `transactions_raw_list`, `charges` and
 * `transactions`:
 *
 * - Postgres: inside a transaction that is rolled back, as the RLS-bound role with the same
 *   `app.*` settings as verify.ts (so the triggers run as the invoker, under RLS);
 * - the store: through a Transaction + queryDb, rolled back too.
 *
 * New rows are found by diffing each table's ids before and after the inserts. Generated ids and
 * timestamps are masked; the links between the rows are compared structurally: a transaction's
 * `source_id` by the raw row its raw-list entry files, its `charge_id` by the existing charge it
 * joined or by which new charge (numbered by the transactions that use it). A scenario that must
 * fail compares the SQLSTATE. Each scenario also checks that Postgres took the branch it is
 * named after, so a scenario that silently stops exercising its branch fails.
 *
 * Needs scripts/firestore/fixtures/030-scraper-ingestion.sql. Refuses any database host but
 * localhost.
 */
import pg from 'pg';
import { allTables, tableInfo, type AnyRow, type TableName } from '../../src/firestore/catalog.js';
import { queryDb } from '../../src/firestore/query-db.js';
import { memoryStore } from '../../src/firestore/store.js';
import type { SessionContext } from '../../src/firestore/transaction.js';
import { docIdFor, encodeRow } from '../../src/firestore/values.js';
import { pgTypeParsers } from '../../src/shared/helpers/pg-type-parsers.js';

process.env.TZ = 'UTC';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const verbose = args.includes('--verbose');

const host = process.env.POSTGRES_HOST ?? 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`verify-bank-handlers only runs against a local database (POSTGRES_HOST=${host})`);
  process.exit(2);
}

const ROLE = 'accounter_verify';
const SIDE_TABLES = ['transactions_raw_list', 'charges', 'transactions'] as const;
type SideTable = (typeof SIDE_TABLES)[number];

/** Fixture ids (scripts/firestore/fixtures/030-scraper-ingestion.sql). */
const FIXTURE = {
  conversionLeg: '0f030000-0000-4000-8000-000000000109',
  swiftTransfer: '0f030000-0000-4000-8000-000000000110',
};

const rawId = (n: number) => `0f030000-0000-4000-8000-${String(900 + n).padStart(12, '0')}`;

// ---------------------------------------------------------------------------------------------
// What a scenario wrote, normalised so both sides compare
// ---------------------------------------------------------------------------------------------

interface Effects {
  error: string | null;
  rawList: AnyRow[];
  charges: AnyRow[];
  transactions: AnyRow[];
}

const RAW_SOURCE_COLUMNS = [
  'creditcard_id',
  'poalim_ils_id',
  'kraken_id',
  'etana_id',
  'etherscan_id',
  'poalim_swift_id',
  'amex_id',
  'cal_id',
  'bank_discount_id',
  'max_creditcard_id',
  'poalim_foreign_id',
  'otsar_hahayal_ils_id',
  'otsar_hahayal_foreign_id',
  'otsar_hahayal_creditcard_id',
];

function plain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value;
}

/** `<column>=<raw id>` for a raw-list row: what it files. */
function rawLabel(row: AnyRow): string {
  const column = RAW_SOURCE_COLUMNS.find(c => row[c] != null);
  return column ? `${column}=${String(row[column])}` : 'empty';
}

function normalise(
  error: string | null,
  rawList: AnyRow[],
  charges: AnyRow[],
  transactions: AnyRow[],
  allRawList: Map<string, AnyRow>,
): Effects {
  if (error) return { error, rawList: [], charges: [], transactions: [] };
  const newCharges = new Map(charges.map(c => [c.id as string, c]));
  const sortedTransactions = [...transactions].sort((a, b) =>
    String(a.origin_key).localeCompare(String(b.origin_key)),
  );
  // New charges are numbered by the first (by origin_key) new transaction that uses them.
  const chargeLabel = new Map<string, string>();
  for (const t of sortedTransactions) {
    const id = t.charge_id as string;
    if (newCharges.has(id) && !chargeLabel.has(id))
      chargeLabel.set(id, `new#${chargeLabel.size + 1}`);
  }
  const strip = (row: AnyRow, drop: string[]) =>
    Object.fromEntries(
      Object.keys(row)
        .filter(k => !drop.includes(k))
        .sort()
        .map(k => [k, plain(row[k])]),
    );
  return {
    error: null,
    rawList: rawList.map(r => strip(r, ['id'])).sort(byJson),
    charges: charges
      .map(c => ({
        label: chargeLabel.get(c.id as string) ?? 'new-unused',
        ...strip(c, ['id', 'created_at', 'updated_at']),
      }))
      .sort(byJson),
    transactions: sortedTransactions.map(t => {
      const source = allRawList.get(t.source_id as string);
      const charge = t.charge_id as string;
      return {
        ...strip(t, ['id', 'created_at', 'updated_at']),
        source_id: source ? `raw:${rawLabel(source)}` : `unknown:${t.source_id}`,
        charge_id: chargeLabel.get(charge) ?? `existing:${charge}`,
      };
    }),
  };
}

const byJson = (a: unknown, b: unknown) => JSON.stringify(a).localeCompare(JSON.stringify(b));

// ---------------------------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------------------------

interface Scenario {
  table: TableName;
  name: string;
  /** Rows inserted first, into other raw tables, in the same transaction. */
  before?: { table: TableName; row: AnyRow }[];
  rows: AnyRow[];
  /** A check on Postgres's effects: the branch this scenario is about was taken. */
  expect: (effects: Effects) => string | null;
}

const expectError =
  (code: string) =>
  (e: Effects): string | null =>
    e.error?.startsWith(code) ? null : `expected ${code}, got ${e.error ?? 'success'}`;

const expectFiled =
  (count: number, check?: (transactions: AnyRow[], e: Effects) => string | null) =>
  (e: Effects): string | null => {
    if (e.error) return `expected success, got ${e.error}`;
    if (e.transactions.length !== count || e.rawList.length !== count) {
      return `expected ${count} filed rows, got ${e.rawList.length} raw-list / ${e.transactions.length} transactions`;
    }
    return check ? check(e.transactions, e) : null;
  };

const all =
  (...checks: ((t: AnyRow[], e: Effects) => string | null)[]) =>
  (t: AnyRow[], e: Effects) => {
    for (const check of checks) {
      const problem = check(t, e);
      if (problem) return problem;
    }
    return null;
  };

const field =
  (index: number, column: string, value: unknown) =>
  (t: AnyRow[]): string | null =>
    JSON.stringify(t[index]?.[column]) === JSON.stringify(value)
      ? null
      : `transaction ${index}: ${column} = ${JSON.stringify(t[index]?.[column])}, expected ${JSON.stringify(value)}`;

const newCharges =
  (count: number) =>
  (_t: AnyRow[], e: Effects): string | null =>
    e.charges.length === count ? null : `expected ${count} new charges, got ${e.charges.length}`;

const joins =
  (index: number, chargeLabel: string) =>
  (t: AnyRow[]): string | null =>
    t[index]?.charge_id === chargeLabel
      ? null
      : `transaction ${index}: charge ${String(t[index]?.charge_id)}, expected ${chargeLabel}`;

const chargeType =
  (label: string, type: string | null) =>
  (_t: AnyRow[], e: Effects): string | null => {
    const charge = e.charges.find(c => c.label === label);
    return charge?.type === type
      ? null
      : `charge ${label}: type ${String(charge?.type)}, expected ${type}`;
  };

/** 'דמי כרטיס הנחה' */
const CARD_FEE_LINE = 'דמי כרטיס הנחה';

function scenarios(tenant: string): Scenario[] {
  const cal = (n: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    card: 4580,
    trn_int_id: `VBH-CAL-${n}`,
    merchant_name: 'Book Store',
    trn_purchase_date: '12/11/2026',
    trn_amt: '19.90',
    trn_currency_symbol: 'USD',
    deb_crd_date: '10/12/2026',
    merchant_id: 'M-88',
    ...o,
  });

  const discount = (n: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    operation_date: '12/11/2026',
    value_date: '13/11/2026',
    operation_description: 'Salary',
    operation_branch: 7,
    operation_bank: 11,
    account_number: '0301234567',
    operation_amount: '-8000.00',
    balance_after_operation: '13000.50',
    operation_number: 4321,
    urn: `VBH-URN-${n}`,
    ...o,
  });

  const max = (n: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    actual_payment_amount: '250.50',
    arn: `ARN-VBH-${n}`,
    card_index: 0,
    category_id: 3,
    comments: '',
    deal_data_acq: 'ACQ',
    deal_data_adjustment_type: '0.00',
    deal_data_amount: '250.50',
    deal_data_amount_ils: '250.50',
    deal_data_amount_left: '0.00',
    deal_data_arn: 'ARN',
    deal_data_authorization_number: 'AUTH',
    deal_data_commission_vat: '0.00',
    deal_data_exchange_direct: 'D',
    deal_data_exchange_rate: '1.25',
    deal_data_interest_amount: '0.00',
    deal_data_is_allowed_spread_with_benefit: '0',
    deal_data_issuer_currency: 'ILS',
    deal_data_plan: '5.00',
    deal_data_pos_entry_emv: '0.00',
    deal_data_processing_date: '2026-11-12',
    deal_data_purchase_time: '09:15:30',
    deal_data_ref_nbr: 'REF',
    deal_data_show_cancel_debit: '0',
    deal_data_show_spread: '0',
    deal_data_show_spread_benefit_button: '0',
    deal_data_show_spread_button: '0',
    deal_data_show_spread_for_leumi: '0',
    deal_data_tdm_card_token: 'TOK',
    deal_data_tdm_transaction_type: 0,
    deal_data_transaction_type: 1,
    deal_data_txn_code: 2,
    deal_data_user_name: 'user',
    ethoca_ind: '0',
    is_register_ch: '0',
    is_spreading_autorization_allowed: '1',
    issuer_id: 1,
    merchant_max_phone: '0',
    merchant: 'IKEA',
    merchant_number: 'M-200',
    merchant_phone: '09-5555555',
    merchant_tax_id: '',
    merchant_name: 'Ikea Netanya',
    original_amount: '250.50',
    original_currency: 'ILS',
    payment_date: '2026-12-10',
    plan_name: 'regular',
    plan_type_id: 1,
    promotion_club: 'none',
    purchase_date: '2026-11-12',
    ref_index: 8,
    runtime_reference_internal_id: 'RT',
    runtime_reference_type: 1,
    short_card_number: '9876',
    spread_transaction_by_campain_ind: '0',
    table_type: 1,
    uid: `VBH-MAX-${n}`,
    user_index: 1,
    ...o,
  });

  const card = (n: number, cardNumber: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    card: cardNumber,
    card_index: 0,
    supplier_id: 9002,
    supplier_name: 'PHARM',
    full_purchase_date: '07/11/2026',
    voucher_number: 555000 + n,
    currency_id: 'ש"ח',
    current_payment_currency: 'ILS',
    full_payment_date: '10/12/2026',
    deal_sum: '64.30',
    payment_sum: '64.30',
    full_supplier_name_heb: 'SUPER PHARM',
    is_horaat_keva: 'false',
    table_page_num: '0',
    is_error: 'false',
    is_captcha: 'false',
    is_button: 'false',
    ...o,
  });
  const cardAbroad = (n: number, cardNumber: number, o: AnyRow = {}): AnyRow =>
    card(n, cardNumber, {
      supplier_id: 0,
      supplier_name: null,
      full_purchase_date: null,
      full_purchase_date_outbound: '08/11/2026',
      voucher_number: null,
      voucher_number_ratz: 888000 + n,
      currency_id: 'דולר',
      current_payment_currency: 'USD',
      city: 'LONDON',
      supplier_name_outbound: 'GITHUB',
      full_supplier_name_outbound: 'GITHUB INC',
      deal_sum: null,
      payment_sum: null,
      full_supplier_name_heb: null,
      deal_sum_outbound: '21.00',
      payment_sum_outbound: '21.00',
      ...o,
    });

  const cardScenarios = (table: TableName, cardNumber: number, base: number): Scenario[] => [
    {
      table,
      name: 'domestic purchase: Hebrew supplier name, supplier id as counter account, ש"ח → ILS',
      rows: [card(base, cardNumber)],
      expect: expectFiled(
        1,
        all(
          field(0, 'source_description', 'SUPER PHARM'),
          field(0, 'counter_account', '9002'),
          field(0, 'currency', 'ILS'),
          field(0, 'amount', '-64.30'),
        ),
      ),
    },
    {
      table,
      name: 'abroad purchase: outbound name + /city, outbound date and sum, ratz voucher, דולר → USD',
      rows: [
        cardAbroad(base + 1, cardNumber),
        cardAbroad(base + 2, cardNumber, {
          city: null,
          currency_id: null,
          full_payment_date: null,
          charging_date: '15/12/2026',
          supplier_id: null,
        }),
      ],
      expect: expectFiled(
        2,
        all(
          field(0, 'source_description', 'GITHUB INC/LONDON'),
          field(0, 'counter_account', 'GITHUB INC'),
          field(0, 'currency', 'USD'),
          field(1, 'source_description', 'GITHUB INC'),
          field(1, 'currency', 'ILS'),
          field(1, 'debit_date', '2026-12-15'),
        ),
      ),
    },
    {
      table,
      name: 'summary and zero card-fee lines are not filed (NULL payment sum keeps a fee line out too)',
      rows: [
        cardAbroad(base + 3, cardNumber, { full_supplier_name_outbound: 'TOTAL FOR DATE' }),
        cardAbroad(base + 4, cardNumber, { full_supplier_name_outbound: 'CASH ADVANCE FEE' }),
        card(base + 5, cardNumber, { supplier_name: 'סך חיוב בש"ח:' }),
        card(base + 6, cardNumber, { supplier_name: CARD_FEE_LINE, payment_sum: '0.00' }),
        card(base + 7, cardNumber, {
          supplier_name: CARD_FEE_LINE,
          payment_sum: null,
          payment_sum_outbound: '3.00',
        }),
        card(base + 8, cardNumber, { supplier_name: CARD_FEE_LINE, payment_sum: '5.00' }),
      ],
      expect: expectFiled(1, field(0, 'amount', '-5.00')),
    },
    {
      table,
      name: 'both supplier names set → NULL description',
      rows: [card(base + 9, cardNumber, { full_supplier_name_outbound: 'X' })],
      expect: expectFiled(1, field(0, 'source_description', null)),
    },
    {
      table,
      name: 'both purchase dates set → NULL event_date (23502)',
      rows: [card(base + 10, cardNumber, { full_purchase_date_outbound: '08/11/2026' })],
      expect: expectError('23502'),
    },
    {
      table,
      name: 'no account for the card → the charge has no owner (42501)',
      rows: [card(base + 11, 4321)],
      expect: expectError('42501'),
    },
  ];

  const otsarCard = (n: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    owner_id: tenant,
    resource_id: '0f030000-0000-4000-8000-000000000201',
    masked_pan: '5326-1111',
    card_type: 1,
    billing_period: '2026-11',
    date: '2026-11-09',
    charge_date: '2026-12-10',
    name: ' Restaurant ',
    deal_amount: '30.5',
    charge_amount: '112.75',
    notes: 'dinner',
    wallet_type: 0,
    charge_currency: 'דולר ארה"ב',
    deal_currency: 'USD',
    counter: n,
    ...o,
  });

  const otsarForeign = (n: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    owner_id: tenant,
    account: 778899,
    branch: 12,
    account_type: 'EUR-ACC',
    currency: 'EUR',
    opening_balance: '200',
    balance: '275.5',
    value_date: '2026-11-09',
    credit: '75.5',
    debit: '0',
    description: 'Incoming transfer',
    reference: `VBH-${n}`,
    date: '2026-11-08',
    sub_transactions: '[]',
    ...o,
  });

  const otsarIls = (n: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    owner_id: tenant,
    account_number: 445566,
    account_type: 1,
    branch_number: 12,
    action_code: 7,
    bfb_source: 'BFB',
    closing_balance: '1500.25',
    correspondent_account: 98765,
    correspondent_account_type: 3,
    correspondent_bank: 10,
    correspondent_branch: 800,
    credit_amount: '500.25',
    customer_name: 'Client Co',
    date_of_business_day: '2026-11-09T00:00:00Z',
    date_of_registration: '2026-11-08T00:00:00Z',
    debit_amount: '0',
    depositor_id: 0,
    description: '  העברה  ',
    drill_down_url: '',
    first_transaction_of_day: false,
    last_transaction_of_day: true,
    name: 'Client Co',
    opening_balance: '1000',
    operation_source: 'branch',
    reference: 400 + n,
    salary_ind: 0,
    transaction_source: 'bank',
    transaction_reason: 'invoice 7',
    origin_reference: '',
    ...o,
  });

  const foreign = (n: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    executing_date: '2026-11-09',
    formatted_executing_date: '2026-11-09T00:00:00',
    value_date: '2026-11-09',
    formatted_value_date: '2026-11-09T00:00:00',
    original_system_id: 100,
    activity_description: 'Transfer',
    event_amount: '100.00',
    currency: 'USD',
    current_balance: '15975.00',
    reference_catenated_number: 0,
    reference_number: 8000 + n,
    currency_rate: '3.7000000',
    event_details: null,
    rate_fixing_code: 0,
    contra_currency_code: 1,
    event_activity_type_code: 1,
    transaction_type: 'REGULAR',
    rate_fixing_short_description: 'none',
    currency_long_description: 'US Dollar',
    activity_type_code: 650,
    event_number: n,
    validity_date: '2026-11-09',
    comment_existence_switch: '0',
    account_name: 'Demo Ltd',
    contra_bank_number: 0,
    contra_branch_number: 0,
    contra_account_number: 0,
    original_event_key: '0',
    data_group_code: '0',
    currency_swift_code: 'USD',
    bank_number: 12,
    branch_number: 12,
    account_number: 112233,
    ...o,
  });

  const ils = (n: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    event_date: '2026-11-09',
    formatted_event_date: '2026-11-09T00:00:00',
    serial_number: n,
    activity_type_code: 100,
    activity_description: 'Transfer',
    text_code: 1,
    reference_number: String(9000 + n),
    reference_catenated_number: 0,
    value_date: '2026-11-09',
    formatted_value_date: '2026-11-09T00:00:00',
    event_amount: '12.50',
    event_activity_type_code: 2,
    current_balance: '9907.50',
    internal_link_code: 0,
    original_event_create_date: 20261109,
    transaction_type: 'REGULAR',
    data_group_code: 0,
    expanded_event_date: '20261109',
    executing_branch_number: 12,
    event_id: String(9002000 + n),
    different_date_indication: '0',
    table_number: 1,
    record_number: n,
    contra_bank_number: 10,
    contra_branch_number: 900,
    contra_account_number: 5544,
    contra_account_type_code: 0,
    marketing_offer_context: '0',
    comment_existence_switch: '0',
    field_desc_display_switch: '0',
    english_action_desc: null,
    beneficiary_details_data_party_name: null,
    beneficiary_details_data_message_detail: null,
    bank_number: 12,
    branch_number: 12,
    account_number: 112233,
    ...o,
  });

  const swift = (n: number, o: AnyRow = {}): AnyRow => ({
    id: rawId(n),
    account_number: 112233,
    branch_number: 12,
    bank_number: 12,
    start_date: '20261109',
    formatted_start_date: '2026-11-09T00:00:00',
    amount: '-1000',
    charge_party_name: 'UMBRELLA CORPORATION',
    reference_number: `SW-${n}`,
    transfer_catenated_id: `VBH-SWIFT-${n}`,
    swift_value_date_currency_amount_32a: '261109USD990,00',
    swift_currency_instructed_amount_33b: 'USD1000,00',
    swift_exchange_rate_36: ' ',
    swift_remittance_information_70: 'Invoice 43',
    ...o,
  });

  return [
    // ----- Cal
    {
      table: 'cal_creditcard_transactions',
      name: 'card purchase: merchant id as counter account, else merchant name; DD/MM/YYYY dates',
      rows: [cal(1), cal(2, { merchant_id: null, trn_amt: '-5.13', trn_currency_symbol: 'ILS' })],
      expect: expectFiled(
        2,
        all(
          field(0, 'counter_account', 'M-88'),
          field(0, 'amount', '-19.90'),
          field(0, 'event_date', '2026-11-12'),
          field(1, 'counter_account', 'Book Store'),
          field(1, 'amount', '5.13'),
          newCharges(2),
        ),
      ),
    },
    {
      table: 'cal_creditcard_transactions',
      name: 'unknown currency symbol → 22P02',
      rows: [cal(3, { trn_currency_symbol: 'NIS' })],
      expect: expectError('22P02'),
    },
    {
      table: 'cal_creditcard_transactions',
      name: 'no account for the card → 42501',
      rows: [cal(4, { card: 1111 })],
      expect: expectError('42501'),
    },

    // ----- Bank Discount
    {
      table: 'bank_discount_transactions',
      name: 'operation number → bank-branch-number counter account; 0 / NULL → none',
      rows: [
        discount(10),
        discount(11, { operation_number: 0, operation_amount: '12.30' }),
        discount(12, { operation_number: null, operation_bank: null }),
      ],
      expect: expectFiled(
        3,
        all(
          field(0, 'counter_account', '11-7-4321'),
          field(0, 'amount', '8000.00'),
          field(0, 'current_balance', '13000.50'),
          field(1, 'counter_account', null),
          field(2, 'counter_account', null),
        ),
      ),
    },
    {
      table: 'bank_discount_transactions',
      name: 'to_date out of range → 22008',
      rows: [discount(13, { value_date: '2026-11-13' })],
      expect: expectError('22008'),
    },

    // ----- Max
    {
      table: 'max_creditcard_transactions',
      name: 'payment: name | comments, empty tax id → merchant name, payment date + purchase time',
      rows: [
        max(20),
        max(21, { merchant_tax_id: '515151515', deal_data_purchase_time: null, comments: 'note' }),
      ],
      expect: expectFiled(
        2,
        all(
          field(0, 'source_description', 'Ikea Netanya | '),
          field(0, 'counter_account', 'Ikea Netanya'),
          field(0, 'debit_timestamp', '2026-12-10T09:15:30.000Z'),
          field(0, 'currency_rate', '1.25'),
          field(1, 'counter_account', '515151515'),
          field(1, 'debit_timestamp', null),
        ),
      ),
    },
    {
      table: 'max_creditcard_transactions',
      name: 'no account for the card → RAISE (P0001)',
      rows: [max(22, { short_card_number: '1111' })],
      expect: expectError('P0001'),
    },
    {
      table: 'max_creditcard_transactions',
      name: 'not ILS → RAISE (P0001)',
      rows: [max(23, { original_currency: 'USD' })],
      expect: expectError('P0001'),
    },

    // ----- Isracard and Amex
    ...cardScenarios('isracard_creditcard_transactions', 1234, 30),
    ...cardScenarios('amex_creditcard_transactions', 5678, 50),

    // ----- Otsar Hahayal credit card
    {
      table: 'otsar_hahayal_creditcard_transactions',
      name: 'card fee flagged, names trimmed, NULLIF on empty notes; ILS / USD / EUR',
      rows: [
        otsarCard(70, { name: 'דמי כרטיס חודשיים', notes: '', charge_currency: 'שקל חדש' }),
        otsarCard(71),
        otsarCard(72, { charge_currency: 'אירו', name: '  ', notes: '  ' }),
      ],
      expect: expectFiled(
        3,
        all(
          field(0, 'is_fee', true),
          field(0, 'currency', 'ILS'),
          field(0, 'source_description', 'דמי כרטיס חודשיים'),
          field(1, 'source_description', 'Restaurant dinner'),
          field(1, 'currency', 'USD'),
          field(1, 'amount', '-112.75'),
          field(2, 'source_description', null),
          field(2, 'currency', 'EUR'),
        ),
      ),
    },
    {
      table: 'otsar_hahayal_creditcard_transactions',
      name: 'unknown charge currency → RAISE',
      rows: [otsarCard(73, { charge_currency: 'ין' })],
      expect: expectError('P0001'),
    },
    {
      table: 'otsar_hahayal_creditcard_transactions',
      name: 'card account without an owner → RAISE',
      rows: [otsarCard(74, { masked_pan: '5326-2222' })],
      expect: expectError('P0001'),
    },

    // ----- Otsar Hahayal foreign
    {
      table: 'otsar_hahayal_foreign_account_transactions',
      name: 'credit; debit → negative amount and fee flag; NULL balance → 0; blank description → NULL',
      rows: [
        otsarForeign(80),
        otsarForeign(81, {
          credit: '0',
          debit: '4.20',
          balance: null,
          description: 'עמלת העברות SWIFT',
          currency: 'USD',
        }),
        otsarForeign(82, { description: '   ' }),
      ],
      expect: expectFiled(
        3,
        all(
          field(0, 'amount', '75.5'),
          field(0, 'is_fee', false),
          field(0, 'event_date', '2026-11-09'),
          field(0, 'debit_date', '2026-11-08'),
          field(1, 'amount', '-4.20'),
          field(1, 'is_fee', true),
          field(1, 'current_balance', '0'),
          field(2, 'source_description', null),
        ),
      ),
    },
    {
      table: 'otsar_hahayal_foreign_account_transactions',
      name: 'a card where a bank account is expected: the RAISE names a missing field (42703)',
      rows: [otsarForeign(83, { account: 778800 })],
      expect: expectError('42703'),
    },
    {
      table: 'otsar_hahayal_foreign_account_transactions',
      name: 'not a currency → 22P02',
      rows: [otsarForeign(84, { currency: 'XYZ' })],
      expect: expectError('22P02'),
    },

    // ----- Otsar Hahayal ILS
    {
      table: 'otsar_hahayal_ils_account_transactions',
      name: 'credit with correspondent account; FX-fee debit; description from four trimmed parts',
      rows: [
        otsarIls(90),
        otsarIls(91, {
          credit_amount: '0',
          debit_amount: '35.50',
          description: 'עמלת מטח ',
          correspondent_account: 0,
          name: '   ',
          customer_name: '',
          transaction_reason: ' x ',
        }),
      ],
      expect: expectFiled(
        2,
        all(
          field(0, 'counter_account', '10-800-98765 (3)'),
          field(0, 'source_description', 'Client Co Client Co העברה invoice 7'),
          field(0, 'event_date', '2026-11-08'),
          field(0, 'debit_date', '2026-11-09'),
          field(1, 'amount', '-35.50'),
          field(1, 'is_fee', true),
          field(1, 'counter_account', null),
          field(1, 'source_description', 'עמלת מטח x'),
        ),
      ),
    },
    {
      table: 'otsar_hahayal_ils_account_transactions',
      name: 'account without an owner → RAISE',
      rows: [otsarIls(92, { account_number: 445567 })],
      expect: expectError('P0001'),
    },

    // ----- Poalim foreign
    {
      table: 'poalim_foreign_account_transactions',
      name: 'conversion leg joins the fixture conversion (reference 555) charge',
      rows: [
        foreign(100, {
          executing_date: '2026-11-02',
          value_date: '2026-11-02',
          activity_type_code: 957,
          reference_number: 555,
          currency: 'EUR',
          event_amount: '920.00',
        }),
      ],
      expect: expectFiled(1, all(newCharges(0), joins(0, 'existing:<fixture conversion charge>'))),
    },
    {
      table: 'poalim_foreign_account_transactions',
      name: "conversion pair in one statement: the second leg joins the first one's new CONVERSION charge",
      rows: [
        foreign(101, { activity_type_code: 884, reference_number: 600 }),
        foreign(102, {
          activity_type_code: 1966,
          reference_number: 600,
          currency: 'EUR',
          event_activity_type_code: 2,
        }),
      ],
      expect: expectFiled(
        2,
        all(newCharges(1), joins(0, 'new#1'), joins(1, 'new#1'), chargeType('new#1', 'CONVERSION')),
      ),
    },
    {
      table: 'poalim_foreign_account_transactions',
      name: 'fees: 1279 within 0..30, 884 from system 390; 1279 above 30 is not; contra account',
      rows: [
        foreign(103, {
          activity_type_code: 1279,
          event_amount: '25.00',
          event_activity_type_code: 2,
        }),
        foreign(104, { activity_type_code: 1279, event_amount: '30.01' }),
        foreign(105, { activity_type_code: 884, original_system_id: 390, reference_number: 610 }),
        foreign(106, {
          contra_bank_number: 12,
          contra_branch_number: 600,
          contra_account_number: 12345,
          event_details: 'Rent',
          account_name: null,
        }),
      ],
      expect: expectFiled(
        4,
        all(
          field(0, 'is_fee', true),
          field(0, 'amount', '-25.00'),
          field(1, 'is_fee', false),
          field(2, 'is_fee', true),
          field(3, 'counter_account', '12-600-12345'),
          field(3, 'source_description', 'Transfer Rent'),
          chargeType('new#3', 'CONVERSION'),
        ),
      ),
    },
    {
      table: 'poalim_foreign_account_transactions',
      name: 'no account → 42501',
      rows: [foreign(107, { account_number: 999999 })],
      expect: expectError('42501'),
    },

    // ----- Poalim ILS
    {
      table: 'poalim_ils_account_transactions',
      name: 'conversion leg (text code 22) joins the fixture conversion charge',
      rows: [
        ils(110, {
          event_date: '2026-11-02',
          value_date: '2026-11-02',
          text_code: 22,
          reference_number: '555',
          event_amount: '3700.00',
          contra_account_number: 0,
        }),
      ],
      expect: expectFiled(1, all(newCharges(0), joins(0, 'existing:<fixture conversion charge>'))),
    },
    {
      table: 'poalim_ils_account_transactions',
      name: 'unmatched conversion (861) gets a CONVERSION charge; fee codes 452/105, 473/774, 471/617',
      rows: [
        ils(111, { text_code: 861, reference_number: '620' }),
        ils(112, { activity_type_code: 452, text_code: 105 }),
        ils(113, { activity_type_code: 473, text_code: 774 }),
        ils(114, { activity_type_code: 471, text_code: 617 }),
        ils(115, { activity_type_code: 471, text_code: 105, event_activity_type_code: 1 }),
      ],
      expect: expectFiled(
        5,
        all(
          chargeType('new#1', 'CONVERSION'),
          field(1, 'is_fee', true),
          field(2, 'is_fee', true),
          field(3, 'is_fee', true),
          field(4, 'is_fee', false),
          field(4, 'amount', '12.50'),
          field(0, 'counter_account', '10-900-5544'),
        ),
      ),
    },
    {
      table: 'poalim_ils_account_transactions',
      name: 'concat_ws description skips NULL parts',
      rows: [
        ils(116, {
          beneficiary_details_data_party_name: 'ACME',
          beneficiary_details_data_message_detail: null,
          english_action_desc: 'Wire',
        }),
      ],
      expect: expectFiled(1, field(0, 'source_description', 'Transfer ACME Wire')),
    },
    {
      table: 'poalim_ils_account_transactions',
      name: 'no account → 42501',
      rows: [ils(117, { account_number: 999999 })],
      expect: expectError('42501'),
    },

    // ----- Poalim ILS + foreign: a conversion filed ILS leg first
    {
      table: 'poalim_foreign_account_transactions',
      name: 'foreign leg matches an ILS leg filed earlier in the transaction (the UNION ALL ILS branch)',
      before: [
        {
          table: 'poalim_ils_account_transactions',
          row: ils(118, { text_code: 23, reference_number: '700', contra_account_number: 0 }),
        },
      ],
      rows: [foreign(108, { activity_type_code: 1058, reference_number: 700 })],
      expect: expectFiled(
        2,
        all(newCharges(1), joins(0, 'new#1'), joins(1, 'new#1'), chargeType('new#1', 'CONVERSION')),
      ),
    },
    {
      table: 'poalim_foreign_account_transactions',
      name: 'a conversion on another value date does not match',
      before: [
        {
          table: 'poalim_ils_account_transactions',
          row: ils(119, { text_code: 23, reference_number: '701', contra_account_number: 0 }),
        },
      ],
      rows: [
        foreign(109, { activity_type_code: 1058, reference_number: 701, value_date: '2026-11-10' }),
      ],
      expect: expectFiled(2, all(newCharges(2), chargeType('new#2', 'CONVERSION'))),
    },

    // ----- SWIFT
    {
      table: 'poalim_swift_account_transactions',
      name: 'fee = instructed - value-date amount; no match → new charge; zero fee filed; negative not',
      rows: [
        swift(120),
        swift(121, { swift_value_date_currency_amount_32a: '261109USD1000,00' }),
        swift(122, { swift_value_date_currency_amount_32a: '261109USD1000,50' }),
        swift(123, {
          swift_currency_instructed_amount_33b: null,
          swift_value_date_currency_amount_32a: null,
        }),
      ],
      expect: expectFiled(
        2,
        all(
          field(0, 'amount', '-10.00'),
          field(0, 'is_fee', true),
          field(0, 'counter_account', 'SWIFT'),
          field(0, 'source_description', 'Swift Fee: UMBRELLA CORPORATION SW-120 Invoice 43'),
          field(1, 'amount', '0.00'),
          newCharges(2),
        ),
      ),
    },
    {
      table: 'poalim_swift_account_transactions',
      name: 'two currencies: ROUND(instructed * rate, 2) - value-date amount',
      rows: [
        swift(124, {
          swift_currency_instructed_amount_33b: 'EUR1000,00',
          swift_value_date_currency_amount_32a: '261109USD1075,00',
          swift_exchange_rate_36: '1,08333',
        }),
      ],
      expect: expectFiled(1, all(field(0, 'amount', '-8.33'), field(0, 'currency', 'EUR'))),
    },
    {
      table: 'poalim_swift_account_transactions',
      name: 'blank 33B: value-date amount and currency only (fee 0)',
      rows: [swift(125, { swift_currency_instructed_amount_33b: ' ' })],
      expect: expectFiled(1, all(field(0, 'amount', '0.00'), field(0, 'currency', 'USD'))),
    },
    {
      table: 'poalim_swift_account_transactions',
      name: 'matches the fixture transfer by amount (-transaction amount = event amount)',
      rows: [
        swift(126, {
          formatted_start_date: '2026-11-07T00:00:00',
          swift_currency_instructed_amount_33b: 'USD5000,00',
          swift_value_date_currency_amount_32a: '261107USD4990,00',
        }),
      ],
      expect: expectFiled(1, all(newCharges(0), joins(0, 'existing:<fixture transfer charge>'))),
    },
    {
      table: 'poalim_swift_account_transactions',
      name: 'matches a transfer by party name (LEFT 13, trimmed) and its amount',
      before: [
        {
          table: 'poalim_foreign_account_transactions',
          row: foreign(110, {
            event_details: 'xINITECH LLC x',
            event_amount: '-1000.00',
            event_activity_type_code: 2,
          }),
        },
      ],
      rows: [
        swift(130, {
          charge_party_name: 'INITECH LLC   CORP',
          swift_currency_instructed_amount_33b: 'USD990,00',
          swift_value_date_currency_amount_32a: '261109USD980,00',
        }),
      ],
      expect: expectFiled(2, all(newCharges(1), joins(0, 'new#1'), joins(1, 'new#1'))),
    },
    {
      table: 'poalim_swift_account_transactions',
      name: 'party name matches but the amount does not: no match',
      before: [
        {
          table: 'poalim_foreign_account_transactions',
          row: foreign(111, { event_details: 'INITECH LLC', event_amount: '-999.00' }),
        },
      ],
      rows: [
        swift(131, {
          charge_party_name: 'INITECH LLC',
          swift_currency_instructed_amount_33b: 'USD990,00',
          swift_value_date_currency_amount_32a: '261109USD980,00',
        }),
      ],
      expect: expectFiled(2, newCharges(2)),
    },
    {
      table: 'poalim_swift_account_transactions',
      name: 'two currencies without a rate: the RAISE passes SQLERRM outside a handler (42703)',
      rows: [
        swift(127, {
          swift_currency_instructed_amount_33b: 'EUR1000,00',
          swift_value_date_currency_amount_32a: '261109USD1075,00',
        }),
      ],
      expect: expectError('42703'),
    },
    {
      table: 'poalim_swift_account_transactions',
      name: 'malformed 33B → RAISE (P0001)',
      rows: [swift(128, { swift_currency_instructed_amount_33b: 'US' })],
      expect: expectError('P0001'),
    },
    {
      table: 'poalim_swift_account_transactions',
      name: 'no account → RAISE (P0001)',
      rows: [swift(129, { account_number: 999999 })],
      expect: expectError('P0001'),
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------------------------

async function ensureRole(client: pg.Client) {
  const { rows } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [ROLE]);
  if (rows.length === 0) await client.query(`CREATE ROLE ${ROLE} NOLOGIN NOINHERIT NOBYPASSRLS`);
  await client.query(`GRANT USAGE ON SCHEMA accounter_schema TO ${ROLE}`);
  await client.query(`GRANT ALL ON ALL TABLES IN SCHEMA accounter_schema TO ${ROLE}`);
  await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA accounter_schema TO ${ROLE}`);
}

const describeError = (error: unknown) =>
  `${(error as { code?: string }).code ?? 'no-code'} ${(error as Error).message}`;

async function runPostgres(
  client: pg.Client,
  ctx: SessionContext,
  steps: { table: TableName; row: AnyRow }[],
): Promise<{
  error: string | null;
  rows: Record<SideTable, AnyRow[]>;
  rawList: Map<string, AnyRow>;
}> {
  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL ROLE ${ROLE}`);
    await client.query(
      `SELECT set_config('app.current_business_id', $1, true), set_config('app.current_user_id', $2, true),
              set_config('app.auth_type', $3, true), set_config('app.current_business_scope', $4, true)`,
      [
        ctx.businessId,
        ctx.userId ?? '',
        ctx.authType,
        `{${ctx.scope.map(s => `"${s}"`).join(',')}}`,
      ],
    );
    const before = new Map<SideTable, string[]>();
    for (const table of SIDE_TABLES) {
      const { rows } = await client.query(`SELECT id FROM accounter_schema.${table}`);
      before.set(
        table,
        rows.map(r => r.id as string),
      );
    }
    let error: string | null = null;
    try {
      for (const { table, row } of steps) {
        const columns = Object.keys(row);
        await client.query(
          `INSERT INTO accounter_schema.${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
          columns.map(c => row[c]),
        );
      }
    } catch (e) {
      error = describeError(e);
    }
    const rows = { transactions_raw_list: [], charges: [], transactions: [] } as Record<
      SideTable,
      AnyRow[]
    >;
    const rawList = new Map<string, AnyRow>();
    if (!error) {
      for (const table of SIDE_TABLES) {
        const { rows: found } = await client.query(
          `SELECT * FROM accounter_schema.${table} WHERE NOT (id = ANY($1::uuid[]))`,
          [before.get(table)],
        );
        rows[table] = found;
      }
      const { rows: list } = await client.query(
        'SELECT * FROM accounter_schema.transactions_raw_list',
      );
      for (const r of list) rawList.set(r.id as string, r);
    }
    return { error, rows, rawList };
  } finally {
    await client.query('ROLLBACK');
  }
}

async function runStore(
  store: ReturnType<typeof memoryStore>['store'],
  ctx: SessionContext,
  steps: { table: TableName; row: AnyRow }[],
): Promise<{
  error: string | null;
  rows: Record<SideTable, AnyRow[]>;
  rawList: Map<string, AnyRow>;
}> {
  const tx = store.begin(() => ctx);
  const db = queryDb(tx);
  try {
    const before = new Map<SideTable, Set<string>>();
    for (const table of SIDE_TABLES) {
      before.set(table, new Set((await tx.rows(table)).map(r => r.id as string)));
    }
    let error: string | null = null;
    try {
      for (const { table, row } of steps) await db.insert(table, row as never);
    } catch (e) {
      error = describeError(e);
      if (verbose && !(e as { code?: string }).code) console.error(e);
    }
    const rows = { transactions_raw_list: [], charges: [], transactions: [] } as Record<
      SideTable,
      AnyRow[]
    >;
    const rawList = new Map<string, AnyRow>();
    if (!error) {
      for (const table of SIDE_TABLES) {
        rows[table] = (await tx.rows(table))
          .filter(r => !before.get(table)!.has(r.id as string))
          .map(r => ({ ...r }));
      }
      for (const r of await tx.rows('transactions_raw_list')) rawList.set(r.id as string, { ...r });
    }
    return { error, rows, rawList };
  } finally {
    tx.rollback();
  }
}

async function main() {
  const client = new pg.Client({
    host,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'accounter_demo',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    types: pgTypeParsers,
  });
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");
  await ensureRole(client);

  // The same data on both sides.
  const { store, backend } = memoryStore();
  for (const info of allTables()) {
    const order = info.primaryKey ? ` ORDER BY ${info.primaryKey.join(', ')}` : '';
    const { rows } = await client.query(`SELECT * FROM accounter_schema.${info.name}${order}`);
    const byPartition = new Map<string, { docId: string; data: Record<string, unknown> }[]>();
    for (const row of rows) {
      const partition = info.tenancy === 'owner' ? String(row[info.ownerColumn!]) : '';
      const list = byPartition.get(partition) ?? [];
      list.push({ docId: docIdFor(info, row), data: encodeRow(info, row) });
      byPartition.set(partition, list);
    }
    for (const [partition, docs] of byPartition) {
      backend.seed({ partition, table: info.name }, docs);
    }
  }

  const { rows: tenants } = await client.query(
    'SELECT owner_id FROM accounter_schema.user_context LIMIT 1',
  );
  const tenant = tenants[0]?.owner_id as string | undefined;
  if (!tenant) throw new Error('No tenant (user_context row) in the database');
  const { rows: users } = await client.query(
    'SELECT user_id FROM accounter_schema.business_users WHERE business_id = $1 LIMIT 1',
    [tenant],
  );
  const ctx: SessionContext = {
    businessId: tenant,
    scope: [tenant],
    userId: (users[0]?.user_id as string | undefined) ?? null,
    authType: 'jwt',
  };

  // The fixture charges scenarios expect to join.
  const fixtureCharge = async (rawColumn: string, id: string) => {
    const { rows } = await client.query(
      `SELECT t.charge_id FROM accounter_schema.transactions t
         JOIN accounter_schema.transactions_raw_list tr ON tr.id = t.source_id
        WHERE tr.${rawColumn} = $1`,
      [id],
    );
    if (!rows[0])
      throw new Error(`fixture raw row ${id} has no transaction: apply 030-scraper-ingestion.sql`);
    return rows[0].charge_id as string;
  };
  const placeholders: Record<string, string> = {
    '<fixture conversion charge>': await fixtureCharge('poalim_foreign_id', FIXTURE.conversionLeg),
    '<fixture transfer charge>': await fixtureCharge('poalim_foreign_id', FIXTURE.swiftTransfer),
  };
  const perTable = new Map<string, { pass: number; fail: number }>();
  let failures = 0;
  for (const scenario of scenarios(tenant)) {
    if (only && !scenario.table.includes(only)) continue;
    const steps = [
      ...(scenario.before ?? []),
      ...scenario.rows.map(row => ({ table: scenario.table, row })),
    ];
    const pgRun = await runPostgres(client, ctx, steps);
    const fsRun = await runStore(store, ctx, steps);
    const pgEffects = normalise(
      pgRun.error,
      pgRun.rows.transactions_raw_list,
      pgRun.rows.charges,
      pgRun.rows.transactions,
      pgRun.rawList,
    );
    const fsEffects = normalise(
      fsRun.error,
      fsRun.rows.transactions_raw_list,
      fsRun.rows.charges,
      fsRun.rows.transactions,
      fsRun.rawList,
    );
    const problems: string[] = [];
    const pgCode = pgEffects.error?.split(' ')[0] ?? null;
    const fsCode = fsEffects.error?.split(' ')[0] ?? null;
    if (pgCode !== fsCode) {
      problems.push(
        `postgres ${pgEffects.error ?? 'succeeded'}; firestore ${fsEffects.error ?? 'succeeded'}`,
      );
    } else if (!pgCode) {
      for (const part of ['rawList', 'charges', 'transactions'] as const) {
        const a = JSON.stringify(pgEffects[part]);
        const b = JSON.stringify(fsEffects[part]);
        if (a !== b) problems.push(`${part} differ\n  pg=${a}\n  fs=${b}`);
      }
    }
    // The branch the scenario is named after, on Postgres's side (placeholders resolved).
    const resolved = JSON.parse(
      Object.entries(placeholders).reduce(
        (text, [placeholder, id]) => text.replaceAll(`existing:${id}`, `existing:${placeholder}`),
        JSON.stringify(pgEffects),
      ),
    ) as Effects;
    const branch = scenario.expect(resolved);
    if (branch) problems.push(`branch not exercised: ${branch}`);

    const stats = perTable.get(scenario.table) ?? { pass: 0, fail: 0 };
    perTable.set(scenario.table, stats);
    if (problems.length === 0) {
      stats.pass++;
      if (verbose) {
        const outcome = pgEffects.error
          ? `both raised ${pgCode}`
          : `${pgEffects.rawList.length} raw-list, ${pgEffects.charges.length} charges, ${pgEffects.transactions.length} transactions`;
        console.log(`ok    ${scenario.table}: ${scenario.name} (${outcome})`);
      }
    } else {
      stats.fail++;
      failures++;
      console.log(`FAIL  ${scenario.table}: ${scenario.name}\n  ${problems.join('\n  ')}`);
    }
  }

  await client.end();
  store.close();
  console.log('');
  for (const [table, stats] of [...perTable].sort()) {
    console.log(`${table.padEnd(45)} pass ${stats.pass}  fail ${stats.fail}`);
  }
  console.log(`verify-bank-handlers  ${failures === 0 ? 'all passed' : `${failures} failed`}`);
  process.exit(failures ? 1 : 0);
}

await main();
