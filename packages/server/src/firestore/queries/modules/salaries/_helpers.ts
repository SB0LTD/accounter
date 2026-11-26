/**
 * Write-side column typing the store core does not apply yet: what Postgres does to a parameter when
 * it is assigned to a column with a type modifier. Shared by the salaries, deel and
 * financial-accounts ports (their tables use numeric(p,s), varchar(n) and real columns).
 *
 * - numeric(p,s): rounded half away from zero to scale s; more than p - s integer digits raise 22003.
 *   `pg` sends a JS number as `String(n)`, so a number is read from that text (not through float8).
 * - character varying(n): longer text raises 22001, unless the excess is all spaces (then cut).
 * - real: the float4 value, as `pg` reads it back (shortest text that round-trips in float4).
 * - integer / smallint: text that is not an integer raises 22P02; out of range raises 22003.
 *
 * Store-core gap: `coerceValue` (values.ts) ignores type modifiers; once it applies them these
 * helpers can go.
 */
import { tableInfo, type Row, type TableName } from '../../../catalog.js';
import { DbError } from '../../../errors.js';
import { Numeric } from '../../../numeric.js';

const NUMERIC_TYPMOD = /^numeric\((\d+),(\d+)\)$/;
const VARCHAR_TYPMOD = /^character varying\((\d+)\)$/;
const INT_RANGE: Record<string, [bigint, bigint]> = {
  integer: [-2147483648n, 2147483647n],
  smallint: [-32768n, 32767n],
};

/** The text `pg` sends for a parameter value. */
function paramText(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}

/** `x::real` as `pg` hands it back: the float4 value printed with the fewest round-tripping digits. */
export function float4(value: number): number {
  const f = Math.fround(value);
  if (!Number.isFinite(f)) throw new DbError('value out of range: overflow', '22003');
  if (f === 0) return f;
  for (let digits = 1; digits <= 9; digits++) {
    const candidate = Number(f.toPrecision(digits));
    if (Math.fround(candidate) === f) return candidate;
  }
  return f;
}

/** Assignment of one non-null value to a column of the given Postgres type. */
export function assignColumn(value: unknown, pgType: string): unknown {
  const numeric = NUMERIC_TYPMOD.exec(pgType);
  if (numeric) {
    const precision = Number(numeric[1]);
    const scale = Number(numeric[2]);
    let parsed: Numeric;
    try {
      parsed = value instanceof Numeric ? value : Numeric.parse(paramText(value));
    } catch {
      throw new DbError(`invalid input syntax for type numeric: "${paramText(value)}"`, '22P02');
    }
    const rounded = parsed.withScale(scale);
    const magnitude = rounded.unscaled < 0n ? -rounded.unscaled : rounded.unscaled;
    if (magnitude >= 10n ** BigInt(precision)) {
      throw new DbError('numeric field overflow', '22003', {
        detail: `A field with precision ${precision}, scale ${scale} must round to an absolute value less than 10^${precision - scale}.`,
      });
    }
    return rounded.toString();
  }
  if (pgType === 'numeric') {
    return value instanceof Numeric ? value.toString() : Numeric.parse(paramText(value)).toString();
  }
  const varchar = VARCHAR_TYPMOD.exec(pgType);
  if (varchar) {
    const limit = Number(varchar[1]);
    const chars = [...paramText(value)];
    if (chars.length <= limit) return paramText(value);
    if (chars.slice(limit).every(c => c === ' ')) return chars.slice(0, limit).join('');
    throw new DbError(`value too long for type character varying(${limit})`, '22001');
  }
  if (pgType === 'real') {
    return float4(typeof value === 'number' ? value : Number(paramText(value)));
  }
  const range = INT_RANGE[pgType];
  if (range) {
    const text = paramText(value).trim();
    if (!/^[+-]?\d+$/.test(text)) {
      throw new DbError(`invalid input syntax for type ${pgType}: "${paramText(value)}"`, '22P02');
    }
    const n = BigInt(text);
    if (n < range[0] || n > range[1]) {
      throw new DbError(`value "${text}" is out of range for type ${pgType}`, '22003');
    }
    return Number(n);
  }
  return value;
}

/**
 * The values of an INSERT / UPDATE ... SET, typed for their columns as Postgres assigns them. Keys
 * that are not columns pass through (the store raises 42703 for them).
 */
export function typed<T extends TableName>(
  table: T,
  values: Record<string, unknown>,
): Partial<Row<T>> {
  const info = tableInfo(table);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const column = info.columnByName.get(key);
    result[key] =
      column && value !== null && value !== undefined && !column.array
        ? assignColumn(value, column.pgType)
        : value;
  }
  return result as Partial<Row<T>>;
}

/** A timestamptz parameter (`Date` or text) as the instant Postgres reads it (session time zone UTC). */
export function timestampParam(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DbError(
      `invalid input syntax for type timestamp with time zone: "${String(value)}"`,
      '22007',
    );
  }
  return date;
}

/**
 * Rows a DELETE may remove: the tables of these modules carry a restrictive delete policy
 * (`owner_id = current_business_id`), so rows of other tenants in the read scope are skipped.
 */
export function deletable<R extends { owner_id: string }>(
  rows: readonly R[],
  businessId: string | null,
): R[] {
  return rows.filter(row => businessId !== null && row.owner_id === businessId);
}
