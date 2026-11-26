import type {
  IGetSimilarTransactionsQuery,
  IGetTransactionsByChargeIdsQuery,
  IGetTransactionsByExtendedFiltersQuery,
  IGetTransactionsByFiltersQuery,
  IGetTransactionsByIdsQuery,
  IGetTransactionsByMissingRequiredInfoQuery,
  IReplaceTransactionsChargeIdQuery,
  IUpdateTransactionsQuery,
} from '../../../../../modules/transactions/__generated__/transactions.types.js';
import type { Row } from '../../../../catalog.js';
import {
  coalescePatch,
  containsInsensitive,
  inList,
  Numeric,
  orderBy,
  toDateString,
} from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

type Transaction = Row<'transactions'>;

const date = (value: string | null | void) => (value == null ? null : toDateString(value));
const debitDate = (t: Transaction) => t.debit_date_override ?? t.debit_date;

/** transactions rows as the query result (the store types date columns as plain strings). */
const asResult = (rows: readonly Transaction[]): never => rows as never;

/**
 * ORDER BY event_date DESC. Transactions sharing an event date have no defined order in Postgres;
 * here they keep the table's order.
 */
const byEventDateDesc = (rows: readonly Transaction[]) =>
  asResult(orderBy(rows, [{ value: t => t.event_date, desc: true, kind: 'date' }]));

/** SELECT * FROM transactions WHERE id IN $$transactionIds */
export const getTransactionsByIds = port<IGetTransactionsByIdsQuery>(
  async ({ transactionIds }, db) =>
    asResult(await db.whereIn('transactions', 'id', transactionIds)),
);

/** SELECT * FROM transactions WHERE charge_id IN $$chargeIds */
export const getTransactionsByChargeIds = port<IGetTransactionsByChargeIdsQuery>(
  async ({ chargeIds }, db) => asResult(await db.whereIn('transactions', 'charge_id', chargeIds)),
);

/** SELECT * FROM transactions WHERE business_id IS NULL */
export const getTransactionsByMissingRequiredInfo =
  port<IGetTransactionsByMissingRequiredInfoQuery>(async (_params, db) =>
    asResult((await db.rows('transactions')).filter(t => t.business_id == null)),
  );

/**
 * SELECT * FROM transactions
 * WHERE ($isIDs = 0 OR id IN $$IDs)
 *   AND ($fromEventDate::TEXT IS NULL OR event_date >= $fromEventDate::DATE)
 *   AND ($toEventDate::TEXT IS NULL OR event_date <= $toEventDate::DATE)
 *   AND ($fromDebitDate::TEXT IS NULL OR COALESCE(debit_date_override, debit_date) >= $fromDebitDate::DATE)
 *   AND ($toDebitDate::TEXT IS NULL OR COALESCE(debit_date_override, debit_date) <= $toDebitDate::DATE)
 *   AND ($isBusinessIDs = 0 OR business_id IN $$businessIDs)
 *   AND ($isOwnerIDs = 0 OR owner_id IN $$ownerIDs)
 * ORDER BY event_date DESC
 */
export const getTransactionsByFilters = port<IGetTransactionsByFiltersQuery>(async (p, db) => {
  const inIds = inList(p.IDs);
  const inBusinesses = inList(p.businessIDs);
  const inOwners = inList(p.ownerIDs);
  const fromEvent = date(p.fromEventDate);
  const toEvent = date(p.toEventDate);
  const fromDebit = date(p.fromDebitDate);
  const toDebit = date(p.toDebitDate);
  const rows = (await db.rows('transactions')).filter(t => {
    const debit = debitDate(t);
    return (
      (p.isIDs === 0 || inIds(t.id)) &&
      (fromEvent == null || t.event_date >= fromEvent) &&
      (toEvent == null || t.event_date <= toEvent) &&
      (fromDebit == null || (debit != null && debit >= fromDebit)) &&
      (toDebit == null || (debit != null && debit <= toDebit)) &&
      (p.isBusinessIDs === 0 || inBusinesses(t.business_id)) &&
      (p.isOwnerIDs === 0 || inOwners(t.owner_id))
    );
  });
  return byEventDateDesc(rows);
});

/**
 * SELECT t.* FROM transactions t LEFT JOIN financial_entities fe ON fe.id = t.business_id
 * WHERE ($isIDs = 0 OR t.id IN $$IDs) AND ($isChargeIDs = 0 OR t.charge_id IN $$chargeIDs)
 *   AND ($isOwnerIDs = 0 OR t.owner_id IN $$ownerIDs) AND ($isCounterpartyIDs = 0 OR t.business_id IN $$counterpartyIDs)
 *   AND event / debit date bounds (as getTransactionsByFilters)
 *   AND (($fromAnyDate IS NULL AND $toAnyDate IS NULL)
 *        OR (t.event_date IS NOT NULL AND event_date within the bounds)
 *        OR (COALESCE(debit_date_override, debit_date) IS NOT NULL AND it is within the bounds))
 *   AND ($withMissingCounterparty = FALSE OR t.business_id IS NULL)
 *   AND ($withMissingInfo = FALSE OR t.business_id IS NULL OR (t.debit_date IS NULL AND t.debit_date_override IS NULL))
 *   AND ($freeText IS NULL OR source_description / source_reference / counter_account / origin_key /
 *        fe.name ILIKE '%' || $freeText || '%'
 *        OR ($freeTextNumeric IS NOT NULL AND (amount::TEXT or ABS(amount)::TEXT ILIKE '%' || $freeTextNumeric || '%')))
 * ORDER BY t.event_date DESC
 */
export const getTransactionsByExtendedFilters = port<IGetTransactionsByExtendedFiltersQuery>(
  async (p, db) => {
    const names = new Map((await db.rows('financial_entities')).map(fe => [fe.id, fe.name]));
    const inIds = inList(p.IDs);
    const inCharges = inList(p.chargeIDs);
    const inOwners = inList(p.ownerIDs);
    const inCounterparties = inList(p.counterpartyIDs);
    const fromEvent = date(p.fromEventDate);
    const toEvent = date(p.toEventDate);
    const fromDebit = date(p.fromDebitDate);
    const toDebit = date(p.toDebitDate);
    const fromAny = date(p.fromAnyDate);
    const toAny = date(p.toAnyDate);
    const within = (d: string | null) =>
      d != null && (fromAny == null || d >= fromAny) && (toAny == null || d <= toAny);
    const freeText = p.freeText ?? null;
    const freeTextNumeric = p.freeTextNumeric ?? null;
    const textMatches = (t: Transaction) => {
      if (freeText == null) return true;
      const name = t.business_id == null ? null : (names.get(t.business_id) ?? null);
      if (
        containsInsensitive(t.source_description, freeText) ||
        containsInsensitive(t.source_reference, freeText) ||
        containsInsensitive(t.counter_account, freeText) ||
        containsInsensitive(t.origin_key, freeText) ||
        containsInsensitive(name, freeText)
      ) {
        return true;
      }
      if (freeTextNumeric == null) return false;
      const amount = Numeric.of(t.amount);
      return (
        containsInsensitive(amount.toString(), freeTextNumeric) ||
        containsInsensitive(amount.abs().toString(), freeTextNumeric)
      );
    };
    const rows = (await db.rows('transactions')).filter(t => {
      const debit = debitDate(t);
      return (
        (p.isIDs === 0 || inIds(t.id)) &&
        (p.isChargeIDs === 0 || inCharges(t.charge_id)) &&
        (p.isOwnerIDs === 0 || inOwners(t.owner_id)) &&
        (p.isCounterpartyIDs === 0 || inCounterparties(t.business_id)) &&
        (fromEvent == null || t.event_date >= fromEvent) &&
        (toEvent == null || t.event_date <= toEvent) &&
        (fromDebit == null || (debit != null && debit >= fromDebit)) &&
        (toDebit == null || (debit != null && debit <= toDebit)) &&
        ((fromAny == null && toAny == null) || within(t.event_date) || within(debit)) &&
        (p.withMissingCounterparty === false || t.business_id == null) &&
        (p.withMissingInfo === false ||
          t.business_id == null ||
          (t.debit_date == null && t.debit_date_override == null)) &&
        textMatches(t)
      );
    });
    return byEventDateDesc(rows);
  },
);

/**
 * SELECT * FROM transactions
 * WHERE (CASE WHEN $withMissingInfo IS TRUE THEN business_id IS NULL ELSE TRUE END)
 *   AND ((source_description IS NOT NULL AND source_description <> '' AND source_description = $details)
 *        OR (counter_account IS NOT NULL AND counter_account <> '' AND counter_account = $counterAccount))
 *   AND owner_id = $ownerId
 */
export const getSimilarTransactions = port<IGetSimilarTransactionsQuery>(
  async ({ withMissingInfo, details, counterAccount, ownerId }, db) => {
    if (ownerId == null) return [];
    return asResult(
      (await db.where('transactions', { owner_id: ownerId })).filter(
        t =>
          (withMissingInfo !== true || t.business_id == null) &&
          ((t.source_description != null &&
            t.source_description !== '' &&
            details != null &&
            t.source_description === details) ||
            (t.counter_account != null &&
              t.counter_account !== '' &&
              counterAccount != null &&
              t.counter_account === counterAccount)),
      ),
    );
  },
);

/** UPDATE transactions SET charge_id = $assertChargeID WHERE charge_id = $replaceChargeID RETURNING id */
export const replaceTransactionsChargeId = port<IReplaceTransactionsChargeIdQuery>(
  async ({ assertChargeID, replaceChargeID }, db) => {
    if (replaceChargeID == null) return [];
    const result = [];
    for (const t of await db.where('transactions', { charge_id: replaceChargeID })) {
      const updated = await db.update('transactions', t, {
        charge_id: (assertChargeID ?? null) as never,
      });
      result.push({ id: updated.id });
    }
    return result;
  },
);

/**
 * UPDATE transactions SET account_id = COALESCE($accountId, account_id, NULL),
 *   charge_id = COALESCE($chargeId, charge_id, NULL), debit_date_override = COALESCE($debitDate, debit_date_override, NULL),
 *   business_id = COALESCE($businessId, business_id, NULL), is_fee = COALESCE($isFee, is_fee, NULL)
 * WHERE id IN $$transactionIds RETURNING *
 */
export const updateTransactions = port<IUpdateTransactionsQuery>(async (p, db) => {
  const result = [];
  for (const t of await db.whereIn('transactions', 'id', p.transactionIds)) {
    const patch = coalescePatch({
      account_id: p.accountId,
      charge_id: p.chargeId,
      debit_date_override: date(p.debitDate),
      business_id: p.businessId,
      is_fee: p.isFee,
    });
    result.push(await db.update('transactions', t, patch as Partial<Transaction>));
  }
  return asResult(result);
});
