/**
 * Postgres semantics that ported queries need, in one place so every port gets them the same way.
 * See docs/firestore/porting.md for when to use which.
 */
import { Numeric, type NumericInput } from './numeric.js';
import type { ColumnKind } from './schema/catalog-types.js';
import { compareEnum, compareValues, equalityKey, toDateString } from './values.js';

export { orderBy, compareValues, compareEnum, equalityKey, toDateString } from './values.js';
export { Numeric, num, sumNumeric, avgNumeric } from './numeric.js';

// ---------------------------------------------------------------------------------------------
// NULL and COALESCE
// ---------------------------------------------------------------------------------------------

/** `COALESCE(a, b, ...)` */
export function coalesce<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) if (value !== null && value !== undefined) return value;
  return null;
}

/**
 * The `SET col = COALESCE($param, col)` update pattern: only the non-null params change their
 * columns. Pass `{ column: param }`; null/undefined entries are dropped.
 */
export function coalescePatch<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

/** SQL `=`: false when either side is NULL (use for joins and WHERE). */
export function sqlEquals(a: unknown, b: unknown, kind?: ColumnKind): boolean {
  const ka = equalityKey(a, kind);
  return ka !== null && ka === equalityKey(b, kind);
}

/** `col = ANY($array)` / `col IN $$list`: a membership test with SQL equality. */
export function inList(values: readonly unknown[] | null | undefined, kind?: ColumnKind) {
  const keys = new Set<string>();
  for (const value of values ?? []) {
    const key = equalityKey(value, kind);
    if (key !== null) keys.add(key);
  }
  return (value: unknown): boolean => {
    const key = equalityKey(value, kind);
    return key !== null && keys.has(key);
  };
}

/** `IS DISTINCT FROM`'s complement: equal, with NULL equal to NULL. */
export function notDistinct(a: unknown, b: unknown, kind?: ColumnKind): boolean {
  if (a == null || b == null) return a == null && b == null;
  return equalityKey(a, kind) === equalityKey(b, kind);
}

// ---------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------

/** `text ILIKE pattern` with `%` and `_` wildcards and `\` escapes. NULL text never matches. */
export function ilike(text: unknown, pattern: string): boolean {
  if (text == null) return false;
  return likeRegex(pattern, 'iu').test(String(text));
}

/** `text LIKE pattern` (case-sensitive). */
export function like(text: unknown, pattern: string): boolean {
  if (text == null) return false;
  return likeRegex(pattern, 'u').test(String(text));
}

const likeCache = new Map<string, RegExp>();
function likeRegex(pattern: string, flags: string): RegExp {
  const cacheKey = `${flags}:${pattern}`;
  let re = likeCache.get(cacheKey);
  if (!re) {
    let source = '';
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i]!;
      if (ch === '\\' && i + 1 < pattern.length) source += escapeRegex(pattern[++i]!);
      else if (ch === '%') source += '[\\s\\S]*';
      else if (ch === '_') source += '[\\s\\S]';
      else source += escapeRegex(ch);
    }
    re = new RegExp(`^${source}$`, flags);
    likeCache.set(cacheKey, re);
  }
  return re;
}

const escapeRegex = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `col ILIKE '%' || $text || '%'`: substring match, case-insensitive. */
export function containsInsensitive(text: unknown, needle: string | null | undefined): boolean {
  if (text == null || needle == null) return false;
  return ilike(text, `%${needle}%`);
}

/** `concat_ws(sep, ...)`: skips NULLs. */
export function concatWs(separator: string, ...parts: unknown[]): string {
  return parts
    .filter(p => p !== null && p !== undefined)
    .map(p => String(p))
    .join(separator);
}

/** `concat(...)` / `a || b` with concat's NULL-as-empty behaviour. (`||` itself yields NULL.) */
export function concat(...parts: unknown[]): string {
  return parts.map(p => (p == null ? '' : String(p))).join('');
}

/** `numeric::text` as Postgres prints it. */
export function numericText(value: NumericInput | null | undefined): string | null {
  return value == null ? null : Numeric.of(value).toString();
}

// ---------------------------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------------------------

/** GROUP BY: rows grouped by a key, in first-seen order. */
export function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

/** `count(*)` / `count(x)`: a bigint, which pg returns as a string. */
export function countText(n: number): string {
  return String(n);
}

/** `sum(integer)` is bigint (string); `sum(numeric)` is numeric (string). NULL for no inputs. */
export function sumText(values: Iterable<unknown>): string | null {
  let total: Numeric | null = null;
  for (const value of values) {
    if (value == null) continue;
    total = total ? total.add(value as NumericInput) : Numeric.of(value as NumericInput);
  }
  return total ? total.toString() : null;
}

/** `min(x)` / `max(x)` over non-null values, by Postgres ordering. NULL for no inputs. */
export function minOf<T>(values: Iterable<T | null | undefined>, kind?: ColumnKind): T | null {
  let best: T | null = null;
  for (const value of values) {
    if (value == null) continue;
    if (best === null || compareValues(value, best, kind) < 0) best = value;
  }
  return best;
}

export function maxOf<T>(values: Iterable<T | null | undefined>, kind?: ColumnKind): T | null {
  let best: T | null = null;
  for (const value of values) {
    if (value == null) continue;
    if (best === null || compareValues(value, best, kind) > 0) best = value;
  }
  return best;
}

/**
 * `array_agg(DISTINCT x)`: Postgres sorts to remove duplicates, so the result is ascending with a
 * NULL (if any) last. NULL for no input rows.
 */
export function arrayAggDistinct<T>(
  values: readonly (T | null | undefined)[],
  kind?: ColumnKind | { enumType: string },
): (T | null)[] | null {
  if (values.length === 0) return null;
  const seen = new Map<string, T>();
  let hasNull = false;
  for (const value of values) {
    if (value == null) hasNull = true;
    else {
      const key = equalityKey(value, typeof kind === 'object' ? undefined : kind)!;
      if (!seen.has(key)) seen.set(key, value);
    }
  }
  const sorted: (T | null)[] = [...seen.values()].sort((a, b) =>
    typeof kind === 'object'
      ? compareEnum(kind.enumType, String(a), String(b))
      : compareValues(a, b, kind),
  );
  if (hasNull) sorted.push(null);
  return sorted;
}

/** `array_agg(x)` in input order (give it ordered input when the SQL has ORDER BY). NULL for none. */
export function arrayAgg<T>(values: readonly T[]): T[] | null {
  return values.length === 0 ? null : [...values];
}

/** `bool_or` / `bool_and` over non-null values; NULL for none. */
export function boolOr(values: Iterable<boolean | null | undefined>): boolean | null {
  let seen = false;
  for (const value of values) {
    if (value == null) continue;
    if (value) return true;
    seen = true;
  }
  return seen ? false : null;
}

export function boolAnd(values: Iterable<boolean | null | undefined>): boolean | null {
  let seen = false;
  for (const value of values) {
    if (value == null) continue;
    if (!value) return false;
    seen = true;
  }
  return seen ? true : null;
}

/** `DISTINCT ON (key) ... ORDER BY key, ...`: the first row of each key, in order. */
export function distinctOn<T>(orderedRows: readonly T[], key: (row: T) => unknown): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of orderedRows) {
    const k = JSON.stringify(equalityKey(key(row)) ?? '∅');
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(row);
  }
  return result;
}

/** `SELECT DISTINCT` over whole result rows. */
export function distinctRows<T extends Record<string, unknown>>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = JSON.stringify(
      Object.keys(row)
        .sort()
        .map(k => [k, equalityKey(row[k])]),
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** `LIMIT $limit OFFSET $offset`, where NULL means no limit / no offset. */
export function limitOffset<T>(
  rows: readonly T[],
  limit?: number | string | null,
  offset?: number | string | null,
): T[] {
  const start = offset == null ? 0 : Number(offset);
  const end = limit == null ? undefined : start + Number(limit);
  return rows.slice(start, end);
}

/** `unnest($a::type[], $b::type[], ...)`: rows from parallel arrays, padded with NULL. */
export function unnestZip<T extends unknown[][]>(
  ...arrays: T
): { [K in keyof T]: T[K][number] | null }[] {
  const length = Math.max(0, ...arrays.map(a => a?.length ?? 0));
  return Array.from({ length }, (_, i) => arrays.map(a => a?.[i] ?? null)) as never;
}

// ---------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------

/** `date_trunc('month' | 'year', d)::date` on a `YYYY-MM-DD` string. */
export function truncDate(date: string, unit: 'month' | 'year'): string {
  const d = toDateString(date);
  return unit === 'year' ? `${d.slice(0, 4)}-01-01` : `${d.slice(0, 7)}-01`;
}

/** `EXTRACT(YEAR | MONTH FROM d)` as a number. */
export function extractPart(date: string | Date, part: 'year' | 'month' | 'day'): number {
  const d = toDateString(date);
  return Number(
    part === 'year' ? d.slice(0, 4) : part === 'month' ? d.slice(5, 7) : d.slice(8, 10),
  );
}

/** `d + interval 'n days'` / `n months` / `n years` on a date string, as Postgres does (month-end clamped). */
export function addToDate(date: string, amount: number, unit: 'day' | 'month' | 'year'): string {
  const [y, m, d] = toDateString(date).split('-').map(Number) as [number, number, number];
  if (unit === 'day') {
    const t = new Date(Date.UTC(y, m - 1, d + amount));
    return t.toISOString().slice(0, 10);
  }
  const totalMonths = y * 12 + (m - 1) + (unit === 'year' ? amount * 12 : amount);
  const ny = Math.floor(totalMonths / 12);
  const nm = (totalMonths % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** `timestamptz::date` in the server's time zone (Cloud Run and the harness run in UTC). */
export function timestampToDate(value: Date): string {
  return toDateString(value);
}
