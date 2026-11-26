/**
 * `extended_charges`: every charge with the aggregates of its transactions, documents, ledger
 * records, tags and spread. A port of the view (reference/schema.sql):
 *
 *   WITH years_of_relevance AS (SELECT charge_id, array_agg(year_of_relevance) FROM charge_spread GROUP BY charge_id),
 *        transactions_by_charge AS (SELECT charge_id, min/max(event_date), min/max(COALESCE(debit_date_override, debit_date)),
 *            sum(amount), count(*), count(*) FILTER (business_id IS NULL OR debit date IS NULL) > 0,
 *            array_agg(DISTINCT currency), string_agg(source_description || ' ' || source_reference, ' ')
 *          FROM transactions GROUP BY charge_id),
 *        documents_by_charge AS (SELECT charge_id, date ranges, float sums of total/vat amounts signed by
 *            (creditor = owner ? 1 : -1) FILTERed by document type (receipts only when the counterparty
 *            can settle with a receipt), type counts, invalid flag, array_agg(currency_code) FILTER,
 *            COALESCE(bool_or(issued.status = 'OPEN'), false), string_agg(description, remarks, serial)
 *          FROM documents LEFT JOIN charges LEFT JOIN businesses (the side that is not the owner)
 *          LEFT JOIN documents_issued GROUP BY charge_id),
 *        businesses_by_charge AS (array_agg(DISTINCT business) and the non-fee subset, minus the owner, over the
 *            UNION of transaction counterparties, document creditors/debtors and (as fees) ledger entities),
 *        tags_by_charge AS (array_agg(tag_id) FROM charge_tags GROUP BY charge_id),
 *        ledger_by_charge AS (count(DISTINCT id), array_remove(array_agg(DISTINCT entity), NULL), min/max dates)
 *   SELECT c.id, ..., COALESCE(c.tax_category_id, tcm.tax_category_id),
 *          COALESCE(invoice_event_amount::numeric, receipt_event_amount::numeric, transactions event_amount), ...
 *   FROM charges c LEFT JOIN each aggregate
 *     LEFT JOIN businesses b ON b.id = filtered_business_array[1] AND array_length(filtered_business_array, 1) = 1
 *     LEFT JOIN business_tax_category_match tcm ON tcm.business_id = b.id AND tcm.owner_id = c.owner_id
 *     LEFT JOIN business_trip_charges btc ... LEFT JOIN depreciation d ON d.charge_id = c.id
 *
 * `is_property` is `d.id IS NOT NULL`, and a charge with several depreciation rows appears once per row,
 * as the LEFT JOIN makes it. `array_agg` without ORDER BY (years of relevance, tags) and `string_agg` follow
 * the tables' row order; Postgres leaves that order undefined.
 */
import type { QueryDb } from '../query-db.js';
import { compareEnum, Numeric } from '../sql-helpers.js';

export type ExtendedChargeRow = {
  id: string;
  owner_id: string;
  is_property: boolean;
  accountant_status: string;
  user_description: string | null;
  created_at: Date;
  updated_at: Date;
  tax_category_id: string | null;
  event_amount: string | null;
  transactions_min_event_date: string | null;
  transactions_max_event_date: string | null;
  transactions_min_debit_date: string | null;
  transactions_max_debit_date: string | null;
  transactions_event_amount: string | null;
  transactions_currency: string | null;
  transactions_count: string | null;
  invalid_transactions: boolean | null;
  documents_min_date: string | null;
  documents_max_date: string | null;
  documents_event_amount: number | null;
  documents_vat_amount: number | null;
  documents_currency: string | null;
  invoices_count: string | null;
  receipts_count: string | null;
  documents_count: string | null;
  invalid_documents: boolean | null;
  open_docs_flag: boolean | null;
  business_array: string[] | null;
  business_id: string | null;
  can_settle_with_receipt: boolean;
  tags: string[] | null;
  business_trip_id: string | null;
  ledger_count: string | null;
  ledger_financial_entities: string[] | null;
  ledger_min_value_date: string | null;
  ledger_max_value_date: string | null;
  ledger_min_invoice_date: string | null;
  ledger_max_invoice_date: string | null;
  years_of_relevance: string[] | null;
  invoice_payment_currency_diff: boolean | null;
  type: string | null;
  optional_vat: boolean;
  no_invoices_required: boolean;
  documents_optional_flag: boolean;
  merged_search_text: string;
};

const INVOICE_TYPES = new Set(['INVOICE', 'INVOICE_RECEIPT', 'CREDIT_INVOICE']);
const RECEIPT_TYPES = new Set(['RECEIPT', 'INVOICE_RECEIPT']);
const ACCOUNTING_TYPES = new Set(['INVOICE', 'INVOICE_RECEIPT', 'RECEIPT', 'CREDIT_INVOICE']);

/** min/max over `YYYY-MM-DD` strings, skipping NULL. */
function minDate(values: Iterable<string | null>): string | null {
  let best: string | null = null;
  for (const v of values) if (v != null && (best === null || v < best)) best = v;
  return best;
}
function maxDate(values: Iterable<string | null>): string | null {
  let best: string | null = null;
  for (const v of values) if (v != null && (best === null || v > best)) best = v;
  return best;
}

/** `sum(float8)`: plain double addition in input order; NULL when no non-null input. */
function sumFloat(values: Iterable<number | null>): number | null {
  let total: number | null = null;
  for (const v of values) if (v != null) total = total === null ? v : total + v;
  return total;
}

/** `array_agg(DISTINCT uuid)` without NULLs, in uuid (byte) order. */
function distinctUuids(values: Iterable<string | null | undefined>): string[] {
  return [...new Set([...values].filter((v): v is string => v != null))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}

function group<T>(rows: readonly T[], key: (row: T) => string | null): Map<string | null, T[]> {
  const map = new Map<string | null, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export async function extendedCharges(db: QueryDb): Promise<ExtendedChargeRow[]> {
  const [
    charges,
    chargeSpread,
    transactions,
    documents,
    businesses,
    documentsIssued,
    ledgerRecords,
    chargeTags,
    taxCategoryMatches,
    tripCharges,
    depreciation,
  ] = await Promise.all([
    db.rows('charges'),
    db.rows('charge_spread'),
    db.rows('transactions'),
    db.rows('documents'),
    db.rows('businesses'),
    db.rows('documents_issued'),
    db.rows('ledger_records'),
    db.rows('charge_tags'),
    db.rows('business_tax_category_match'),
    db.rows('business_trip_charges'),
    db.rows('depreciation'),
  ]);
  const chargeById = new Map(charges.map(c => [c.id, c]));
  const businessById = new Map(businesses.map(b => [b.id, b]));
  const issuedById = new Map(documentsIssued.map(d => [d.id, d]));

  // years_of_relevance
  const years = new Map<string | null, string[]>();
  for (const [chargeId, rows] of group(chargeSpread, r => r.charge_id)) {
    years.set(
      chargeId,
      rows.map(r => r.year_of_relevance),
    );
  }

  // transactions_by_charge
  const tbc = new Map<
    string | null,
    {
      min_event_date: string | null;
      max_event_date: string | null;
      min_debit_date: string | null;
      max_debit_date: string | null;
      event_amount: string | null;
      transactions_count: string;
      invalid_transactions: boolean;
      currency_array: string[];
      search_text: string;
    }
  >();
  for (const [chargeId, rows] of group(transactions, t => t.charge_id)) {
    const debitDates = rows.map(t => t.debit_date_override ?? t.debit_date);
    let sum: Numeric | null = null;
    for (const t of rows)
      if (t.amount != null) sum = sum ? sum.add(t.amount) : Numeric.of(t.amount);
    const currencies = [...new Set(rows.map(t => t.currency))].sort((a, b) =>
      compareEnum('currency', a, b),
    );
    tbc.set(chargeId, {
      min_event_date: minDate(rows.map(t => t.event_date)),
      max_event_date: maxDate(rows.map(t => t.event_date)),
      min_debit_date: minDate(debitDates),
      max_debit_date: maxDate(debitDates),
      event_amount: sum ? sum.toString() : null,
      transactions_count: String(rows.length),
      invalid_transactions: rows.some(
        t => t.business_id == null || (t.debit_date_override ?? t.debit_date) == null,
      ),
      currency_array: currencies,
      search_text: rows
        .map(t => `${t.source_description ?? ''} ${t.source_reference ?? ''}`)
        .join(' '),
    });
  }

  // documents_by_charge: documents LEFT JOIN charges LEFT JOIN businesses LEFT JOIN documents_issued
  type DocJoin = {
    doc: (typeof documents)[number];
    ownerId: string | null;
    canSettle: boolean | null;
    status: string | null;
  };
  const docJoins: DocJoin[] = [];
  for (const doc of documents) {
    const ownerId =
      (doc.charge_id == null ? null : chargeById.get(doc.charge_id)?.owner_id) ?? null;
    const status = issuedById.get(doc.id)?.status ?? null;
    // (creditor = owner AND debtor = b.id) OR (creditor = b.id AND debtor = owner)
    const matches = new Set<string>();
    if (ownerId != null && doc.creditor_id === ownerId && doc.debtor_id != null) {
      matches.add(doc.debtor_id);
    }
    if (ownerId != null && doc.debtor_id === ownerId && doc.creditor_id != null) {
      matches.add(doc.creditor_id);
    }
    const joined = [...matches].map(id => businessById.get(id)).filter(b => b != null);
    if (joined.length === 0) docJoins.push({ doc, ownerId, canSettle: null, status });
    for (const b of joined) {
      docJoins.push({ doc, ownerId, canSettle: b.can_settle_with_receipt, status });
    }
  }
  const dbc = new Map<
    string | null,
    {
      min_event_date: string | null;
      min_any_event_date: string | null;
      max_event_date: string | null;
      max_any_event_date: string | null;
      receipt_event_amount: number | null;
      invoice_event_amount: number | null;
      receipt_vat_amount: number | null;
      invoice_vat_amount: number | null;
      invoices_count: string;
      receipts_count: string;
      documents_count: string;
      invalid_documents: boolean;
      currency_array: (string | null)[] | null;
      open_docs_flag: boolean;
      search_text: string;
    }
  >();
  for (const [chargeId, rows] of group(docJoins, j => j.doc.charge_id)) {
    const sign = (j: DocJoin) =>
      j.doc.creditor_id != null && j.doc.creditor_id === j.ownerId ? 1 : -1;
    const signed = (value: number | null, j: DocJoin) => (value == null ? null : value * sign(j));
    const accounting = rows.filter(j => ACCOUNTING_TYPES.has(j.doc.type));
    const receiptRows = rows.filter(j => j.canSettle === true && RECEIPT_TYPES.has(j.doc.type));
    const invoiceRows = rows.filter(j => INVOICE_TYPES.has(j.doc.type));
    const currencyRows = rows.filter(
      j => (j.canSettle === true && RECEIPT_TYPES.has(j.doc.type)) || INVOICE_TYPES.has(j.doc.type),
    );
    let openFlag: boolean | null = null;
    for (const j of rows) {
      if (j.status == null) continue;
      openFlag = (openFlag ?? false) || j.status === 'OPEN';
    }
    dbc.set(chargeId, {
      min_event_date: minDate(accounting.map(j => j.doc.date)),
      min_any_event_date: minDate(rows.map(j => j.doc.date)),
      max_event_date: maxDate(accounting.map(j => j.doc.date)),
      max_any_event_date: maxDate(rows.map(j => j.doc.date)),
      receipt_event_amount: sumFloat(receiptRows.map(j => signed(j.doc.total_amount, j))),
      invoice_event_amount: sumFloat(invoiceRows.map(j => signed(j.doc.total_amount, j))),
      receipt_vat_amount: sumFloat(receiptRows.map(j => signed(j.doc.vat_amount, j))),
      invoice_vat_amount: sumFloat(invoiceRows.map(j => signed(j.doc.vat_amount, j))),
      invoices_count: String(invoiceRows.length),
      receipts_count: String(rows.filter(j => RECEIPT_TYPES.has(j.doc.type)).length),
      documents_count: String(rows.length),
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
      currency_array: currencyRows.length ? currencyRows.map(j => j.doc.currency_code) : null,
      open_docs_flag: openFlag ?? false,
      search_text: rows
        .map(j => `${j.doc.description ?? ''} ${j.doc.remarks ?? ''} ${j.doc.serial_number ?? ''}`)
        .join(' '),
    });
  }

  // businesses_by_charge: UNION (distinct) of (charge_id, business_id, is_fee)
  const triples = new Map<
    string,
    { charge_id: string | null; business_id: string; is_fee: boolean }
  >();
  const addTriple = (chargeId: string | null, businessId: string | null, isFee: boolean) => {
    if (businessId == null) return;
    triples.set(`${chargeId}|${businessId}|${isFee}`, {
      charge_id: chargeId,
      business_id: businessId,
      is_fee: isFee,
    });
  };
  for (const t of transactions) addTriple(t.charge_id, t.business_id, t.is_fee);
  for (const d of documents) addTriple(d.charge_id, d.creditor_id, false);
  for (const d of documents) addTriple(d.charge_id, d.debtor_id, false);
  for (const l of ledgerRecords) {
    addTriple(l.charge_id, l.credit_entity1, true);
    addTriple(l.charge_id, l.credit_entity2, true);
    addTriple(l.charge_id, l.debit_entity1, true);
    addTriple(l.charge_id, l.debit_entity2, true);
  }
  const bbc = new Map<
    string | null,
    { business_array: string[]; filtered_business_array: string[] }
  >();
  for (const [chargeId, rows] of group([...triples.values()], r => r.charge_id)) {
    const ownerId = chargeId == null ? null : (chargeById.get(chargeId)?.owner_id ?? null);
    const remove = (ids: string[]) => ids.filter(id => ownerId == null || id !== ownerId);
    bbc.set(chargeId, {
      business_array: remove(distinctUuids(rows.map(r => r.business_id))),
      filtered_business_array: remove(
        distinctUuids(rows.map(r => (r.is_fee ? null : r.business_id))),
      ),
    });
  }

  // tags_by_charge
  const tagsByCharge = new Map<string | null, string[]>();
  for (const [chargeId, rows] of group(chargeTags, r => r.charge_id)) {
    tagsByCharge.set(
      chargeId,
      rows.map(r => r.tag_id),
    );
  }

  // ledger_by_charge
  const lbc = new Map<
    string | null,
    {
      ledger_count: string;
      ledger_financial_entities: string[];
      min_value_date: string | null;
      max_value_date: string | null;
      min_invoice_date: string | null;
      max_invoice_date: string | null;
    }
  >();
  for (const [chargeId, rows] of group(ledgerRecords, r => r.charge_id)) {
    lbc.set(chargeId, {
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

  const tripByCharge = group(tripCharges, r => r.charge_id);
  const depreciationByCharge = group(depreciation, r => r.charge_id);
  const taxCategoryByBusiness = new Map(
    taxCategoryMatches.map(m => [`${m.business_id}|${m.owner_id}`, m.tax_category_id]),
  );

  const result: ExtendedChargeRow[] = [];
  for (const c of charges) {
    const t = tbc.get(c.id);
    const d = dbc.get(c.id);
    const bb = bbc.get(c.id);
    const b =
      bb && bb.filtered_business_array.length === 1
        ? (businessById.get(bb.filtered_business_array[0]!) ?? null)
        : null;
    const matchedTaxCategory = b ? taxCategoryByBusiness.get(`${b.id}|${c.owner_id}`) : undefined;
    const l = lbc.get(c.id);
    const tags = tagsByCharge.get(c.id) ?? null;
    const singleOf = (array: readonly (string | null)[] | null | undefined) =>
      array && array.length === 1 ? array[0]! : null;
    const floatToNumeric = (value: number | null | undefined) =>
      value == null ? null : Numeric.fromFloat8(value).toString();
    const eventAmount =
      floatToNumeric(d?.invoice_event_amount) ??
      floatToNumeric(d?.receipt_event_amount) ??
      t?.event_amount ??
      null;
    const searchParts = [c.user_description, t?.search_text, d?.search_text].filter(
      (part): part is string => part != null,
    );

    const base = {
      id: c.id,
      owner_id: c.owner_id,
      accountant_status: c.accountant_status,
      user_description: c.user_description,
      created_at: c.created_at,
      updated_at: c.updated_at,
      tax_category_id: c.tax_category_id ?? matchedTaxCategory ?? null,
      event_amount: eventAmount,
      transactions_min_event_date: t?.min_event_date ?? null,
      transactions_max_event_date: t?.max_event_date ?? null,
      transactions_min_debit_date: t?.min_debit_date ?? null,
      transactions_max_debit_date: t?.max_debit_date ?? null,
      transactions_event_amount: t?.event_amount ?? null,
      transactions_currency: singleOf(t?.currency_array),
      transactions_count: t?.transactions_count ?? null,
      invalid_transactions: t?.invalid_transactions ?? null,
      documents_min_date: d ? (d.min_event_date ?? d.min_any_event_date) : null,
      documents_max_date: d ? (d.max_event_date ?? d.max_any_event_date) : null,
      documents_event_amount: d ? (d.invoice_event_amount ?? d.receipt_event_amount) : null,
      documents_vat_amount: d ? (d.invoice_vat_amount ?? d.receipt_vat_amount) : null,
      documents_currency: singleOf(d?.currency_array),
      invoices_count: d?.invoices_count ?? null,
      receipts_count: d?.receipts_count ?? null,
      documents_count: d?.documents_count ?? null,
      invalid_documents: d?.invalid_documents ?? null,
      open_docs_flag: d?.open_docs_flag ?? null,
      business_array: bb ? [...bb.business_array] : null,
      business_id: b?.id ?? null,
      can_settle_with_receipt: b?.can_settle_with_receipt ?? false,
      tags: tags ? [...tags] : null,
      business_trip_id: tripByCharge.get(c.id)?.[0]?.business_trip_id ?? null,
      ledger_count: l?.ledger_count ?? null,
      ledger_financial_entities: l ? [...l.ledger_financial_entities] : null,
      ledger_min_value_date: l?.min_value_date ?? null,
      ledger_max_value_date: l?.max_value_date ?? null,
      ledger_min_invoice_date: l?.min_invoice_date ?? null,
      ledger_max_invoice_date: l?.max_invoice_date ?? null,
      years_of_relevance: years.has(c.id) ? [...years.get(c.id)!] : null,
      invoice_payment_currency_diff: c.invoice_payment_currency_diff,
      type: c.type,
      optional_vat: c.optional_vat,
      no_invoices_required: b?.no_invoices_required ?? false,
      documents_optional_flag: c.documents_optional_flag,
      merged_search_text: searchParts.join(' ').toLowerCase(),
    };
    const depreciations = depreciationByCharge.get(c.id);
    if (depreciations) {
      for (const _row of depreciations) result.push({ ...base, is_property: true });
    } else {
      result.push({ ...base, is_property: false });
    }
  }
  return result;
}
