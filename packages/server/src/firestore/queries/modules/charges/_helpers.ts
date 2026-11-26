/**
 * Helpers shared by the charges, ledger, transactions, bank-deposits and manual-automations ports.
 * Postgres semantics the store core does not (yet) provide in sql-helpers.ts.
 */
import { DbError } from '../../../errors.js';
import { Numeric, type NumericInput } from '../../../numeric.js';
import type { QueryDb } from '../../../query-db.js';

// ---------------------------------------------------------------------------------------------
// Row-level security of DELETE
// ---------------------------------------------------------------------------------------------

/**
 * The rows a DELETE may remove: tenant tables carry a restrictive `tenant_isolation_delete` policy
 * (`owner_id = current_business_id`), so rows of other tenants in the read scope are skipped, not
 * an error.
 */
export function deletable<T extends { owner_id: string }>(db: QueryDb, rows: readonly T[]): T[] {
  const businessId = db.ctx.businessId;
  return rows.filter(row => businessId != null && row.owner_id === businessId);
}

// ---------------------------------------------------------------------------------------------
// Three-valued logic (true / false / null = unknown)
// ---------------------------------------------------------------------------------------------

export type Bool3 = boolean | null;

export function and3(...values: Bool3[]): Bool3 {
  let unknown = false;
  for (const v of values) {
    if (v === false) return false;
    if (v === null) unknown = true;
  }
  return unknown ? null : true;
}

export function or3(...values: Bool3[]): Bool3 {
  let unknown = false;
  for (const v of values) {
    if (v === true) return true;
    if (v === null) unknown = true;
  }
  return unknown ? null : false;
}

export const not3 = (v: Bool3): Bool3 => (v === null ? null : !v);

/** SQL `=` on scalars: NULL when either side is NULL. */
export function eq3(a: unknown, b: unknown): Bool3 {
  if (a == null || b == null) return null;
  return a === b;
}

// ---------------------------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------------------------

/** uuid ordering (byte order of the 16 bytes = order of the lowercase hex text). */
export const compareUuid = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** `array_agg(DISTINCT uuid)` with the NULLs dropped, ascending. */
export function distinctUuids(values: Iterable<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) if (v != null) set.add(v);
  return [...set].sort(compareUuid);
}

/** `a && b` (overlap): NULL when either array is NULL; NULL elements never match. */
export function overlaps(
  a: readonly (string | null)[] | null | undefined,
  b: readonly (string | null | undefined)[] | null | undefined | void,
): Bool3 {
  if (a == null || b == null) return null;
  const set = new Set(a.filter(v => v != null));
  return b.some(v => v != null && set.has(v));
}

/** `a @> b` (contains): every element of `b` is in `a`; a NULL element of `b` is never found. */
export function arrayContains(
  a: readonly (string | null)[] | null | undefined,
  b: readonly (string | null | undefined)[] | null | undefined | void,
): Bool3 {
  if (a == null || b == null) return null;
  const set = new Set(a.filter(v => v != null));
  return b.every(v => v != null && set.has(v));
}

/** `x = ANY(array)`: NULL when x or the array is NULL, or no match but the array holds a NULL. */
export function anyEquals(x: unknown, array: readonly unknown[] | null | undefined | void): Bool3 {
  if (array == null || x == null) return null;
  let sawNull = false;
  for (const v of array) {
    if (v == null) sawNull = true;
    else if (v === x) return true;
  }
  return sawNull ? null : false;
}

// ---------------------------------------------------------------------------------------------
// Dates and timestamps
// ---------------------------------------------------------------------------------------------

/** min / max over `YYYY-MM-DD` strings (or Dates), skipping NULL; NULL for no input. */
export function minDate(values: Iterable<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of values) if (v != null && (best === null || v < best)) best = v;
  return best;
}

export function maxDate(values: Iterable<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of values) if (v != null && (best === null || v > best)) best = v;
  return best;
}

export function minTime(values: Iterable<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const v of values)
    if (v != null && (best === null || v.getTime() < best.getTime())) best = v;
  return best;
}

export function maxTime(values: Iterable<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const v of values)
    if (v != null && (best === null || v.getTime() > best.getTime())) best = v;
  return best;
}

/**
 * `date::timestamp` (midnight) as `pg` hands a `timestamp without time zone` back: a Date at local
 * midnight of the server process (UTC on Cloud Run and in the harness).
 */
export function dateToTimestamp(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** `GREATEST(...)` / `LEAST(...)` over date strings: NULLs ignored, NULL only if all are NULL. */
export const greatestDate = (...values: (string | null | undefined)[]) => maxDate(values);
export const leastDate = (...values: (string | null | undefined)[]) => minDate(values);

// ---------------------------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------------------------

/** `sum(float8)`: double addition in input order; NULL when there is no non-null input. */
export function sumFloat(values: Iterable<number | null | undefined>): number | null {
  let total: number | null = null;
  for (const v of values) if (v != null) total = total === null ? v : total + v;
  return total;
}

/** `sum(numeric)` as text (Postgres scale); NULL when there is no non-null input. */
export function sumNumericText(values: Iterable<NumericInput | null | undefined>): string | null {
  let total: Numeric | null = null;
  for (const v of values) if (v != null) total = total ? total.add(v) : Numeric.of(v);
  return total ? total.toString() : null;
}

/** `float8::numeric` (15 significant digits, as Postgres casts it). */
export function floatToNumericText(value: number | null | undefined): string | null {
  return value == null ? null : Numeric.fromFloat8(value).toString();
}

/**
 * `float8::text`: the shortest text that reads back as the same double (Postgres 12+), in fixed
 * notation for exponents -4..14 and `1e+15` / `1.5e-05` style otherwise.
 */
export function floatText(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return 'Infinity';
  if (value === -Infinity) return '-Infinity';
  if (value === 0) return Object.is(value, -0) ? '-0' : '0';
  // toExponential() without digits gives the shortest round-trip mantissa, as Postgres's Ryu does.
  const [mantissa, e] = value.toExponential().split('e') as [string, string];
  const exponent = Number(e);
  if (exponent >= -4 && exponent < 15) return String(value);
  return `${mantissa}e${exponent < 0 ? '-' : '+'}${String(Math.abs(exponent)).padStart(2, '0')}`;
}

/**
 * A numeric query parameter as Postgres receives it: `pg` sends a JS number as `String(n)` (all its
 * shortest round-trip digits), not through a float8 cast, so parse that text.
 */
export function numericParam(value: NumericInput | null | undefined | void): string | null {
  if (value == null) return null;
  if (typeof value === 'number') return Numeric.parse(String(value)).toString();
  return Numeric.of(value).toString();
}

/**
 * A value stored in a `numeric(precision, scale)` column: rounded half away from zero to the scale,
 * 22003 when it does not fit the precision.
 */
export function toNumericTypmod(
  value: NumericInput | null | undefined | void,
  precision: number,
  scale: number,
): string | null {
  if (value == null) return null;
  const rounded = Numeric.of(numericParam(value)!).withScale(scale);
  const digits = rounded.abs().unscaled.toString().replace(/^0+/, '');
  if (digits.length > precision) {
    throw new DbError('numeric field overflow', '22003', {
      detail: `A field with precision ${precision}, scale ${scale} must round to an absolute value less than 10^${precision - scale}.`,
    });
  }
  return rounded.toString();
}

/** Numeric comparison of two non-null numeric texts. */
export const numericCompare = (a: NumericInput, b: NumericInput) => Numeric.of(a).cmp(b);

// ---------------------------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------------------------

/** GROUP BY a nullable key, in first-seen order (NULLs form one group, as in SQL). */
export function groupByKey<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}
