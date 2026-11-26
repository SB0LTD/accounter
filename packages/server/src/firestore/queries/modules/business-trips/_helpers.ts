/**
 * Helpers shared by the business-trips ports.
 */
import { tableInfo, type Row, type TableName } from '../../../catalog.js';
import { DbError } from '../../../errors.js';
import type { QueryDb } from '../../../query-db.js';
import { Numeric } from '../../../sql-helpers.js';
import type { ExtendedBusinessTripTransactionRow } from '../../../views/extended-business-trip-transactions.js';

export type { ExtendedBusinessTripTransactionRow };

/** `t.*` of a LEFT JOINed table: every column, NULL when there is no row. */
export function leftJoined<T extends TableName>(
  table: T,
  row: Row<T> | null | undefined,
  except: readonly string[] = [],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const column of tableInfo(table).columns) {
    if (except.includes(column.name)) continue;
    result[column.name] = row ? (row as unknown as Record<string, unknown>)[column.name] : null;
  }
  return result;
}

/** The view's rows, typed (`db.views` declares them as plain records). */
export async function extendedExpenses(
  db: QueryDb,
): Promise<readonly ExtendedBusinessTripTransactionRow[]> {
  return (await db.views.extendedBusinessTripTransactions()) as readonly ExtendedBusinessTripTransactionRow[];
}

/** The view's columns other than `id`, from a row or NULL (`LEFT JOIN extended_... t USING (id)`). */
export function extendedColumns(t: ExtendedBusinessTripTransactionRow | null | undefined) {
  return {
    business_trip_id: t?.business_trip_id ?? null,
    transaction_ids: t?.transaction_ids ?? null,
    charge_ids: t?.charge_ids ?? null,
    category: t?.category ?? null,
    date: t?.date ?? null,
    value_date: t?.value_date ?? null,
    amount: t?.amount ?? null,
    currency: t?.currency ?? null,
    employee_business_id: t?.employee_business_id ?? null,
    payed_by_employee: t?.payed_by_employee ?? null,
  };
}

/**
 * `SELECT * FROM <extension table> a LEFT JOIN extended_business_trip_transactions t USING (id)`:
 * the extension row's columns, then the view's (all NULL when the view has no row for the id).
 */
export async function withExtended<T extends { id: string }>(
  db: QueryDb,
  rows: readonly T[],
): Promise<(T & ReturnType<typeof extendedColumns>)[]> {
  if (rows.length === 0) return [];
  const byId = new Map((await extendedExpenses(db)).map(t => [t.id, t]));
  return rows.map(a => ({ ...a, ...extendedColumns(byId.get(a.id)) }));
}

/** `$flag = 0` for an integer parameter: NULL (not false) when the parameter is NULL. */
export function equalsZero(flag: number | null | undefined | void): boolean | null {
  return flag == null ? null : Number(flag) === 0;
}

/** SQL `OR` in three-valued logic, true only when the WHERE clause keeps the row. */
export function orTrue(...terms: (boolean | null)[]): boolean {
  return terms.some(term => term === true);
}

/**
 * A numeric parameter as Postgres receives it: `pg` sends a JS number as `String(n)`, which
 * Postgres parses exactly (no 15-digit float8 rounding).
 */
export function numericParam(value: number | string | null | undefined | void): string | null {
  if (value == null) return null;
  return typeof value === 'number' ? String(value) : value;
}

/**
 * A value stored into a `numeric(precision, scale)` column: rounded half away from zero to the
 * scale, and `numeric field overflow` (22003) when it needs more integer digits than the type
 * allows. (The store keeps numeric values as written and does not apply the column's typmod.)
 */
export function numericTypmod(
  value: number | string | null | undefined | void,
  precision: number,
  scale: number,
): string | null {
  const text = numericParam(value);
  if (text == null) return null;
  const rounded = Numeric.of(text).withScale(scale);
  const magnitude = rounded.unscaled < 0n ? -rounded.unscaled : rounded.unscaled;
  if (magnitude >= 10n ** BigInt(precision)) {
    throw new DbError('numeric field overflow', '22003', {
      detail: `A field with precision ${precision}, scale ${scale} must round to an absolute value less than 10^${precision - scale}.`,
    });
  }
  return rounded.toString();
}
