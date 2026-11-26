import type {
  IDeleteLedgerRecordsByChargeIdsQuery,
  IDeleteLedgerRecordsQuery,
  IGetLedgerBalanceToDateQuery,
  IGetLedgerRecordsByChargesIdsQuery,
  IGetLedgerRecordsByDatesQuery,
  IGetLedgerRecordsByFiltersQuery,
  IGetLedgerRecordsByFinancialEntityIdsQuery,
  IGetLedgerRecordsByIdsQuery,
  IInsertLedgerRecordsQuery,
  ILockLedgerRecordsQuery,
  IReplaceLedgerRecordsChargeIdQuery,
  IUpdateLedgerRecordQuery,
} from '../../../../../modules/ledger/__generated__/ledger.types.js';
import type { Row } from '../../../../catalog.js';
import {
  coalescePatch,
  inList,
  limitOffset,
  Numeric,
  toDateString,
} from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { compareUuid, deletable, groupByKey, numericParam } from '../../charges/_helpers.js';

type LedgerRecord = Row<'ledger_records'>;

const date = (value: string | null | void) => (value == null ? null : toDateString(value));

/** ledger_records rows as the query result (the store types date columns as plain strings). */
const asResult = (rows: readonly LedgerRecord[]): never => rows as never;

/** SELECT * FROM ledger_records WHERE id IN $$ids AND owner_id = $ownerId */
export const getLedgerRecordsByIds = port<IGetLedgerRecordsByIdsQuery>(
  async ({ ids, ownerId }, db) =>
    asResult(
      (await db.whereIn('ledger_records', 'id', ids)).filter(
        r => ownerId != null && r.owner_id === ownerId,
      ),
    ),
);

/** SELECT * FROM ledger_records WHERE charge_id IN $$chargeIds AND owner_id = $ownerId */
export const getLedgerRecordsByChargesIds = port<IGetLedgerRecordsByChargesIdsQuery>(
  async ({ chargeIds, ownerId }, db) =>
    asResult(
      (await db.whereIn('ledger_records', 'charge_id', chargeIds)).filter(
        r => ownerId != null && r.owner_id === ownerId,
      ),
    ),
);

/**
 * SELECT * FROM ledger_records
 * WHERE debit_entity1 IN $$financialEntityIds OR debit_entity2 IN $$financialEntityIds
 *    OR credit_entity1 IN $$financialEntityIds OR credit_entity1 IN $$financialEntityIds
 *   AND owner_id = $ownerId
 *
 * AND binds tighter than OR: the owner condition only applies to the last credit_entity1 test.
 */
export const getLedgerRecordsByFinancialEntityIds =
  port<IGetLedgerRecordsByFinancialEntityIdsQuery>(async ({ financialEntityIds, ownerId }, db) => {
    const isEntity = inList(financialEntityIds);
    return asResult(
      (await db.rows('ledger_records')).filter(
        r =>
          isEntity(r.debit_entity1) ||
          isEntity(r.debit_entity2) ||
          isEntity(r.credit_entity1) ||
          (isEntity(r.credit_entity1) && ownerId != null && r.owner_id === ownerId),
      ),
    );
  });

/**
 * SELECT * FROM ledger_records
 * WHERE invoice_date BETWEEN $fromDate AND $toDate AND owner_id = $ownerId
 */
export const getLedgerRecordsByDates = port<IGetLedgerRecordsByDatesQuery>(
  async ({ fromDate, toDate, ownerId }, db) => {
    const from = date(fromDate);
    const to = date(toDate);
    if (from == null || to == null || ownerId == null) return [];
    return asResult(
      (await db.where('ledger_records', { owner_id: ownerId })).filter(
        r => r.invoice_date >= from && r.invoice_date <= to,
      ),
    );
  },
);

/**
 * SELECT * FROM ledger_records
 * WHERE ($isChargeIds = 0 OR charge_id IN $$chargeIds) AND ($isOwnerIds = 0 OR owner_id IN $$ownerIds)
 *   AND ($isFinancialEntityIds = 0 OR (($matchDebit1 = 1 AND debit_entity1 IN $$financialEntityIds)
 *        OR ($matchDebit2 = 1 AND debit_entity2 IN ...) OR ($matchCredit1 = 1 AND credit_entity1 IN ...)
 *        OR ($matchCredit2 = 1 AND credit_entity2 IN ...)))
 *   AND ($fromInvoiceDate::DATE IS NULL OR invoice_date >= $fromInvoiceDate) AND (... toInvoiceDate,
 *        fromValueDate, toValueDate likewise)
 *   AND (($fromAnyDate IS NULL AND $toAnyDate IS NULL)
 *        OR (invoice_date within [$fromAnyDate, $toAnyDate]) OR (value_date within [$fromAnyDate, $toAnyDate]))
 * ORDER BY invoice_date, value_date, id
 * LIMIT $limit
 */
export const getLedgerRecordsByFilters = port<IGetLedgerRecordsByFiltersQuery>(async (p, db) => {
  const inCharges = inList(p.chargeIds);
  const inOwners = inList(p.ownerIds);
  const isEntity = inList(p.financialEntityIds);
  const fromInvoice = date(p.fromInvoiceDate);
  const toInvoice = date(p.toInvoiceDate);
  const fromValue = date(p.fromValueDate);
  const toValue = date(p.toValueDate);
  const fromAny = date(p.fromAnyDate);
  const toAny = date(p.toAnyDate);
  const within = (d: string) => (fromAny == null || d >= fromAny) && (toAny == null || d <= toAny);
  const rows = (await db.rows('ledger_records')).filter(
    r =>
      (p.isChargeIds === 0 || inCharges(r.charge_id)) &&
      (p.isOwnerIds === 0 || inOwners(r.owner_id)) &&
      (p.isFinancialEntityIds === 0 ||
        (p.matchDebit1 === 1 && isEntity(r.debit_entity1)) ||
        (p.matchDebit2 === 1 && isEntity(r.debit_entity2)) ||
        (p.matchCredit1 === 1 && isEntity(r.credit_entity1)) ||
        (p.matchCredit2 === 1 && isEntity(r.credit_entity2))) &&
      (fromInvoice == null || r.invoice_date >= fromInvoice) &&
      (toInvoice == null || r.invoice_date <= toInvoice) &&
      (fromValue == null || r.value_date >= fromValue) &&
      (toValue == null || r.value_date <= toValue) &&
      ((fromAny == null && toAny == null) || within(r.invoice_date) || within(r.value_date)),
  );
  return asResult(limitOffset(sortByDatesAndId(rows), p.limit ?? null, null));
});

/** ORDER BY invoice_date, value_date, id (all NOT NULL) */
function sortByDatesAndId(rows: readonly LedgerRecord[]): LedgerRecord[] {
  return [...rows].sort(
    (a, b) =>
      (a.invoice_date < b.invoice_date ? -1 : a.invoice_date > b.invoice_date ? 1 : 0) ||
      (a.value_date < b.value_date ? -1 : a.value_date > b.value_date ? 1 : 0) ||
      compareUuid(a.id, b.id),
  );
}

/**
 * WITH grouped_entities AS (
 *   SELECT credit_entity1 AS entity_id, credit_local_amount1 AS amount, invoice_date FROM ledger_records
 *   UNION ALL SELECT credit_entity2, credit_local_amount2, invoice_date FROM ledger_records
 *   UNION ALL SELECT debit_entity1, debit_local_amount1 * -1, invoice_date FROM ledger_records
 *   UNION ALL SELECT debit_entity2, debit_local_amount2 * -1, invoice_date FROM ledger_records)
 * SELECT entity_id, sum(amount) FROM grouped_entities
 * WHERE invoice_date < $date AND entity_id IS NOT NULL GROUP BY entity_id
 */
export const getLedgerBalanceToDate = port<IGetLedgerBalanceToDateQuery>(async (p, db) => {
  const before = date(p.date);
  if (before == null) return [];
  const negate = (amount: string | null) =>
    amount == null ? null : Numeric.of(amount).mul(-1).toString();
  const movements: { entity_id: string | null; amount: string | null; invoice_date: string }[] = [];
  const records = await db.rows('ledger_records');
  for (const r of records)
    movements.push({
      entity_id: r.credit_entity1,
      amount: r.credit_local_amount1,
      invoice_date: r.invoice_date,
    });
  for (const r of records)
    movements.push({
      entity_id: r.credit_entity2,
      amount: r.credit_local_amount2,
      invoice_date: r.invoice_date,
    });
  for (const r of records)
    movements.push({
      entity_id: r.debit_entity1,
      amount: negate(r.debit_local_amount1),
      invoice_date: r.invoice_date,
    });
  for (const r of records)
    movements.push({
      entity_id: r.debit_entity2,
      amount: negate(r.debit_local_amount2),
      invoice_date: r.invoice_date,
    });
  const groups = groupByKey(
    movements.filter(m => m.invoice_date < before && m.entity_id != null),
    m => m.entity_id,
  );
  return [...groups].map(([entityId, rows]) => {
    let sum: Numeric | null = null;
    for (const m of rows)
      if (m.amount != null) sum = sum ? sum.add(m.amount) : Numeric.of(m.amount);
    return { entity_id: entityId, sum: sum ? sum.toString() : null };
  });
});

/**
 * UPDATE ledger_records SET charge_id = COALESCE($chargeId, charge_id), credit_entity1 = COALESCE(...),
 *   ... (every column COALESCE($param, column); reference1 from $reference)
 * WHERE id = $ledgerId AND owner_id = $ownerId RETURNING *
 */
export const updateLedgerRecord = port<IUpdateLedgerRecordQuery>(async (p, db) => {
  if (p.ledgerId == null || p.ownerId == null) return [];
  const result = [];
  for (const record of await db.where('ledger_records', { id: p.ledgerId, owner_id: p.ownerId })) {
    const patch = coalescePatch({
      charge_id: p.chargeId,
      credit_entity1: p.creditEntity1,
      credit_entity2: p.creditEntity2,
      credit_foreign_amount1: numericParam(p.creditForeignAmount1),
      credit_foreign_amount2: numericParam(p.creditForeignAmount2),
      credit_local_amount1: numericParam(p.creditLocalAmount1),
      credit_local_amount2: numericParam(p.creditLocalAmount2),
      currency: p.currency,
      debit_entity1: p.debitEntity1,
      debit_entity2: p.debitEntity2,
      debit_foreign_amount1: numericParam(p.debitForeignAmount1),
      debit_foreign_amount2: numericParam(p.debitForeignAmount2),
      debit_local_amount1: numericParam(p.debitLocalAmount1),
      debit_local_amount2: numericParam(p.debitLocalAmount2),
      description: p.description,
      invoice_date: date(p.invoiceDate),
      reference1: p.reference,
      value_date: date(p.valueDate),
    });
    result.push(await db.update('ledger_records', record, patch as Partial<LedgerRecord>));
  }
  return asResult(result);
});

/**
 * INSERT INTO ledger_records (charge_id, credit_entity1, credit_entity2, credit_foreign_amount1,
 *   credit_foreign_amount2, credit_local_amount1, credit_local_amount2, currency, debit_entity1,
 *   debit_entity2, debit_foreign_amount1, debit_foreign_amount2, debit_local_amount1,
 *   debit_local_amount2, description, invoice_date, owner_id, reference1, value_date)
 * VALUES $$ledgerRecords(...) RETURNING *
 */
export const insertLedgerRecords = port<IInsertLedgerRecordsQuery>(
  async ({ ledgerRecords }, db) => {
    const result = [];
    for (const r of ledgerRecords) {
      const row = await db.insert('ledger_records', {
        charge_id: (r.chargeId ?? null) as never,
        credit_entity1: r.creditEntity1 ?? null,
        credit_entity2: r.creditEntity2 ?? null,
        credit_foreign_amount1: numericParam(r.creditForeignAmount1),
        credit_foreign_amount2: numericParam(r.creditForeignAmount2),
        credit_local_amount1: numericParam(r.creditLocalAmount1),
        credit_local_amount2: numericParam(r.creditLocalAmount2),
        currency: (r.currency ?? null) as never,
        debit_entity1: r.debitEntity1 ?? null,
        debit_entity2: r.debitEntity2 ?? null,
        debit_foreign_amount1: numericParam(r.debitForeignAmount1),
        debit_foreign_amount2: numericParam(r.debitForeignAmount2),
        debit_local_amount1: numericParam(r.debitLocalAmount1),
        debit_local_amount2: numericParam(r.debitLocalAmount2),
        description: r.description ?? null,
        invoice_date: date(r.invoiceDate) as never,
        owner_id: (r.ownerId ?? null) as never,
        reference1: r.reference ?? null,
        value_date: date(r.valueDate) as never,
      });
      if (row) result.push(row);
    }
    return asResult(result);
  },
);

/** DELETE FROM ledger_records WHERE id IN $$ledgerRecordIds AND owner_id = $ownerId */
export const deleteLedgerRecords = port<IDeleteLedgerRecordsQuery>(
  async ({ ledgerRecordIds, ownerId }, db) => {
    for (const r of deletable(db, await db.whereIn('ledger_records', 'id', ledgerRecordIds))) {
      if (ownerId != null && r.owner_id === ownerId) await db.delete('ledger_records', r);
    }
    return [];
  },
);

/** DELETE FROM ledger_records WHERE charge_id IN $$chargeIds AND owner_id = $ownerId */
export const deleteLedgerRecordsByChargeIds = port<IDeleteLedgerRecordsByChargeIdsQuery>(
  async ({ chargeIds, ownerId }, db) => {
    for (const r of deletable(db, await db.whereIn('ledger_records', 'charge_id', chargeIds))) {
      if (ownerId != null && r.owner_id === ownerId) await db.delete('ledger_records', r);
    }
    return [];
  },
);

/** UPDATE ledger_records SET charge_id = $assertChargeID WHERE charge_id = $replaceChargeID RETURNING * */
export const replaceLedgerRecordsChargeId = port<IReplaceLedgerRecordsChargeIdQuery>(
  async ({ assertChargeID, replaceChargeID }, db) => {
    if (replaceChargeID == null) return [];
    const result = [];
    for (const r of await db.where('ledger_records', { charge_id: replaceChargeID })) {
      result.push(
        await db.update('ledger_records', r, { charge_id: (assertChargeID ?? null) as never }),
      );
    }
    return asResult(result);
  },
);

/** UPDATE ledger_records SET locked = TRUE WHERE invoice_date <= $date OR value_date <= $date RETURNING * */
export const lockLedgerRecords = port<ILockLedgerRecordsQuery>(async (p, db) => {
  const until = date(p.date);
  if (until == null) return [];
  const result = [];
  const targets = (await db.rows('ledger_records')).filter(
    r => r.invoice_date <= until || r.value_date <= until,
  );
  for (const r of targets) {
    result.push(await db.update('ledger_records', r, { locked: true }));
  }
  return asResult(result);
});
