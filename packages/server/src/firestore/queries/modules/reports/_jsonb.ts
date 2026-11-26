/**
 * jsonb semantics for the ports of the reports, report-1214 and annual-audit modules: how a pgTyped
 * parameter becomes a jsonb value, jsonb equality, `->>`, `-`, and `||`.
 *
 * Values are the parsed JSON (what `pg` hands back for a jsonb column). A JSON `null` inside a
 * value is JS `null`; a top-level JSON `null` cannot be told apart from SQL NULL once stored (a
 * store-core limitation, see the module report).
 */
import { DbError } from '../../../errors.js';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const invalidJson = (text: string) =>
  new DbError(`invalid input syntax for type json: "${text.slice(0, 100)}"`, '22P02');

/**
 * `$param::jsonb` as Postgres sees what `pg` sends: text is parsed as JSON, an object is sent as
 * its JSON.stringify, a number or boolean as its text, and an array as a Postgres array literal
 * (`{...}`), which only parses as JSON when empty (`{}`). Returns `undefined` for SQL NULL.
 */
export function jsonbParam(value: unknown): Json | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Json;
    } catch {
      throw invalidJson(value);
    }
  }
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return JSON.parse(String(value)) as Json;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return {};
    throw invalidJson('{...}');
  }
  if (value instanceof Date) throw invalidJson(value.toISOString());
  return JSON.parse(JSON.stringify(value)) as Json;
}

/** jsonb `=`: same type and value; objects by key set, arrays in order. */
export function jsonbEquals(a: Json, b: Json): boolean {
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => jsonbEquals(item, b[i]!));
  }
  if (typeof a === 'object' || typeof b === 'object') {
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && jsonbEquals(a[k]!, b[k]!));
  }
  return typeof a === typeof b && a === b;
}

const isObject = (value: unknown): value is { [key: string]: Json } =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** `value ->> 'key'`: the member as text; NULL for a missing key, a JSON null, or a non-object. */
export function jsonbGetText(value: Json | null | undefined, key: string): string | null {
  if (!isObject(value) || !Object.prototype.hasOwnProperty.call(value, key)) return null;
  const member = value[key]!;
  if (member === null) return null;
  if (typeof member === 'string') return member;
  if (typeof member === 'number' || typeof member === 'boolean') return String(member);
  return JSON.stringify(member);
}

/** `jsonb - text[]`: drops those keys of an object (string elements of an array). NULL in, NULL out. */
export function jsonbDeleteKeys(
  value: Json | null | undefined,
  keys: readonly (string | null)[] | null | undefined | void,
): Json | undefined {
  if (value === undefined || keys == null) return undefined;
  const drop = new Set(keys.filter((k): k is string => k != null));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !drop.has(k)));
  }
  if (Array.isArray(value)) return value.filter(v => !(typeof v === 'string' && drop.has(v)));
  throw new DbError('cannot delete from scalar', '22023');
}

/** `jsonb || jsonb`: object merge (right wins), else array concatenation. NULL in, NULL out. */
export function jsonbConcat(
  left: Json | null | undefined,
  right: Json | null | undefined,
): Json | undefined {
  if (left === undefined || right === undefined) return undefined;
  if (isObject(left) && isObject(right)) return { ...left, ...right };
  const asArray = (v: Json): Json[] => (Array.isArray(v) ? v : [v]);
  return [...asArray(left), ...asArray(right)];
}
