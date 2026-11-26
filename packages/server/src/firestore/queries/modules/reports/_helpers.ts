/**
 * Shared by the reports module's ports: the "latest rate on or before" lookups and the USD
 * conversion the annual revenue and balance reports do in SQL, with Postgres numeric semantics.
 */
import type { Row } from '../../../catalog.js';
import { DbError } from '../../../errors.js';
import { Numeric } from '../../../numeric.js';

type ExchangeRate = Row<'exchange_rates'>;
type CryptoRate = Row<'crypto_exchange_rates'>;

/** Fiat currencies the reports convert through the ILS rate table. */
const FIAT_COLUMNS = {
  AUD: 'aud',
  CAD: 'cad',
  EUR: 'eur',
  GBP: 'gbp',
  JPY: 'jpy',
  SEK: 'sek',
} as const satisfies Record<string, keyof ExchangeRate>;

const CRYPTO = new Set(['USDC', 'GRT', 'ETH']);

/**
 * `SELECT ... FROM exchange_rates er WHERE er.exchange_date <= $date ORDER BY er.exchange_date DESC
 * LIMIT 1` for many dates: `exchange_date` is unique, so the row is well defined.
 */
export function exchangeRateLookup(rates: readonly ExchangeRate[]) {
  const sorted = rates
    .filter(r => r.exchange_date != null)
    .slice()
    .sort((a, b) =>
      a.exchange_date! < b.exchange_date! ? -1 : a.exchange_date! > b.exchange_date! ? 1 : 0,
    );
  return (date: string | null): ExchangeRate | null => {
    if (date == null) return null;
    let lo = 0;
    let hi = sorted.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid]!.exchange_date! <= date) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found < 0 ? null : sorted[found]!;
  };
}

/**
 * `SELECT cer.value FROM crypto_exchange_rates cer WHERE cer.date <= $time AND
 * cer.coin_symbol::currency = $currency AND cer.against = 'USD' ORDER BY cer.date DESC LIMIT 1`.
 * (date, coin_symbol) is unique, so the row is well defined. A coin symbol that is not a
 * `currency` label never equals one (see the port notes on the cast).
 */
export function cryptoRateLookup(rates: readonly CryptoRate[]) {
  const bySymbol = new Map<string, CryptoRate[]>();
  for (const rate of rates) {
    if (rate.against !== 'USD') continue;
    const list = bySymbol.get(rate.coin_symbol);
    if (list) list.push(rate);
    else bySymbol.set(rate.coin_symbol, [rate]);
  }
  for (const list of bySymbol.values()) list.sort((a, b) => a.date.getTime() - b.date.getTime());
  return (currency: string, time: Date | null): CryptoRate | null => {
    if (time == null) return null;
    const list = bySymbol.get(currency);
    if (!list) return null;
    const t = time.getTime();
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.date.getTime() <= t) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found < 0 ? null : list[found]!;
  };
}

/** `date::timestamp` (local midnight, as a `timestamp without time zone` row value is held). */
export function dateToTimestamp(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const result = new Date(y, m - 1, d);
  result.setFullYear(y);
  return result;
}

/** numeric `a / b`: NULL if either is NULL, 22012 on division by zero. */
export function numDiv(a: string | null | undefined, b: string | null | undefined): Numeric | null {
  if (a == null || b == null) return null;
  const divisor = Numeric.of(b);
  if (divisor.isZero()) throw new DbError('division by zero', '22012');
  return Numeric.of(a).div(divisor);
}

/** numeric `a * b`: NULL if either is NULL. */
export function numMul(
  a: string | Numeric | null | undefined,
  b: string | Numeric | null | undefined,
): Numeric | null {
  if (a == null || b == null) return null;
  return Numeric.of(a).mul(b);
}

/**
 * Store rows typed as a query's result rows. pgTyped types `date` columns as TimelessDateString;
 * the store's row types say `string`, and hold the same `YYYY-MM-DD` text.
 */
export const asResult = <Q extends { result: unknown }>(rows: readonly unknown[]) =>
  rows as readonly Q['result'][];

/**
 * A sort key that orders uuids as Postgres does (by their 16 bytes), for `ORDER BY ..., id`. Text
 * collation must not decide it.
 */
export function uuidOrder(id: string | null | undefined): bigint | null {
  return id == null ? null : BigInt(`0x${id.replaceAll('-', '')}`);
}

/** numeric `x * -1`. */
export function negate(value: string | null): string | null {
  return value == null ? null : Numeric.of(value).mul(-1).toString();
}

/**
 * The reports' `CASE currency WHEN 'USD' ... END AS amount_usd`:
 *
 *   USD              → usdAmount
 *   ILS              → ilsAmount / lr.usd
 *   AUD, CAD, ... SEK → foreignAmount * (lr.<cur> / lr.usd)
 *   USDC, GRT, ETH   → foreignAmount * lr2.value
 *   anything else    → NULL
 */
export function amountUsd(
  currency: string,
  amounts: {
    usd: string | null;
    ils: string | null;
    foreign: string | null;
  },
  lr: ExchangeRate | null,
  lr2: CryptoRate | null,
): string | null {
  if (currency === 'USD') return amounts.usd;
  if (currency === 'ILS') return numDiv(amounts.ils, lr?.usd)?.toString() ?? null;
  if (currency in FIAT_COLUMNS) {
    const column = FIAT_COLUMNS[currency as keyof typeof FIAT_COLUMNS];
    return numMul(amounts.foreign, numDiv(lr?.[column], lr?.usd))?.toString() ?? null;
  }
  if (CRYPTO.has(currency)) return numMul(amounts.foreign, lr2?.value)?.toString() ?? null;
  return null;
}
