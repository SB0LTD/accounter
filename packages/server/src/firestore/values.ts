/**
 * Values: Firestore ↔ row conversion, document ids, defaults, and the comparison rules queries
 * need to behave like Postgres.
 */
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4, v7 as uuidv7 } from 'uuid';
import type { AnyRow, TableInfo } from './catalog.js';
import { Numeric } from './numeric.js';
import type { ColumnKind, ColumnMeta } from './schema/catalog-types.js';

/** The document id of a row, kept off the row's enumerable fields. */
export const DOC_ID = Symbol('docId');
/** The Firestore update time a row was last seen at; commits use it as a precondition. */
export const UPDATE_TIME = Symbol('updateTime');

export type StoredRow = AnyRow & { [DOC_ID]?: string; [UPDATE_TIME]?: Timestamp };

// ---------------------------------------------------------------------------------------------
// Document ids
// ---------------------------------------------------------------------------------------------

/** Firestore ids may not contain `/`; `%` is escaped first so the encoding is reversible. */
function escapeIdPart(part: string): string {
  return part.replaceAll('%', '%25').replaceAll('/', '%2F').replaceAll('~', '%7E');
}

function keyText(value: unknown, column: ColumnMeta): string {
  if (value == null) throw new Error(`null value in primary key column "${column.name}"`);
  if (value instanceof Date) return value.toISOString();
  if (column.kind === 'decimal') return Numeric.of(value as string).key();
  return String(value);
}

/** The document id for a row: its primary key, or a fresh id for tables without one. */
export function docIdFor(table: TableInfo, row: AnyRow): string {
  if (!table.primaryKey) {
    const existing = (row as StoredRow)[DOC_ID];
    return existing ?? uuidv7();
  }
  const id = table.primaryKey
    .map(name => escapeIdPart(keyText(row[name], table.columnByName.get(name)!)))
    .join('~');
  if (id === '.' || id === '..' || /^__.*__$/.test(id)) return `%${id}`;
  return id;
}

// ---------------------------------------------------------------------------------------------
// Firestore encoding
// ---------------------------------------------------------------------------------------------

function encodeScalar(value: unknown, kind: ColumnKind): unknown {
  if (value == null) return null;
  switch (kind) {
    case 'timestamp':
      return Timestamp.fromDate(value instanceof Date ? value : new Date(value as string));
    case 'json':
      return JSON.stringify(value);
    case 'int':
    case 'float':
      return typeof value === 'number' ? value : Number(value);
    case 'bool':
      return Boolean(value);
    default:
      return typeof value === 'string' ? value : String(value);
  }
}

function decodeScalar(value: unknown, kind: ColumnKind): unknown {
  if (value == null) return null;
  switch (kind) {
    case 'timestamp':
      return value instanceof Timestamp ? value.toDate() : new Date(value as string);
    case 'json':
      return typeof value === 'string' ? JSON.parse(value) : value;
    default:
      return value;
  }
}

/** Row → Firestore document data. */
export function encodeRow(table: TableInfo, row: AnyRow): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const column of table.columns) {
    const value = row[column.name];
    data[column.name] =
      column.array && Array.isArray(value)
        ? value.map(element => encodeScalar(element, column.kind))
        : encodeScalar(value, column.kind);
  }
  return data;
}

/** Firestore document data → row, frozen: rows in the replica are shared and must not change. */
export function decodeRow(
  table: TableInfo,
  docId: string,
  data: Record<string, unknown>,
  updateTime?: Timestamp,
): StoredRow {
  const row: StoredRow = {};
  for (const column of table.columns) {
    const value = data[column.name];
    row[column.name] =
      column.array && Array.isArray(value)
        ? value.map(element => decodeScalar(element, column.kind))
        : decodeScalar(value ?? null, column.kind);
  }
  return sealRow(row, docId, updateTime);
}

export function sealRow(row: StoredRow, docId: string, updateTime?: Timestamp): StoredRow {
  Object.defineProperty(row, DOC_ID, { value: docId, enumerable: false });
  if (updateTime) Object.defineProperty(row, UPDATE_TIME, { value: updateTime, enumerable: false });
  return Object.freeze(row);
}

// ---------------------------------------------------------------------------------------------
// Normalising values written by queries
// ---------------------------------------------------------------------------------------------

function coerceScalar(value: unknown, column: ColumnMeta, table: string): unknown {
  if (value === undefined || value === null) return null;
  switch (column.kind) {
    case 'decimal':
      if (value instanceof Numeric) return value.toString();
      return Numeric.of(value as string | number).toString();
    case 'int8':
      return typeof value === 'bigint' ? value.toString() : String(value);
    case 'int': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(n)) {
        throw new Error(
          `invalid input syntax for type integer: "${String(value)}" (${table}.${column.name})`,
        );
      }
      return n;
    }
    case 'float':
      return typeof value === 'number' ? value : Number(value);
    case 'bool':
      return typeof value === 'boolean' ? value : value === 'true' || value === 't';
    case 'date':
      return toDateString(value);
    case 'timestamp':
      return value instanceof Date ? new Date(value.getTime()) : new Date(value as string);
    case 'json':
      return typeof value === 'string' &&
        column.pgType.startsWith('json') &&
        looksLikeJsonText(value)
        ? JSON.parse(value)
        : structuredClone(value);
    default:
      return typeof value === 'string' ? value : String(value);
  }
}

/** pgTyped sends json params as text; a JSON object or array literal is parsed, other text kept. */
function looksLikeJsonText(text: string): boolean {
  const first = text.trimStart()[0];
  return first === '{' || first === '[';
}

/** Coerce a value written to a column to the column's row representation. */
export function coerceValue(value: unknown, column: ColumnMeta, table: string): unknown {
  if (column.array) {
    if (value == null) return null;
    if (!Array.isArray(value))
      throw new Error(`malformed array literal for ${table}.${column.name}`);
    return value.map(element => coerceScalar(element, column, table));
  }
  return coerceScalar(value, column, table);
}

/** `YYYY-MM-DD` for a date column, from a string, Date or timestamp. */
export function toDateString(value: unknown): string {
  if (value instanceof Date) {
    // pg sends a JS Date param in local time, and Postgres takes its date part.
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = String(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (!match) throw new Error(`invalid input syntax for type date: "${text}"`);
  return match[1]!;
}

// ---------------------------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------------------------

export interface Clock {
  /** Transaction start time: `now()` and `CURRENT_TIMESTAMP`. */
  transactionTime: Date;
}

export function defaultValue(column: ColumnMeta, clock: Clock): unknown {
  const spec = column.default;
  if (!spec) return null;
  switch (spec.kind) {
    case 'uuidv7':
      return uuidv7();
    case 'uuid4':
      return uuidv4();
    case 'now':
      return new Date(clock.transactionTime.getTime());
    case 'clock':
      return new Date();
    case 'today':
      return toDateString(clock.transactionTime);
    case 'literal':
      return coerceValue(structuredClone(spec.value), column, '');
  }
}

// ---------------------------------------------------------------------------------------------
// Equality and ordering
// ---------------------------------------------------------------------------------------------

/** A key for SQL equality of one value (`=`), or null when the value is NULL. */
export function equalityKey(value: unknown, kind?: ColumnKind): string | null {
  if (value == null) return null;
  if (kind === 'decimal' || value instanceof Numeric)
    return `n:${Numeric.of(value as string).key()}`;
  if (value instanceof Date) return `t:${value.getTime()}`;
  if (typeof value === 'object') return `j:${JSON.stringify(value)}`;
  return `${typeof value}:${String(value)}`;
}

const collator = new Intl.Collator('en-US', { sensitivity: 'variant', numeric: false });

/** Text ordering for ORDER BY. One place, so the collation can be matched to production later. */
export function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Postgres ordering of two non-null values of the same type. */
export function compareValues(a: unknown, b: unknown, kind?: ColumnKind): number {
  if (kind === 'decimal' || a instanceof Numeric || b instanceof Numeric) {
    return Numeric.of(a as string).cmp(b as string);
  }
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : a > b ? 1 : 0;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (kind === 'int8') return Numeric.of(a as string).cmp(b as string);
  if (typeof a === 'string' && typeof b === 'string') {
    // Dates, times, uuids and enum labels compare as written; free text by collation.
    if (kind === 'date' || kind === 'time') return a < b ? -1 : a > b ? 1 : 0;
    return compareText(a, b);
  }
  return compareText(String(a), String(b));
}

export interface OrderTerm<T> {
  value: (row: T) => unknown;
  desc?: boolean;
  /** Postgres default: NULLS LAST for ASC, NULLS FIRST for DESC. */
  nulls?: 'first' | 'last';
  kind?: ColumnKind;
}

/** ORDER BY with Postgres's null placement. Stable, like a sort over an already-ordered input. */
export function orderBy<T>(rows: readonly T[], terms: OrderTerm<T>[]): T[] {
  return [...rows].sort((x, y) => {
    for (const term of terms) {
      const a = term.value(x);
      const b = term.value(y);
      const nullsFirst = term.nulls ? term.nulls === 'first' : Boolean(term.desc);
      if (a == null || b == null) {
        if (a == null && b == null) continue;
        return (a == null ? -1 : 1) * (nullsFirst ? 1 : -1);
      }
      const c = compareValues(a, b, term.kind);
      if (c !== 0) return term.desc ? -c : c;
    }
    return 0;
  });
}
