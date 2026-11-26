/**
 * Values: Firestore ↔ row conversion, document ids, defaults, and the comparison rules queries
 * need to behave like Postgres.
 */
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4, v7 as uuidv7 } from 'uuid';
import { enums, type AnyRow, type TableInfo } from './catalog.js';
import { DbError } from './errors.js';
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

const UUID_INPUT =
  /^\{?([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})\}?$/i;

/** Postgres's uuid input: braces, upper case and missing hyphens accepted; stored canonical. */
function canonicalUuid(value: unknown): string {
  const text = String(value).trim();
  const match = UUID_INPUT.exec(text);
  if (!match) throw new DbError(`invalid input syntax for type uuid: "${text}"`, '22P02');
  return match.slice(1).join('-').toLowerCase();
}

/** A JS number as pg sends it (`String(n)`), so Postgres parses exactly those digits. */
function numericInput(value: unknown): Numeric {
  if (value instanceof Numeric) return value;
  if (typeof value === 'number') return Numeric.parse(String(value));
  if (typeof value === 'bigint') return Numeric.of(value);
  try {
    return Numeric.parse(String(value));
  } catch {
    throw new DbError(`invalid input syntax for type numeric: "${String(value)}"`, '22P02');
  }
}

/** `numeric(p,s)`: round to the scale, and refuse values wider than the precision. */
function applyNumericTypmod(value: Numeric, pgType: string): Numeric {
  const typmod = /^numeric\((\d+),\s*(\d+)\)/.exec(pgType);
  if (!typmod) return value;
  const precision = Number(typmod[1]);
  const scale = Number(typmod[2]);
  const rounded = value.withScale(scale);
  const integerDigits = rounded.abs().toString().split('.')[0]!.replace(/^0+/, '').length;
  if (integerDigits > precision - scale) {
    throw new DbError(
      `numeric field overflow: A field with precision ${precision}, scale ${scale} must round to an absolute value less than 10^${precision - scale}.`,
      '22003',
    );
  }
  return rounded;
}

/** `varchar(n)`: too long is an error, unless the excess is only spaces (then it is cut). */
function applyLengthTypmod(text: string, pgType: string): string {
  const typmod = /^character varying\((\d+)\)/.exec(pgType);
  if (!typmod) return text;
  const limit = Number(typmod[1]);
  const chars = [...text];
  if (chars.length <= limit) return text;
  if (chars.slice(limit).every(ch => ch === ' ')) return chars.slice(0, limit).join('');
  throw new DbError(`value too long for type character varying(${limit})`, '22001');
}

const INT_RANGE: Record<string, [number, number]> = {
  integer: [-2_147_483_648, 2_147_483_647],
  smallint: [-32_768, 32_767],
};

function coerceScalar(value: unknown, column: ColumnMeta, table: string): unknown {
  if (value === undefined || value === null) return null;
  const baseType = column.pgType.replace(/\[\]$/, '');
  switch (column.kind) {
    case 'decimal':
      return applyNumericTypmod(numericInput(value), baseType).toString();
    case 'int8':
      return typeof value === 'bigint' ? value.toString() : numericInput(value).toString();
    case 'int': {
      const n = typeof value === 'number' ? value : Number(String(value).trim());
      if (!Number.isInteger(n)) {
        throw new DbError(
          `invalid input syntax for type ${baseType}: "${String(value)}" (${table}.${column.name})`,
          '22P02',
        );
      }
      const range = INT_RANGE[baseType];
      if (range && (n < range[0] || n > range[1])) {
        throw new DbError(`${baseType} out of range`, '22003');
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
    default: {
      if (baseType === 'uuid') return canonicalUuid(value);
      const text = typeof value === 'string' ? value : String(value);
      const labels = enums[baseType];
      if (labels && !labels.includes(text)) {
        throw new DbError(`invalid input value for enum ${baseType}: "${text}"`, '22P02');
      }
      return applyLengthTypmod(text, baseType);
    }
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

/**
 * Text ordering for ORDER BY: code-point order, which is what Postgres does under the `C` / `C.UTF-8`
 * collation the verification databases use, so ports can be proven exactly. One place, so a
 * friendlier collation (and a matching ICU collation in the oracle) can replace it later.
 */
export function compareText(a: string, b: string): number {
  // UTF-8 byte order equals code-point order; JS compares UTF-16 code units, which differs only for
  // characters outside the BMP, so compare code points explicitly.
  if (a === b) return 0;
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const ca = ia.next();
    const cb = ib.next();
    if (ca.done || cb.done) return ca.done ? (cb.done ? 0 : -1) : 1;
    const d = ca.value.codePointAt(0)! - cb.value.codePointAt(0)!;
    if (d !== 0) return d;
  }
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
  /**
   * The column's enum type (e.g. `'currency'`, `'document_type'`): Postgres orders enum values by
   * their declaration order, not alphabetically.
   */
  enumType?: string;
}

/** Postgres ordering of two labels of an enum type: by declaration order. */
export function compareEnum(enumType: string, a: string, b: string): number {
  const labels = enums[enumType];
  if (!labels) throw new Error(`type "accounter_schema.${enumType}" is not an enum`);
  const ia = labels.indexOf(a);
  const ib = labels.indexOf(b);
  if (ia < 0 || ib < 0) {
    throw new Error(`invalid input value for enum ${enumType}: "${ia < 0 ? a : b}"`);
  }
  return ia - ib;
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
      const c = term.enumType
        ? compareEnum(term.enumType, String(a), String(b))
        : compareValues(a, b, term.kind);
      if (c !== 0) return term.desc ? -c : c;
    }
    return 0;
  });
}
