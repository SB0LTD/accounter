/**
 * How Postgres reads the parameters `pg` sends, for the ports of the reports, report-1214,
 * annual-audit and corporate-taxes modules. `pg` sends every non-null parameter as text (a number
 * as `String(n)`), and Postgres parses that text as the parameter's type when the statement is
 * bound, then applies the column's type modifier when the row is formed. The store's own value
 * coercion is looser (no typmods, float8-style number casts), so these run first.
 */
import { DbError } from '../../../errors.js';
import { Numeric } from '../../../numeric.js';

const INT_RANGES = {
  smallint: [-32768, 32767],
  integer: [-2147483648, 2147483647],
} as const;

/** An integer parameter (`smallint`, `integer`): 22P02 for non-integer text, 22003 out of range. */
export function intParam(value: unknown, type: keyof typeof INT_RANGES): number | null {
  if (value == null) return null;
  const text = String(value);
  if (!/^\s*[+-]?\d+\s*$/.test(text)) {
    throw new DbError(`invalid input syntax for type ${type}: "${text}"`, '22P02');
  }
  const n = Number(text);
  const [min, max] = INT_RANGES[type];
  if (n < min || n > max) {
    throw new DbError(`value "${text}" is out of range for type ${type}`, '22003');
  }
  return n;
}

/** A numeric parameter: a JS number is read from its `String(n)` digits, exactly. */
export function numericParam(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  try {
    Numeric.parse(text);
  } catch {
    throw new DbError(`invalid input syntax for type numeric: "${text}"`, '22P02');
  }
  return text;
}

/**
 * `numeric(precision, scale)` typmod: round half away from zero to `scale` digits, 22003 when the
 * integer part needs more than `precision - scale` digits.
 */
export function numericTypmod(value: unknown, precision: number, scale: number): string | null {
  const text = numericParam(value);
  if (text == null) return null;
  const rounded = Numeric.of(text).round(scale);
  if (!rounded.abs().lt(Numeric.of(10n ** BigInt(precision - scale)))) {
    throw new DbError('numeric field overflow', '22003');
  }
  return rounded.toString();
}

/**
 * `character varying(n)` on assignment: longer text is an error (22001), unless everything past
 * `n` characters is spaces, which Postgres drops.
 */
export function varcharParam(value: unknown, length: number): string | null {
  if (value == null) return null;
  const chars = [...String(value)];
  if (chars.length <= length) return String(value);
  if (chars.slice(length).every(c => c === ' ')) return chars.slice(0, length).join('');
  throw new DbError(`value too long for type character varying(${length})`, '22001');
}
