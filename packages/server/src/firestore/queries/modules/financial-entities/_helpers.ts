/**
 * Helpers shared by the financial-entities ports: the business row shape the providers select,
 * Postgres input checks the store does not make (uuid / enum / varchar(n) / smallint), jsonb text
 * output, `::uuid` casts, LIKE with a custom escape character, the restrictive DELETE policy, and
 * the execution order of statements with data-modifying CTEs.
 */
import { enums, tableInfo, type AnyRow, type Row, type TableName } from '../../../catalog.js';
import { DbError, rlsViolation } from '../../../errors.js';
import type { QueryDb } from '../../../query-db.js';
import type { ConflictOptions } from '../../../transaction.js';

// ---------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------

/**
 * `SELECT fe.*, b.vat_number, b.hebrew_name, b.address, b.address_hebrew, b.email, b.website,
 * b.phone_number, b.country, b.no_invoices_required, b.suggestion_data, b.can_settle_with_receipt,
 * b.exempt_dealer, b.optional_vat, b.pcn874_record_type_override, b.city, b.zip_code`
 */
export function businessRow(fe: Row<'financial_entities'>, b: Row<'businesses'>) {
  return {
    ...fe,
    vat_number: b.vat_number,
    hebrew_name: b.hebrew_name,
    address: b.address,
    address_hebrew: b.address_hebrew,
    email: b.email,
    website: b.website,
    phone_number: b.phone_number,
    country: b.country,
    no_invoices_required: b.no_invoices_required,
    suggestion_data: b.suggestion_data,
    can_settle_with_receipt: b.can_settle_with_receipt,
    exempt_dealer: b.exempt_dealer,
    optional_vat: b.optional_vat,
    pcn874_record_type_override: b.pcn874_record_type_override,
    city: b.city,
    zip_code: b.zip_code,
  };
}

/** `FROM businesses b INNER JOIN financial_entities fe USING (id)` over the given businesses. */
export async function joinBusinesses(db: QueryDb, businesses: readonly Row<'businesses'>[]) {
  const entities = await db.whereIn(
    'financial_entities',
    'id',
    businesses.map(b => b.id),
  );
  const byId = new Map(entities.map(fe => [fe.id, fe]));
  const result: ReturnType<typeof businessRow>[] = [];
  for (const b of businesses) {
    const fe = byId.get(b.id);
    if (fe) result.push(businessRow(fe, b));
  }
  return result;
}

/** A row with every column of a table set to NULL (the right side of an unmatched LEFT JOIN). */
export function nullRow<T extends TableName>(table: T): { [K in keyof Row<T>]: null } {
  return Object.fromEntries(tableInfo(table).columns.map(c => [c.name, null])) as never;
}

// ---------------------------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------------------------

/** `$param = n` for an integer parameter: NULL (never true) when the parameter is NULL. */
export function paramEquals(value: unknown, n: number): boolean {
  return value != null && Number(value) === n;
}

/** `lower(text)` */
export const lower = (text: string): string => text.toLowerCase();

// ---------------------------------------------------------------------------------------------
// Input checks Postgres makes when it converts a parameter to a column's type
// ---------------------------------------------------------------------------------------------

const invalidInput = (type: string, value: unknown) =>
  new DbError(`invalid input syntax for type ${type}: "${String(value)}"`, '22P02');

/**
 * `text::uuid` (uuid_in): optional braces, 32 hex digits, a hyphen allowed after any group of four.
 * Returns the canonical lower-case form; throws 22P02 like Postgres on anything else.
 */
export function castUuid(text: string): string {
  let i = 0;
  const braces = text[0] === '{';
  if (braces) i++;
  let hex = '';
  for (let byte = 0; byte < 16; byte++) {
    const pair = text.slice(i, i + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(pair)) throw invalidInput('uuid', text);
    hex += pair.toLowerCase();
    i += 2;
    if (text[i] === '-' && byte % 2 === 1 && byte < 15) i++;
  }
  if (braces) {
    if (text[i] !== '}') throw invalidInput('uuid', text);
    i++;
  }
  if (i !== text.length) throw invalidInput('uuid', text);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A uuid parameter (`WHERE id = $id`): parsed like Postgres binds it; NULL stays NULL. */
export function uuidParam(value: string | null | undefined | void): string | null {
  return value == null ? null : castUuid(String(value));
}

/** A uuid list parameter (`id IN $$ids`), each element parsed. */
export function uuidList(values: readonly (string | null | undefined | void)[]): (string | null)[] {
  return values.map(uuidParam);
}

/** Checks one value against an enum type, as the enum's input function does. */
export function checkEnum(enumType: string, value: unknown) {
  if (value == null) return;
  const labels = enums[enumType];
  if (labels && !labels.includes(String(value))) {
    throw new DbError(`invalid input value for enum ${enumType}: "${String(value)}"`, '22P02');
  }
}

const INT_RANGES: Record<string, [number, number, string]> = {
  smallint: [-32768, 32767, 'smallint'],
  integer: [-2147483648, 2147483647, 'integer'],
};

/**
 * Parameters bound to a table's columns, converted as Postgres converts them when it binds them
 * (before the statement runs, whether or not any row is touched): uuids parsed and lower-cased,
 * enum labels checked, smallint/integer ranges checked, varchar(n) lengths enforced. Only top-level
 * scalar columns are checked; other values pass through for the store to coerce.
 */
export function pgParams<T extends TableName>(table: T, values: Partial<Row<T>>): Partial<Row<T>> {
  const info = tableInfo(table);
  const result: AnyRow = { ...values };
  for (const [name, value] of Object.entries(values as AnyRow)) {
    const column = info.columnByName.get(name);
    if (!column || column.array || value == null) continue;
    const pgType = column.pgType;
    if (pgType === 'uuid') {
      result[name] = castUuid(String(value));
    } else if (enums[pgType]) {
      checkEnum(pgType, value);
    } else if (INT_RANGES[pgType]) {
      const [min, max, label] = INT_RANGES[pgType]!;
      const n = Number(value);
      if (Number.isInteger(n) && (n < min || n > max)) {
        throw new DbError(`${label} out of range`, '22003');
      }
    } else {
      // The assignment cast to varchar(n): Postgres folds it into the plan for a bound parameter,
      // so it raises even when no row is written. Excess spaces are cut, anything else raises.
      const varchar = /^character varying\((\d+)\)$/.exec(pgType);
      if (!varchar) continue;
      const max = Number(varchar[1]);
      const chars = [...String(value)];
      if (chars.length <= max) continue;
      if (!chars.slice(max).every(ch => ch === ' ')) {
        throw new DbError(`value too long for type character varying(${max})`, '22001');
      }
      result[name] = chars.slice(0, max).join('');
    }
  }
  return result as Partial<Row<T>>;
}

/** Tables whose INSERT policy also admits the current business's own row (`id = current`). */
const SELF_INSERT = new Set<string>(['businesses', 'financial_entities']);

/**
 * INSERT of one row whose parameters went through `pgParams`, in Postgres's order: the RLS WITH
 * CHECK policy (before NOT NULL and CHECK constraints, which the store checks first), then the
 * store's insert (constraints, ON CONFLICT, foreign keys).
 */
export async function insertRow<T extends TableName>(
  db: QueryDb,
  table: T,
  values: Partial<Row<T>>,
  onConflict?: ConflictOptions,
): Promise<Row<T> | null> {
  const row = values as AnyRow;
  const info = tableInfo(table);
  if (info.tenancy === 'owner') {
    const current = db.ctx.businessId;
    const allowed =
      current !== null &&
      (row[info.ownerColumn!] === current || (SELF_INSERT.has(table) && row['id'] === current));
    if (!allowed) throw rlsViolation(table);
  }
  return db.insert(table, row as Partial<Row<T>>, onConflict);
}

// ---------------------------------------------------------------------------------------------
// jsonb
// ---------------------------------------------------------------------------------------------

/** jsonb object keys are stored shortest first, then by bytes. */
function compareJsonbKeys(a: string, b: string): number {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return ba.length - bb.length;
  return Buffer.compare(ba, bb);
}

/** `jsonb::text` as Postgres prints it (`{"a": 1, "b": [1, 2]}`). */
export function jsonbOut(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(jsonbOut).join(', ')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    compareJsonbKeys(a, b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${jsonbOut(v)}`).join(', ')}}`;
}

/** A jsonb value as text (`->>`, `jsonb_array_elements_text`): strings unquoted, JSON null is NULL. */
export function jsonbText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return jsonbOut(value);
}

/** `json ->> 'key'`: NULL unless the value is an object holding the key. */
export function jsonField(json: unknown, key: string): string | null {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return null;
  return jsonbText(obj[key]);
}

// ---------------------------------------------------------------------------------------------
// LIKE with an ESCAPE character
// ---------------------------------------------------------------------------------------------

const escapeRegex = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text LIKE pattern ESCAPE esc` (case-sensitive). NULL text or pattern never matches. */
export function likeEscape(text: string | null, pattern: string | null, escape: string): boolean {
  if (text == null || pattern == null) return false;
  const chars = [...pattern];
  let source = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch === escape) {
      if (i + 1 >= chars.length) {
        throw new DbError('LIKE pattern must not end with escape character', '22025');
      }
      source += escapeRegex(chars[++i]!);
    } else if (ch === '%') source += '[\\s\\S]*';
    else if (ch === '_') source += '[\\s\\S]';
    else source += escapeRegex(ch);
  }
  return new RegExp(`^${source}$`, 'u').test(text);
}

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

/**
 * The restrictive `tenant_isolation_delete` policy (`owner_id = current_business_id`): rows of
 * other tenants in the read scope are silently left alone by DELETE.
 */
export function deletable<R extends { owner_id?: unknown }>(db: QueryDb, rows: readonly R[]): R[] {
  const businessId = db.ctx.businessId;
  return rows.filter(row => businessId !== null && row.owner_id === businessId);
}

/** One `UPDATE table SET column = value WHERE column = match [AND extra]` of a writable-CTE statement. */
export interface UpdateStep {
  table: TableName;
  column: string;
  value: unknown;
  match: unknown;
  /** Further WHERE conditions, evaluated on the statement's snapshot. */
  where?: (row: AnyRow) => boolean;
  /** Runs on each new row (a RETURNING list that can raise). */
  returning?: (row: AnyRow) => void;
}

/**
 * Runs `WITH a AS (UPDATE ...), b AS (UPDATE ...) UPDATE ... RETURNING` the way Postgres does:
 * - every sub-statement picks its rows from the snapshot taken when the statement starts, so none
 *   sees another's changes;
 * - the main statement runs first, then the CTEs that nothing reads, last-declared first (they are
 *   queued with lcons and drained by ExecPostprocessPlan);
 * - a row one sub-statement already updated is skipped by the others (TM_SelfModified).
 *
 * `steps` are in the order the SQL declares them, the main statement last. Returns the rows the
 * main statement updated (new versions).
 */
export async function runWritableCtes(db: QueryDb, steps: UpdateStep[]): Promise<AnyRow[]> {
  // Parameters are converted to the column type before anything runs.
  steps = steps.map(step => {
    const column = tableInfo(step.table).columnByName.get(step.column)!;
    if (column.pgType !== 'uuid') return step;
    const cast = (v: unknown) => (v == null ? null : castUuid(String(v)));
    return { ...step, value: cast(step.value), match: cast(step.match) };
  });

  const targets: AnyRow[][] = [];
  for (const step of steps) {
    if (step.match == null) {
      targets.push([]);
      continue;
    }
    const rows = (await db.where(step.table, {
      [step.column]: step.match,
    } as never)) as unknown as AnyRow[];
    targets.push(rows.filter(row => !step.where || step.where(row)));
  }

  const modified = new Set<string>();
  const keyOf = (table: TableName, row: AnyRow) => {
    const pk = tableInfo(table).primaryKey ?? Object.keys(row);
    return `${table}:${JSON.stringify(pk.map(c => row[c] ?? null))}`;
  };

  let mainRows: AnyRow[] = [];
  // main statement, then the CTEs last-declared first
  const order = steps.map((_, i) => steps.length - 1 - i);
  for (const index of order) {
    const step = steps[index]!;
    const updated: AnyRow[] = [];
    for (const row of targets[index]!) {
      const key = keyOf(step.table, row);
      if (modified.has(key)) continue;
      modified.add(key);
      const next = (await db.update(
        step.table,
        row as never,
        {
          [step.column]: step.value,
        } as never,
      )) as unknown as AnyRow;
      step.returning?.(next);
      updated.push(next);
    }
    if (index === steps.length - 1) mainRows = updated;
  }
  return mainRows;
}
