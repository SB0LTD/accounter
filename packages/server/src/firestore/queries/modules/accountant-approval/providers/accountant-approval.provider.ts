import type {
  IDegradeChargeAccountantApprovalQuery,
  IGetChargesApprovalStatusQuery,
} from '../../../../../modules/accountant-approval/__generated__/accountant-approval.types.js';
import type { Row } from '../../../../catalog.js';
import type { QueryDb } from '../../../../query-db.js';
import {
  coalesce,
  countText,
  groupBy,
  inList,
  maxOf,
  minOf,
  toDateString,
} from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** `documents.type = ANY (ARRAY['INVOICE', 'INVOICE_RECEIPT', 'RECEIPT', 'CREDIT_INVOICE'])` */
const EVENT_DOCUMENT_TYPES = new Set(['INVOICE', 'INVOICE_RECEIPT', 'RECEIPT', 'CREDIT_INVOICE']);

interface ChargeDateBounds {
  charge: Row<'charges'>;
  /** GREATEST(documents_max_date, transactions_max_event_date, transactions_max_debit_date,
   *  ledger_max_invoice_date, ledger_max_value_date) */
  greatest: string | null;
  /** LEAST(documents_min_date, transactions_min_event_date, transactions_min_debit_date,
   *  ledger_min_invoice_date, ledger_min_value_date) */
  least: string | null;
}

/**
 * The `extended_charges` rows this query reads, reduced to the columns it uses: the charge's
 * accountant status and the date bounds of its documents, transactions and ledger records.
 *
 * Computed here because the `extended_charges` view port is not available yet. The view repeats a
 * charge once per depreciation row (`LEFT JOIN depreciation d ON d.charge_id = c.id`); every other
 * join in it matches at most one row, so the multiplicity is kept here.
 */
async function extendedChargeDateBounds(db: QueryDb): Promise<ChargeDateBounds[]> {
  const documents = groupBy(await db.rows('documents'), doc => doc.charge_id);
  const transactions = groupBy(await db.rows('transactions'), t => t.charge_id);
  const ledger = groupBy(await db.rows('ledger_records'), l => l.charge_id);
  const depreciation = groupBy(await db.rows('depreciation'), d => d.charge_id);

  const result: ChargeDateBounds[] = [];
  for (const charge of await db.rows('charges')) {
    const docs = documents.get(charge.id) ?? [];
    const eventDocs = docs.filter(doc => EVENT_DOCUMENT_TYPES.has(doc.type));
    // COALESCE(documents_by_charge.min_event_date, documents_by_charge.min_any_event_date)
    const documentsMin = coalesce(
      minOf(
        eventDocs.map(doc => doc.date),
        'date',
      ),
      minOf(
        docs.map(doc => doc.date),
        'date',
      ),
    );
    const documentsMax = coalesce(
      maxOf(
        eventDocs.map(doc => doc.date),
        'date',
      ),
      maxOf(
        docs.map(doc => doc.date),
        'date',
      ),
    );
    const txs = transactions.get(charge.id) ?? [];
    const debitDates = txs.map(t => t.debit_date_override ?? t.debit_date);
    const records = ledger.get(charge.id) ?? [];
    const upper = [
      documentsMax,
      maxOf(
        txs.map(t => t.event_date),
        'date',
      ),
      maxOf(debitDates, 'date'),
      maxOf(
        records.map(l => l.invoice_date),
        'date',
      ),
      maxOf(
        records.map(l => l.value_date),
        'date',
      ),
    ];
    const lower = [
      documentsMin,
      minOf(
        txs.map(t => t.event_date),
        'date',
      ),
      minOf(debitDates, 'date'),
      minOf(
        records.map(l => l.invoice_date),
        'date',
      ),
      minOf(
        records.map(l => l.value_date),
        'date',
      ),
    ];
    // GREATEST / LEAST skip NULLs and are NULL only when every argument is.
    const bounds = {
      charge,
      greatest: maxOf(upper, 'date'),
      least: minOf(lower, 'date'),
    };
    const copies = Math.max(1, depreciation.get(charge.id)?.length ?? 0);
    for (let i = 0; i < copies; i++) result.push(bounds);
  }
  return result;
}

/**
 * SELECT COUNT(*) AS total_charges,
 *        COUNT(*) FILTER (WHERE accountant_status = 'APPROVED') AS approved_charges,
 *        COUNT(*) FILTER (WHERE accountant_status = 'PENDING') AS pending_charges,
 *        COUNT(*) FILTER (WHERE accountant_status = 'UNAPPROVED') AS unapproved_charges
 * FROM extended_charges
 * WHERE owner_id in $$ownerIds
 * AND GREATEST(documents_max_date, transactions_max_event_date, transactions_max_debit_date,
 *              ledger_max_invoice_date, ledger_max_value_date) >= $fromDate ::DATE
 * AND LEAST(documents_min_date, transactions_min_event_date, transactions_min_debit_date,
 *           ledger_min_invoice_date, ledger_min_value_date) <= $toDate ::DATE;
 */
export const getChargesApprovalStatus = port<IGetChargesApprovalStatusQuery>(
  async ({ ownerIds, fromDate, toDate }, db) => {
    const ownerMatch = inList(ownerIds);
    const from = fromDate == null ? null : toDateString(fromDate);
    const to = toDate == null ? null : toDateString(toDate);
    const rows =
      from == null || to == null
        ? []
        : (await extendedChargeDateBounds(db)).filter(
            row =>
              ownerMatch(row.charge.owner_id) &&
              row.greatest != null &&
              row.greatest >= from &&
              row.least != null &&
              row.least <= to,
          );
    const count = (status?: string) =>
      countText(rows.filter(row => !status || row.charge.accountant_status === status).length);
    return [
      {
        total_charges: count(),
        approved_charges: count('APPROVED'),
        pending_charges: count('PENDING'),
        unapproved_charges: count('UNAPPROVED'),
      },
    ];
  },
);

/**
 * UPDATE charges SET accountant_status = 'PENDING'
 * WHERE id = $chargeId AND accountant_status = 'APPROVED'
 * RETURNING *;
 */
export const degradeChargeAccountantApproval = port<IDegradeChargeAccountantApprovalQuery>(
  async ({ chargeId }, db) => {
    if (chargeId == null) return [];
    const result: Row<'charges'>[] = [];
    for (const charge of await db.where('charges', {
      id: chargeId,
      accountant_status: 'APPROVED',
    })) {
      result.push(await db.update('charges', charge, { accountant_status: 'PENDING' }));
    }
    return result;
  },
);
