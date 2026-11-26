import { amountUsd, asResult, cryptoRateLookup, exchangeRateLookup } from '../_helpers.js';
import type { IGetNormalizedBalanceTransactionsQuery } from '../../../../../modules/reports/__generated__/balance-report.types.js';
import {
  coalesce,
  extractPart,
  orderBy,
  sqlEquals,
  toDateString,
} from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/**
 * WITH transactions AS (
 *   SELECT t.id, t.charge_id, t.source_description, t.currency,
 *     COALESCE(t.debit_date_override, t.debit_date, t.debit_timestamp::date, t.event_date) AS debit_date,
 *     t.debit_timestamp, t.amount, t.owner_id, t.business_id, t.is_fee,
 *     date_part('month', <debit_date>) AS month, date_part('year', <debit_date>) AS year,
 *     CASE currency WHEN 'USD' THEN t.amount WHEN 'ILS' THEN t.amount / lr.usd
 *       WHEN 'AUD' ... 'SEK' THEN t.amount * (lr.<cur> / lr.usd)
 *       WHEN 'USDC' / 'GRT' / 'ETH' THEN t.amount * lr2.value ELSE NULL END AS amount_usd
 *   FROM transactions t
 *   LEFT JOIN LATERAL (latest exchange_rates with exchange_date <= <debit_date>) lr
 *     ON t.currency IN ('ILS', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'SEK')
 *   LEFT JOIN LATERAL (latest crypto_exchange_rates with date <= t.debit_timestamp,
 *     coin_symbol::currency = t.currency, against = 'USD') lr2 ON t.debit_timestamp IS NOT NULL
 * )
 * SELECT id, charge_id, amount, currency, debit_date, month, year, business_id, is_fee,
 *   source_description, amount_usd
 * FROM transactions t
 * WHERE t.owner_id = $ownerId AND t.debit_date BETWEEN $fromDate AND $toDate
 * ORDER BY t.amount
 *
 * The CTE is inlined, so the WHERE filters rows before amount_usd is computed. ORDER BY amount
 * leaves equal amounts in no defined order (SOFT when a case has ties). A coin symbol that is not
 * a currency label never matches (see annual-revenue-report.provider.ts).
 */
export const getNormalizedBalanceTransactions = port<IGetNormalizedBalanceTransactionsQuery>(
  async ({ ownerId, fromDate, toDate }, db) => {
    if (ownerId == null || fromDate == null || toDate == null) return [];
    const from = toDateString(fromDate);
    const to = toDateString(toDate);

    const selected = (await db.where('transactions', { owner_id: ownerId }))
      .map(t => ({
        t,
        debitDate: coalesce(
          t.debit_date_override,
          t.debit_date,
          t.debit_timestamp == null ? null : toDateString(t.debit_timestamp),
          t.event_date,
        ),
      }))
      .filter(
        ({ t, debitDate }) =>
          sqlEquals(t.owner_id, ownerId) &&
          debitDate != null &&
          debitDate >= from &&
          debitDate <= to,
      );
    if (selected.length === 0) return [];

    const rateOn = exchangeRateLookup(await db.rows('exchange_rates'));
    const cryptoRateAt = cryptoRateLookup(await db.rows('crypto_exchange_rates'));
    const rows = selected.map(({ t, debitDate }) => {
      const lr = rateOn(debitDate);
      const lr2 = t.debit_timestamp == null ? null : cryptoRateAt(t.currency, t.debit_timestamp);
      return {
        id: t.id,
        charge_id: t.charge_id,
        amount: t.amount,
        currency: t.currency,
        debit_date: debitDate,
        month: debitDate == null ? null : extractPart(debitDate, 'month'),
        year: debitDate == null ? null : extractPart(debitDate, 'year'),
        business_id: t.business_id,
        is_fee: t.is_fee,
        source_description: t.source_description,
        amount_usd: amountUsd(
          t.currency,
          { usd: t.amount, ils: t.amount, foreign: t.amount },
          lr,
          lr2,
        ),
      };
    });
    return asResult<IGetNormalizedBalanceTransactionsQuery>(
      orderBy(rows, [{ value: r => r.amount, kind: 'decimal' }]),
    );
  },
);
