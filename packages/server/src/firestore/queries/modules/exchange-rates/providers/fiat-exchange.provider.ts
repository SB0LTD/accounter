import { toDateYmd } from '../_helpers.js';
import type {
  IGetExchangeRatesByDateQuery,
  IGetExchangeRatesByDateResult,
  IGetExchangeRatesByDatesQuery,
} from '../../../../../modules/exchange-rates/__generated__/fiat-exchange.types.js';
import type { Row } from '../../../../catalog.js';
import { limitOffset, maxOf, orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

type ExchangeRateRow = { exchange_date: string | null };

/** pgTyped types exchange_date as TimelessDateString; rows hold the same `YYYY-MM-DD` text. */
const newestFirst = (rows: readonly Row<'exchange_rates'>[]) =>
  orderBy(rows, [
    { value: row => row.exchange_date, desc: true, kind: 'date' },
  ]) as IGetExchangeRatesByDateResult[];

/** Rows dated on or before `date` (a NULL exchange_date never qualifies). */
const onOrBefore = <T extends ExchangeRateRow>(rows: readonly T[], date: string) =>
  rows.filter(row => row.exchange_date != null && row.exchange_date <= date);

/**
 * SELECT * FROM exchange_rates
 * WHERE exchange_date <= to_date($date, 'YYYY-MM-DD')
 * ORDER BY exchange_date DESC LIMIT 1
 *
 * exchange_date is unique (NULLs aside, and those never match), so the row is determined.
 */
export const getExchangeRatesByDate = port<IGetExchangeRatesByDateQuery>(async ({ date }, db) => {
  const until = toDateYmd(date);
  if (until == null) return [];
  return limitOffset(newestFirst(onOrBefore(await db.rows('exchange_rates'), until)), 1);
});

/**
 * SELECT * FROM exchange_rates
 * WHERE exchange_date BETWEEN (
 *     SELECT exchange_date FROM exchange_rates
 *     WHERE exchange_date <= to_date($fromDate, 'YYYY-MM-DD')
 *     ORDER BY exchange_date DESC LIMIT 1
 *   ) AND to_date($toDate, 'YYYY-MM-DD')
 * ORDER BY exchange_date DESC
 *
 * No rate on or before fromDate makes the lower bound NULL, and then no row qualifies.
 */
export const getExchangeRatesByDates = port<IGetExchangeRatesByDatesQuery>(
  async ({ fromDate, toDate }, db) => {
    const from = toDateYmd(fromDate);
    const to = toDateYmd(toDate);
    const rows = await db.rows('exchange_rates');
    const lower =
      from == null
        ? null
        : maxOf(
            onOrBefore(rows, from).map(row => row.exchange_date),
            'date',
          );
    if (lower == null || to == null) return [];
    return newestFirst(
      rows.filter(
        row => row.exchange_date != null && row.exchange_date >= lower && row.exchange_date <= to,
      ),
    );
  },
);
