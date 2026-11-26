/**
 * Ids of the rows scripts/firestore/fixtures/050-documents.sql adds, for the cases of the documents,
 * misc-expenses, contracts, common and accountant-approval ports. Used by cases files only.
 */
const id = (n: number) => `0f050000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

export const FX = {
  /** business 'Globex Fixture Client' (a client; can settle with receipt) */
  globex: id(0x001),
  /** business 'Initech Fixture Client' (a client) */
  initech: id(0x003),
  /** charge, APPROVED: documents D1 D3 D5, misc expenses M1 M2, a ledger record, 2 depreciation rows */
  chargeApproved: id(0x101),
  /** charge, UNAPPROVED, no transactions: documents D4 D7 D8, misc expense M3 */
  chargeUnmatched: id(0x102),
  /** charge, APPROVED, nothing attached */
  chargeEmpty: id(0x103),
  /** RECEIPT, every column set, issued (OPEN, linked D5 D7) */
  d1: id(0x201),
  /** UNPROCESSED, every nullable column NULL, no charge */
  d2: id(0x202),
  /** OTHER, file only, no debtor */
  d3: id(0x203),
  /** PROFORMA, -250.5 EUR, issued (CLOSED) */
  d4: id(0x204),
  /** INVOICE, 1234567890123456 ILS (prints as 1.234567890123456e+15), issued (CLOSED) */
  d5: id(0x205),
  /** INVOICE, no serial / date / amount / charge, issued (OPEN, empty links) */
  d6: id(0x206),
  /** INVOICE 'INV-F-001', 99.99 USD, issued (CANCELLED) */
  d7: id(0x207),
  /** CREDIT_INVOICE 'cr-f-1', issued (MANUALLY_CLOSED) */
  d8: id(0x208),
  /** INVOICE 'inv-f-000' (lower case: last in C collation order), issued (OPEN) */
  d9: id(0x209),
  m1: id(0x301),
  m2: id(0x302),
  m3: id(0x303),
  /** contract of Globex, active, 2024 */
  k1: id(0x401),
  /** contract of Globex, inactive, 2023 */
  k2: id(0x402),
  /** contract of Initech, is_active NULL, 2024 (ties K1 on start_date) */
  k3: id(0x403),
} as const;

export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
