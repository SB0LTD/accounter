/**
 * Postgres semantics the depreciation ports need that the store core does not provide (yet).
 */
import { DbError } from '../../../errors.js';
import { Numeric } from '../../../sql-helpers.js';

/** A pgTyped parameter (`T | null | void`) as `T | null`, for `COALESCE($param, column)`. */
export const given = <T>(value: T | null | undefined | void): T | null =>
  value == null ? null : (value as T);

/**
 * A number bound to a numeric column: pg sends `String(n)`, which Postgres reads exactly (the
 * store's own number conversion rounds to 15 significant digits, as a float8 cast would).
 */
export const numericParam = (value: number | string | null | undefined | void): string | null =>
  value == null ? null : String(value);

/**
 * A value assigned to a `numeric(precision, scale)` column: rounded half away from zero to the
 * scale and printed with it (`10` → `10.00`), 22003 when it does not fit. The store core keeps
 * numerics as written, so typmod columns need this before a write.
 */
export function numericTypmod(
  value: number | string | null | undefined | void,
  precision: number,
  scale: number,
): string | null {
  const text = numericParam(value);
  if (text == null) return null;
  const rounded = Numeric.of(text).round(scale);
  if (!rounded.abs().lt(Numeric.of(10n ** BigInt(precision - scale)))) {
    throw new DbError('numeric field overflow', '22003', {
      detail: `A field with precision ${precision}, scale ${scale} must round to an absolute value less than 10^${precision - scale}.`,
    });
  }
  return rounded.toString();
}
