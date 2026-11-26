import {
  byTradeDateThenId,
  checkLimitOffset,
  executionColumns,
  executionsOfIdentifiers,
  poalimKeysOfOwner,
} from '../_helpers.js';
import type {
  IGetFilteredSecurityExecutionsQuery,
  IGetOwnerSecurityExecutionsByTradeDatesQuery,
  IGetSecuritiesByKeysQuery,
  IGetSecurityExecutionsByBusinessIdsQuery,
  IGetSecurityExecutionsByChargeIdsQuery,
  IGetSecurityExecutionsQuery,
} from '../../../../../modules/foreign-securities/__generated__/foreign-securities.types.js';
import {
  coalesce,
  countText,
  distinctOn,
  inList,
  limitOffset,
  orderBy,
  toDateString,
} from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/**
 * SELECT DISTINCT ON (owner_id, security_key)
 *   id, owner_id, security_key, eng_name, heb_name, symbol, eng_symbol, heb_symbol,
 *   item_type, stock_type, exchange, currency_code, is_etf, is_foreign, as_of_date
 * FROM poalim_securities
 * WHERE owner_id = $ownerId! AND security_key = ANY($securityKeys!)
 * ORDER BY owner_id, security_key, as_of_date DESC
 *
 * Two accounts of one owner scraped at the same as_of_date leave the kept row undefined in
 * Postgres too.
 */
export const getSecuritiesByKeys = port<IGetSecuritiesByKeysQuery>(
  async ({ ownerId, securityKeys }, db) => {
    if (ownerId == null || securityKeys == null) return [];
    const wanted = inList(securityKeys);
    const rows = (await db.where('poalim_securities', { owner_id: ownerId })).filter(row =>
      wanted(row.security_key),
    );
    const ordered = orderBy(rows, [
      { value: row => row.owner_id },
      { value: row => row.security_key },
      { value: row => row.as_of_date, desc: true },
    ]);
    return distinctOn(ordered, row => [row.owner_id, row.security_key]).map(row => ({
      id: row.id,
      owner_id: row.owner_id,
      security_key: row.security_key,
      eng_name: row.eng_name,
      heb_name: row.heb_name,
      symbol: row.symbol,
      eng_symbol: row.eng_symbol,
      heb_symbol: row.heb_symbol,
      item_type: row.item_type,
      stock_type: row.stock_type,
      exchange: row.exchange,
      currency_code: row.currency_code,
      is_etf: row.is_etf,
      is_foreign: row.is_foreign,
      as_of_date: row.as_of_date,
    }));
  },
);

/**
 * SELECT <execution columns> FROM poalim_securities_transactions
 * WHERE security = ANY($securities!) AND bank_number = ANY($bankNumbers!)
 *   AND branch_number = ANY($branchNumbers!) AND account_number = ANY($accountNumbers!)
 *   AND COALESCE(value_date, trade_date) >= $fromDate! AND trade_date <= $toDate!
 */
export const getSecurityExecutions = port<IGetSecurityExecutionsQuery>(async (params, db) => {
  const { securities, bankNumbers, branchNumbers, accountNumbers, fromDate, toDate } = params;
  if (!securities || !bankNumbers || !branchNumbers || !accountNumbers) return [];
  if (fromDate == null || toDate == null) return [];
  const from = toDateString(fromDate);
  const to = toDateString(toDate);
  const bank = inList(bankNumbers);
  const branch = inList(branchNumbers);
  const account = inList(accountNumbers);
  return (await db.whereIn('poalim_securities_transactions', 'security', securities))
    .filter(
      t =>
        bank(t.bank_number) &&
        branch(t.branch_number) &&
        account(t.account_number) &&
        coalesce(t.value_date, t.trade_date)! >= from &&
        t.trade_date <= to,
    )
    .map(executionColumns);
});

/**
 * SELECT t.<execution columns>, si.business_id AS security_business_id
 * FROM poalim_securities_transactions t
 * INNER JOIN security_identifiers si
 *   ON si.owner_id = t.owner_id AND si.identifier_type = 'POALIM_SECURITY_KEY'
 *   AND si.identifier_value = t.security
 * WHERE si.business_id IN $$businessIds
 * ORDER BY t.trade_date, t.id
 */
export const getSecurityExecutionsByBusinessIds = port<IGetSecurityExecutionsByBusinessIdsQuery>(
  async ({ businessIds }, db) => {
    const identifiers = await db.whereIn('security_identifiers', 'business_id', businessIds);
    const pairs = await executionsOfIdentifiers(db, identifiers);
    return byTradeDateThenId(pairs, pair => pair.t).map(({ t, si }) => ({
      ...executionColumns(t),
      security_business_id: si.business_id,
    }));
  },
);

/**
 * SELECT t.<execution columns>, si.business_id AS security_business_id, COUNT(*) OVER () AS total_count
 * FROM poalim_securities_transactions t
 * INNER JOIN security_identifiers si
 *   ON si.owner_id = t.owner_id AND si.identifier_type = 'POALIM_SECURITY_KEY'
 *   AND si.identifier_value = t.security
 * WHERE si.business_id IN $$businessIds
 *   AND ($isTradeTypes = 0 OR t.trade_type IN $$tradeTypes)
 *   AND ($isTransactionTypes = 0 OR t.transaction_type IN $$transactionTypes)
 *   AND ($fromTradeDate::DATE IS NULL OR t.trade_date >= $fromTradeDate)
 *   AND ($toTradeDate::DATE IS NULL OR t.trade_date <= $toTradeDate)
 * ORDER BY t.trade_date DESC, t.id DESC
 * LIMIT $limit! OFFSET $offset!
 *
 * A NULL `is*` flag makes its `= 0` NULL, so only the IN list can let a row through.
 */
export const getFilteredSecurityExecutions = port<IGetFilteredSecurityExecutionsQuery>(
  async (params, db) => {
    checkLimitOffset(params.limit, params.offset);
    const allTradeTypes = params.isTradeTypes != null && Number(params.isTradeTypes) === 0;
    const allTransactionTypes =
      params.isTransactionTypes != null && Number(params.isTransactionTypes) === 0;
    const tradeType = inList(params.tradeTypes);
    const transactionType = inList(params.transactionTypes);
    const from = params.fromTradeDate == null ? null : toDateString(params.fromTradeDate);
    const to = params.toTradeDate == null ? null : toDateString(params.toTradeDate);

    const identifiers = await db.whereIn('security_identifiers', 'business_id', params.businessIds);
    const matching = (await executionsOfIdentifiers(db, identifiers)).filter(
      ({ t }) =>
        (allTradeTypes || tradeType(t.trade_type)) &&
        (allTransactionTypes || transactionType(t.transaction_type)) &&
        (from == null || t.trade_date >= from) &&
        (to == null || t.trade_date <= to),
    );
    const totalCount = countText(matching.length);
    return limitOffset(
      byTradeDateThenId(matching, pair => pair.t, true),
      params.limit,
      params.offset,
    ).map(({ t, si }) => ({
      ...executionColumns(t),
      security_business_id: si.business_id,
      total_count: totalCount,
    }));
  },
);

/**
 * SELECT t.<execution columns>, si.business_id AS "security_business_id?"
 * FROM poalim_securities_transactions t
 * LEFT JOIN security_identifiers si
 *   ON si.owner_id = t.owner_id AND si.identifier_type = 'POALIM_SECURITY_KEY'
 *   AND si.identifier_value = t.security
 * WHERE t.owner_id = $ownerId! AND t.trade_date >= $fromDate! AND t.trade_date <= $toDate!
 *   AND t.trade_type IN $$tradeTypes
 * ORDER BY t.trade_date, t.id
 *
 * pgTyped strips the `?` nullability hint from the column name: the row field is
 * `security_business_id`.
 */
export const getOwnerSecurityExecutionsByTradeDates =
  port<IGetOwnerSecurityExecutionsByTradeDatesQuery>(
    async ({ ownerId, fromDate, toDate, tradeTypes }, db) => {
      if (ownerId == null || fromDate == null || toDate == null) return [];
      const from = toDateString(fromDate);
      const to = toDateString(toDate);
      const tradeType = inList(tradeTypes);
      const executions = (
        await db.where('poalim_securities_transactions', { owner_id: ownerId })
      ).filter(t => t.trade_date >= from && t.trade_date <= to && tradeType(t.trade_type));
      const keys = await poalimKeysOfOwner(db, ownerId);
      const rows = executions.flatMap(t => {
        const matches = keys.get(t.security) ?? [];
        return matches.length
          ? matches.map(si => ({ t, businessId: si.business_id as string | null }))
          : [{ t, businessId: null }];
      });
      return byTradeDateThenId(rows, row => row.t).map(({ t, businessId }) => ({
        ...executionColumns(t),
        security_business_id: businessId,
      }));
    },
  );

/**
 * SELECT t.<execution columns>, l.charge_id
 * FROM charges_securities_executions l
 * INNER JOIN poalim_securities_transactions t ON t.id = l.execution_id
 * WHERE l.charge_id = ANY($chargeIds!)
 * ORDER BY t.trade_date, t.id
 */
export const getSecurityExecutionsByChargeIds = port<IGetSecurityExecutionsByChargeIdsQuery>(
  async ({ chargeIds }, db) => {
    if (chargeIds == null) return [];
    const links = await db.whereIn('charges_securities_executions', 'charge_id', chargeIds);
    const executions = new Map(
      (
        await db.whereIn(
          'poalim_securities_transactions',
          'id',
          links.map(l => l.execution_id),
        )
      ).map(t => [t.id, t]),
    );
    const rows = links.flatMap(l => {
      const t = executions.get(l.execution_id);
      return t ? [{ t, chargeId: l.charge_id }] : [];
    });
    return byTradeDateThenId(rows, row => row.t).map(({ t, chargeId }) => ({
      ...executionColumns(t),
      charge_id: chargeId,
    }));
  },
);
