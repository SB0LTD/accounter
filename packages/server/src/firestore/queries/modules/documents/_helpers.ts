/**
 * Postgres behaviour the documents / misc-expenses / contracts / common / accountant-approval ports
 * need and the store core does not provide (yet). Each helper names the gap it covers.
 */
import { enums } from '../../../catalog.js';
import { DbError } from '../../../errors.js';
import type { QueryDb } from '../../../query-db.js';
import { toDateString } from '../../../sql-helpers.js';

/**
 * A parameter bound to an enum column: Postgres rejects an unknown label with 22P02 when it binds
 * the parameter. (The store keeps enums as plain strings and accepts any text.)
 */
export function enumParam<T extends string>(
  enumType: string,
  value: T | null | undefined | void,
): T | null {
  if (value == null) return null;
  const labels = enums[enumType];
  if (!labels) throw new Error(`type "accounter_schema.${enumType}" is not an enum`);
  if (!labels.includes(value)) {
    throw new DbError(
      `invalid input value for enum accounter_schema.${enumType}: "${String(value)}"`,
      '22P02',
    );
  }
  return value;
}

/**
 * A value assigned to a `character varying(n)` column: longer text raises 22001, unless only spaces
 * are cut off (Postgres truncates those). (The store does not check varchar lengths.)
 */
export function varcharValue(value: string | null | undefined | void, n: number): string | null {
  if (value == null) return null;
  const chars = [...value];
  if (chars.length <= n) return value;
  if (chars.slice(n).every(ch => ch === ' ')) return chars.slice(0, n).join('');
  throw new DbError(`value too long for type character varying(${n})`, '22001');
}

/**
 * Rows a DELETE may remove from a table with a restrictive `tenant_isolation_delete` policy
 * (`owner_id = current_business_id`): rows of other businesses in the read scope are skipped
 * silently, as Postgres's USING clause does. (The store's delete does not apply that policy.)
 */
export function deletableRows<R extends { owner_id: string }>(
  db: QueryDb,
  rows: readonly R[],
): R[] {
  return rows.filter(row => row.owner_id === db.ctx.businessId);
}

/** `$flag = 0` for the `($isX = 0 OR ...)` filter pattern: NULL is not 0. */
export function isZero(flag: number | string | null | undefined | void): boolean {
  return flag != null && Number(flag) === 0;
}

/** `$d::TEXT IS NULL OR value >= $d::DATE` (`from`) / `value <= $d::DATE` (`to`) on date strings. */
export function dateBound(param: string | null | undefined | void, direction: 'from' | 'to') {
  if (param == null) return () => true;
  const bound = toDateString(param);
  return (value: string | null) =>
    value != null && (direction === 'from' ? value >= bound : value <= bound);
}

/**
 * `double precision::text` as Postgres prints it (shortest round-trip digits, like JS, but in
 * exponent form below 1e-4 and from 1e15, with a two-digit exponent: `1e-05`, `1.5e+15`).
 */
export function float8Text(value: number | null | undefined): string | null {
  if (value == null) return null;
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return 'Infinity';
  if (value === -Infinity) return '-Infinity';
  if (value === 0) return Object.is(value, -0) ? '-0' : '0';
  const [mantissa, exponentText] = value.toExponential().split('e') as [string, string];
  const exponent = Number(exponentText);
  const sign = mantissa.startsWith('-') ? '-' : '';
  const digits = mantissa.replace('-', '').replace('.', '');
  if (exponent >= -4 && exponent < 15) {
    if (exponent < 0) return `${sign}0.${'0'.repeat(-exponent - 1)}${digits}`;
    if (digits.length <= exponent + 1)
      return `${sign}${digits}${'0'.repeat(exponent + 1 - digits.length)}`;
    return `${sign}${digits.slice(0, exponent + 1)}.${digits.slice(exponent + 1)}`;
  }
  const abs = Math.abs(exponent);
  const exp = `${exponent < 0 ? '-' : '+'}${abs < 10 ? `0${abs}` : String(abs)}`;
  const head = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
  return `${sign}${head}e${exp}`;
}
