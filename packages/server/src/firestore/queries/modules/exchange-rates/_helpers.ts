/**
 * Postgres semantics the exchange-rates ports need that the store core does not provide (yet).
 */
import type { AnyRow, Row, TableName } from '../../../catalog.js';
import { DbError } from '../../../errors.js';
import type { QueryDb } from '../../../query-db.js';
import { equalityKey } from '../../../sql-helpers.js';
import type { StoredRow } from '../../../values.js';

/**
 * `to_date($text, 'YYYY-MM-DD')`: leading blanks skipped, any one non-digit as separator, one- or
 * two-digit month and day, trailing text ignored. Out-of-range fields raise 22008, text that does
 * not start with a year 22007, as Postgres does. NULL stays NULL. An empty string is year 1 BC in
 * Postgres, earlier than any stored date: it is returned as `0000-01-01`, which sorts the same way.
 */
export function toDateYmd(text: string | null | undefined | void): string | null {
  if (text == null) return null;
  if (text === '') return '0000-01-01';
  const match = /^\s*(\d{4})[^\d](\d{1,2})[^\d](\d{1,2})/.exec(text);
  if (!match) {
    throw new DbError(`invalid value "${text.trim().slice(0, 4)}" for "YYYY"`, '22007');
  }
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (m < 1 || m > 12 || d < 1 || d > lastDay) {
    throw new DbError(`date/time field value out of range: "${text}"`, '22008');
  }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * A parameter bound to a `timestamp without time zone` column. pg sends a `Date` as local time and
 * the column keeps the wall-clock time, which `pg` reads back as that local time: the same instant.
 * A string's own time zone is ignored, as Postgres ignores it for this type, and its wall-clock time
 * is read as local time.
 */
export function timestampWithoutTimeZone(value: Date | string): Date {
  if (value instanceof Date) return new Date(value.getTime());
  const match =
    /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?/.exec(
      value,
    );
  if (!match) throw new DbError(`invalid input syntax for type timestamp: "${value}"`, '22007');
  const [, y, mo, d, h = '0', mi = '0', s = '0', frac = ''] = match;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
    Math.round(Number(`0.${frac || '0'}`) * 1000),
  );
}

/**
 * A number bound to a numeric column: pg sends `String(n)`, which Postgres reads exactly (the
 * store's own number conversion rounds to 15 significant digits, as a float8 cast would).
 */
export const numericParam = (value: number | string | null | undefined | void): string | null =>
  value == null ? null : String(value);

class Conflict {
  constructor(
    readonly existing: StoredRow,
    readonly excluded: StoredRow,
  ) {}
}

const targetKey = (row: AnyRow, target: string[]) =>
  target.map(column => equalityKey(row[column])).join('\u0000');

/**
 * One row of a multi-row `INSERT ... ON CONFLICT (target) DO UPDATE SET ... [WHERE ...]`.
 *
 * `set` gets the existing row and the proposed one (`EXCLUDED`) and returns the SET patch, or null
 * when the DO UPDATE's WHERE is not true (the row is left alone and not returned). Validation, RLS
 * and conflicts on other constraints behave as in `db.insert`. `affected` holds the target keys the
 * statement inserted or updated so far: Postgres refuses to touch such a row again (21000), even
 * when the WHERE would skip it.
 *
 * Returns the stored row and whether it was inserted (`xmax = 0`), or null when skipped.
 */
export async function upsertRow<T extends TableName>(
  db: QueryDb,
  table: T,
  values: Partial<Row<T>>,
  target: string[],
  set: (existing: Row<T>, excluded: Row<T>) => Partial<Row<T>> | null,
  affected: Set<string>,
): Promise<{ row: Row<T>; inserted: boolean } | null> {
  let row: Row<T> | null;
  try {
    row = await db.insert(table, values, {
      target,
      action: (existing, excluded) => {
        throw new Conflict(existing, excluded);
      },
    });
  } catch (error) {
    if (!(error instanceof Conflict)) throw error;
    const key = targetKey(error.existing, target);
    if (affected.has(key)) {
      throw new DbError('ON CONFLICT DO UPDATE command cannot affect row a second time', '21000');
    }
    const existing = error.existing as unknown as Row<T>;
    const patch = set(existing, error.excluded as unknown as Row<T>);
    if (!patch) return null;
    const updated = await db.update(table, existing, patch);
    affected.add(key);
    return { row: updated, inserted: false };
  }
  affected.add(targetKey(row as unknown as AnyRow, target));
  return { row: row!, inserted: true };
}
