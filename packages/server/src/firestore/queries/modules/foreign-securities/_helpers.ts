/**
 * Shared pieces of the foreign-securities ports: the execution column list the provider selects
 * everywhere, and the `security_identifiers` bridge from a Poalim security key to its business.
 */
import type { TimelessDateString } from '../../../../shared/types/index.js';
import type { Row } from '../../../catalog.js';
import { DbError } from '../../../errors.js';
import type { QueryDb } from '../../../query-db.js';
import { groupBy, orderBy } from '../../../sql-helpers.js';

export type Execution = Row<'poalim_securities_transactions'>;
export type Identifier = Row<'security_identifiers'>;

/** pgTyped types date columns as TimelessDateString; rows hold the same `YYYY-MM-DD` text. */
const date = (value: string) => value as TimelessDateString;
const dateOrNull = (value: string | null) => value as TimelessDateString | null;

/** The execution columns `foreign-securities.provider.ts` selects, in its order. */
export function executionColumns(t: Execution) {
  return {
    id: t.id,
    owner_id: t.owner_id,
    security: t.security,
    bank_number: t.bank_number,
    branch_number: t.branch_number,
    account_number: t.account_number,
    trade_date: date(t.trade_date),
    value_date: dateOrNull(t.value_date),
    settlement_date: dateOrNull(t.settlement_date),
    payment_date: dateOrNull(t.payment_date),
    trade_type: t.trade_type,
    transaction_type: t.transaction_type,
    nv: t.nv,
    trade_price: t.trade_price,
    trade_gross_value_trade_currency: t.trade_gross_value_trade_currency,
    net_value_trade_currency: t.net_value_trade_currency,
    net_value_settlement_currency: t.net_value_settlement_currency,
    net_value_nis: t.net_value_nis,
    trade_currency: t.trade_currency,
    settlement_currency: t.settlement_currency,
    trade_commission_value_trade_currency: t.trade_commission_value_trade_currency,
    trade_commission_value_nis: t.trade_commission_value_nis,
    commissions_currency: t.commissions_currency,
    management_fees_value_trade_currency: t.management_fees_value_trade_currency,
    israe_tax_value: t.israe_tax_value,
    nominal_profit_loss_nis: t.nominal_profit_loss_nis,
    nominal_profit_loss_linkage: t.nominal_profit_loss_linkage,
    real_profit_loss_nis: t.real_profit_loss_nis,
    payment_type: t.payment_type,
    symbol: t.symbol,
    isin: t.isin,
    issuer_country_code: t.issuer_country_code,
    foreign_tax_value_settlement_currency: t.foreign_tax_value_settlement_currency,
    israel_tax_value_by_payments_settlement_currency:
      t.israel_tax_value_by_payments_settlement_currency,
    capital_tax_value_settlement_currency: t.capital_tax_value_settlement_currency,
    is_cancel_transaction: t.is_cancel_transaction,
    trade_gross_value_nis: t.trade_gross_value_nis,
    personal_currency_rate: t.personal_currency_rate,
  };
}

const ownedKey = (ownerId: string, value: string) => `${ownerId}\u0000${value}`;

/**
 * `poalim_securities_transactions t JOIN security_identifiers si ON si.owner_id = t.owner_id
 *  AND si.identifier_type = 'POALIM_SECURITY_KEY' AND si.identifier_value = t.security`
 * for the given identifier rows: each execution paired with each identifier it matches.
 */
export async function executionsOfIdentifiers(
  db: QueryDb,
  identifiers: readonly Identifier[],
): Promise<{ t: Execution; si: Identifier }[]> {
  const poalimKeys = identifiers.filter(si => si.identifier_type === 'POALIM_SECURITY_KEY');
  const byOwnedKey = groupBy(poalimKeys, si => ownedKey(si.owner_id, si.identifier_value));
  const executions = await db.whereIn('poalim_securities_transactions', 'security', [
    ...new Set(poalimKeys.map(si => si.identifier_value)),
  ]);
  const pairs: { t: Execution; si: Identifier }[] = [];
  for (const t of executions) {
    for (const si of byOwnedKey.get(ownedKey(t.owner_id, t.security)) ?? []) pairs.push({ t, si });
  }
  return pairs;
}

/** The Poalim-key identifier rows of one owner, by key (for a LEFT JOIN from executions). */
export async function poalimKeysOfOwner(
  db: QueryDb,
  ownerId: string,
): Promise<Map<string, Identifier[]>> {
  const rows = await db.where('security_identifiers', {
    owner_id: ownerId,
    identifier_type: 'POALIM_SECURITY_KEY',
  });
  return groupBy(rows, si => si.identifier_value);
}

/** ORDER BY t.trade_date, t.id (ascending or descending). */
export function byTradeDateThenId<T>(
  rows: readonly T[],
  execution: (row: T) => Execution,
  desc = false,
) {
  return orderBy(rows, [
    { value: row => execution(row).trade_date, kind: 'date', desc },
    { value: row => execution(row).id, desc },
  ]);
}

/** `LIMIT $limit OFFSET $offset` with Postgres's checks on negative values. */
export function checkLimitOffset(
  limit: number | string | null | undefined,
  offset: number | string | null | undefined,
) {
  if (limit != null && Number(limit) < 0) {
    throw new DbError('LIMIT must not be negative', '2201W');
  }
  if (offset != null && Number(offset) < 0) {
    throw new DbError('OFFSET must not be negative', '2201X');
  }
}
