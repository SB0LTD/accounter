/**
 * Shared by the scraper-ingestion ports: the module's statements are wide multi-row INSERTs
 * (`VALUES $$rows(...) ON CONFLICT ... RETURNING ...`) and `col = ANY($list)` lookups.
 *
 * Two things Postgres does on the way into a column that the store's own value coercion does not,
 * applied here before a row reaches `db.insert`:
 *
 * - pg sends a JS number param as `String(n)`, so `numeric` gets every digit of it (the store's
 *   generic coercion casts it like float8 → numeric, to 15 significant digits);
 * - json/jsonb params must be JSON text (or an object pg stringifies); anything else is 22P02;
 * - the assignment cast to a column's type modifier: `numeric(p,s)` rounds to scale s (22003 when
 *   it no longer fits p), `varchar(n)` rejects longer text (22001; trailing spaces are cut), and
 *   `bit(n)` rejects another length (22026).
 */
import { tableInfo, type AnyRow, type TableInfo, type TableName } from '../../../catalog.js';
import { DbError } from '../../../errors.js';
import { Numeric } from '../../../numeric.js';
import type { QueryDb } from '../../../query-db.js';
import type { ColumnKind } from '../../../schema/catalog-types.js';
import { inList, notDistinct, toDateString } from '../../../sql-helpers.js';
import { DOC_ID, type StoredRow } from '../../../values.js';

// ---------------------------------------------------------------------------------------------
// Values on their way into a column
// ---------------------------------------------------------------------------------------------

const NUMERIC_TYPMOD = /^numeric\((\d+)(?:,\s*(\d+))?\)$/;
const VARCHAR_TYPMOD = /^character varying\((\d+)\)$/;
const BIT_TYPMOD = /^bit\((\d+)\)$/;

/** A JS number as pg puts it on the wire (`String(n)`), so `numeric` keeps every digit. */
function wireNumeric(value: unknown): unknown {
  return typeof value === 'number' || typeof value === 'bigint' ? String(value) : value;
}

/** The value an INSERT stores in `column`, after pg's serialisation and Postgres's assignment cast. */
export function assignmentCast(info: TableInfo, column: string, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  const meta = info.columnByName.get(column);
  if (!meta || meta.array) return value;
  if (meta.kind === 'json') return jsonParam(value);
  if (meta.kind === 'decimal') {
    const text = wireNumeric(value);
    const typmod = NUMERIC_TYPMOD.exec(meta.pgType);
    if (!typmod) return text;
    const precision = Number(typmod[1]);
    const scale = Number(typmod[2] ?? 0);
    const rounded = Numeric.of(text as string).round(scale);
    const integerDigits = (rounded.abs().unscaled / 10n ** BigInt(scale)).toString();
    if (integerDigits !== '0' && integerDigits.length > precision - scale) {
      throw new DbError('numeric field overflow', '22003', {
        detail: `A field with precision ${precision}, scale ${scale} must round to an absolute value less than 10^${precision - scale}.`,
      });
    }
    return rounded.toString();
  }
  const varchar = VARCHAR_TYPMOD.exec(meta.pgType);
  if (varchar) {
    const limit = Number(varchar[1]);
    const chars = [...String(value)];
    if (chars.length <= limit) return String(value);
    if (chars.slice(limit).every(ch => ch === ' ')) return chars.slice(0, limit).join('');
    throw new DbError(`value too long for type character varying(${limit})`, '22001');
  }
  const bit = BIT_TYPMOD.exec(meta.pgType);
  if (bit) {
    const text = String(value);
    const bad = [...text].find(ch => ch !== '0' && ch !== '1');
    if (bad !== undefined) throw new DbError(`"${bad}" is not a valid binary digit`, '22P02');
    if (text.length !== Number(bit[1])) {
      throw new DbError(
        `bit string length ${text.length} does not match type bit(${bit[1]})`,
        '22026',
      );
    }
    return text;
  }
  return value;
}

const invalidJson = () => new DbError('invalid input syntax for type json', '22P02');

/**
 * A param bound to a json/jsonb column: pg sends text as is (it must be JSON), a plain object as
 * `JSON.stringify`, and a JS array as a Postgres array literal, which is JSON only when empty (`{}`).
 */
function jsonParam(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw invalidJson();
    }
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return {};
    throw invalidJson();
  }
  if (value instanceof Date) throw invalidJson();
  return value;
}

/** A `$param` compared with a column of this kind, as Postgres casts it to the column's type. */
export function castParam(value: unknown, kind: ColumnKind): unknown {
  if (value === undefined || value === null) return null;
  switch (kind) {
    case 'int':
    case 'float':
      return typeof value === 'number' ? value : Number(value);
    case 'int8':
    case 'decimal':
      return String(value);
    case 'date':
      return toDateString(value);
    case 'timestamp':
      return value instanceof Date ? value : new Date(String(value));
    case 'bool':
      return typeof value === 'boolean' ? value : value === 'true' || value === 't';
    case 'string':
      return String(value);
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------------------------
// SELECT ... WHERE a = ANY($a) AND b = ANY($b) ...
// ---------------------------------------------------------------------------------------------

/** `SELECT <columns> FROM <table> WHERE c1 = ANY($v1) AND c2 = ANY($v2) ...` */
export async function selectWhereAny(
  db: QueryDb,
  table: TableName,
  columns: readonly string[],
  conditions: readonly [column: string, values: readonly unknown[] | null | undefined][],
): Promise<AnyRow[]> {
  const info = tableInfo(table);
  const kindOf = (column: string) => info.columnByName.get(column)!.kind;
  const [[firstColumn, firstValues], ...rest] = conditions as [
    [string, readonly unknown[] | null | undefined],
    ...[string, readonly unknown[] | null | undefined][],
  ];
  const firstKind = kindOf(firstColumn);
  const keys = (firstValues ?? []).map(v => castParam(v, firstKind)).filter(v => v !== null);
  let rows = (await db.whereIn(table, firstColumn as never, keys)) as unknown as readonly AnyRow[];
  for (const [column, values] of rest) {
    const kind = kindOf(column);
    const test = inList(
      (values ?? []).map(v => castParam(v, kind)),
      kind,
    );
    rows = rows.filter(row => test(row[column]));
  }
  return rows.map(row => pick(row, columns));
}

export function pick(row: AnyRow, columns: readonly string[]): AnyRow {
  const out: AnyRow = {};
  for (const column of columns) out[column] = row[column] ?? null;
  return out;
}

// ---------------------------------------------------------------------------------------------
// INSERT INTO <table> (<columns>) VALUES $$rows(<params>) [ON CONFLICT ...] RETURNING ...
// ---------------------------------------------------------------------------------------------

/** `ON CONFLICT <target> DO UPDATE SET c = EXCLUDED.c, ... [, extra] WHERE (t.w...) IS DISTINCT FROM (EXCLUDED.w...)` */
export interface UpsertSpec {
  target: string[] | { constraint: string };
  set: readonly string[];
  /** Further SET items that are not `EXCLUDED.c` (`updated_at = now()`). */
  extra?: (db: QueryDb) => AnyRow;
  /** The row compared in the WHERE; null for no WHERE. */
  whereDistinct: readonly string[] | null;
}

export interface InsertSpec {
  table: TableName;
  /** Column → the key of the `$$rows(...)` element that fills it, in the statement's order. */
  values: Readonly<Record<string, string>>;
  rows: readonly object[];
  /** `ON CONFLICT [target] DO NOTHING`, or DO UPDATE. */
  onConflict?: { target?: string[] | { constraint: string }; action: 'nothing' } | UpsertSpec;
  returning: readonly string[];
  /** Adds `(xmax = 0) AS inserted`: true for a new row, false for one the upsert updated. */
  xmaxInserted?: boolean;
}

/** Thrown out of the conflict action when the upsert's WHERE is false: the row is left alone. */
const SKIP = Symbol('on conflict where false');

/**
 * A multi-row INSERT: one row per element, in order. Each row's AFTER INSERT trigger runs as it is
 * inserted (the store's hook), which matches Postgres for these tables: a trigger only ever sees
 * rows the statement inserted before its own. Rows that ON CONFLICT skips are left out of
 * RETURNING, as Postgres does.
 */
export async function insertValues(db: QueryDb, spec: InsertSpec): Promise<AnyRow[]> {
  const info = tableInfo(spec.table);
  const entries = Object.entries(spec.values);
  const affected = new Set<string>();
  const out: AnyRow[] = [];
  const upsert = spec.onConflict && 'set' in spec.onConflict ? spec.onConflict : null;
  for (const element of spec.rows) {
    const params = element as AnyRow;
    const values: AnyRow = {};
    for (const [column, param] of entries) {
      values[column] = assignmentCast(info, column, params[param]);
    }
    let updated = false;
    let onConflict: Parameters<QueryDb['insert']>[2];
    if (upsert) {
      onConflict = {
        target: upsert.target,
        action: (existing: StoredRow, excluded: StoredRow) => {
          if (affected.has(docKey(existing))) {
            throw new DbError(
              'ON CONFLICT DO UPDATE command cannot affect row a second time',
              '21000',
            );
          }
          if (
            upsert.whereDistinct &&
            !isDistinctRow(info, existing, excluded, upsert.whereDistinct)
          ) {
            throw SKIP;
          }
          updated = true;
          const patch: AnyRow = {};
          for (const column of upsert.set) patch[column] = excluded[column];
          return { ...patch, ...upsert.extra?.(db) };
        },
      };
    } else if (spec.onConflict) {
      onConflict = { target: spec.onConflict.target, action: 'nothing' };
    }
    let row: AnyRow | null;
    try {
      row = (await db.insert(spec.table, values as never, onConflict)) as AnyRow | null;
    } catch (error) {
      if (error === SKIP) continue;
      throw error;
    }
    if (!row) continue;
    affected.add(docKey(row as StoredRow));
    const result = pick(row, spec.returning);
    if (spec.xmaxInserted) result.inserted = !updated;
    out.push(result);
  }
  return out;
}

const docKey = (row: StoredRow): string => row[DOC_ID] ?? String(row.id);

/** `(a.c1, a.c2, ...) IS DISTINCT FROM (b.c1, b.c2, ...)` */
function isDistinctRow(info: TableInfo, a: AnyRow, b: AnyRow, columns: readonly string[]): boolean {
  return columns.some(
    column => !notDistinct(a[column], b[column], info.columnByName.get(column)!.kind),
  );
}
