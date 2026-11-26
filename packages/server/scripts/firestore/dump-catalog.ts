/**
 * Builds the Firestore store's table catalog from a Postgres database that the migrations brought to
 * the latest version.
 *
 *   POSTGRES_HOST=localhost POSTGRES_PORT=54329 yarn workspace @accounter/server firestore:catalog
 *
 * Writes `src/firestore/schema/catalog.generated.ts` (what the store reads at run time) and
 * `src/firestore/schema/rows.generated.ts` (one row type per table). Re-run it after merging new
 * migrations from upstream; the diff of those two files is the schema change the port must absorb.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type {
  CatalogFile,
  ColumnDefault,
  ColumnKind,
  ColumnMeta,
  ForeignKeyMeta,
  TableMeta,
  UniqueMeta,
} from '../../src/firestore/schema/catalog-types.js';

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = resolve(here, '../../src/firestore/schema');

const CATALOG_SQL = `
SELECT json_build_object(
 'tables', (SELECT json_agg(t ORDER BY t->>'name') FROM (
   SELECT json_build_object(
     'name', c.relname,
     'columns', (SELECT json_agg(json_build_object(
         'name', a.attname,
         'type', format_type(a.atttypid, a.atttypmod),
         'typtype', (SELECT typtype FROM pg_type WHERE oid = a.atttypid),
         'elemTyptype', (SELECT et.typtype FROM pg_type tt JOIN pg_type et ON et.oid = tt.typelem WHERE tt.oid = a.atttypid AND tt.typcategory = 'A'),
         'notNull', a.attnotnull,
         'default', pg_get_expr(d.adbin, d.adrelid),
         'generated', NULLIF(a.attgenerated, '')
       ) ORDER BY a.attnum)
       FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped),
     'constraints', (SELECT json_agg(json_build_object(
         'name', co.conname, 'type', co.contype, 'def', pg_get_constraintdef(co.oid),
         'columns', (SELECT json_agg(att.attname ORDER BY k.ord) FROM unnest(co.conkey) WITH ORDINALITY k(attnum, ord) JOIN pg_attribute att ON att.attrelid = co.conrelid AND att.attnum = k.attnum),
         'refTable', (SELECT relname FROM pg_class WHERE oid = co.confrelid),
         'refColumns', (SELECT json_agg(att.attname ORDER BY k.ord) FROM unnest(co.confkey) WITH ORDINALITY k(attnum, ord) JOIN pg_attribute att ON att.attrelid = co.confrelid AND att.attnum = k.attnum),
         'onDelete', co.confdeltype,
         'nullsNotDistinct', (SELECT i.indnullsnotdistinct FROM pg_index i WHERE i.indexrelid = co.conindid)
       ) ORDER BY co.conname) FROM pg_constraint co WHERE co.conrelid = c.oid),
     'uniqueIndexes', (SELECT json_agg(json_build_object(
         'name', ic.relname,
         'def', pg_get_indexdef(i.indexrelid),
         'simpleColumns', (SELECT json_agg(att.attname ORDER BY k.ord) FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord) JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = k.attnum),
         'hasExpressions', i.indexprs IS NOT NULL,
         'hasPredicate', i.indpred IS NOT NULL,
         'nullsNotDistinct', i.indnullsnotdistinct
       ) ORDER BY ic.relname)
       FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid
       WHERE i.indrelid = c.oid AND i.indisunique AND NOT i.indisprimary
         AND NOT EXISTS (SELECT 1 FROM pg_constraint co WHERE co.conindid = i.indexrelid)),
     'policies', (SELECT json_agg(json_build_object('cmd', p.polcmd, 'using', pg_get_expr(p.polqual, p.polrelid), 'check', pg_get_expr(p.polwithcheck, p.polrelid))) FROM pg_policy p WHERE p.polrelid = c.oid)
   ) AS t
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'accounter_schema' AND c.relkind IN ('r','p') AND c.relname <> 'migration'
 ) s),
 'enums', (SELECT json_object_agg(t.typname, (SELECT json_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid))
   FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'accounter_schema' AND t.typtype = 'e')
) AS catalog;`;

type RawColumn = {
  name: string;
  type: string;
  typtype: string;
  elemTyptype: string | null;
  notNull: boolean;
  default: string | null;
  generated: string | null;
};
type RawConstraint = {
  name: string;
  type: 'p' | 'u' | 'f' | 'c' | 'x' | 't' | 'n';
  def: string;
  columns: string[] | null;
  refTable: string | null;
  refColumns: string[] | null;
  onDelete: string;
  nullsNotDistinct: boolean | null;
};
type RawUniqueIndex = {
  name: string;
  def: string;
  simpleColumns: string[] | null;
  hasExpressions: boolean;
  hasPredicate: boolean;
  nullsNotDistinct: boolean;
};
type RawTable = {
  name: string;
  columns: RawColumn[];
  constraints: RawConstraint[] | null;
  uniqueIndexes: RawUniqueIndex[] | null;
  policies: { cmd: string; using: string | null; check: string | null }[] | null;
};

function kindOf(type: string, typtype: string | null): ColumnKind {
  const base = type.replace(/\(.*\)/, '').replace(/^accounter_schema\./, '');
  if (typtype === 'e') return 'string';
  switch (base) {
    case 'uuid':
    case 'text':
    case 'character varying':
    case 'character':
    case 'inet':
      return 'string';
    case 'numeric':
      return 'decimal';
    case 'bigint':
      return 'int8';
    case 'integer':
    case 'smallint':
      return 'int';
    case 'real':
    case 'double precision':
      return 'float';
    case 'boolean':
      return 'bool';
    case 'date':
      return 'date';
    case 'time without time zone':
      return 'time';
    case 'timestamp with time zone':
    case 'timestamp without time zone':
      return 'timestamp';
    case 'json':
    case 'jsonb':
      return 'json';
    case 'bit':
    case 'bit varying':
      return 'bits';
    default:
      throw new Error(`Unmapped Postgres type "${type}"`);
  }
}

function parseLiteral(raw: string, kind: ColumnKind, isArray: boolean): unknown {
  if (isArray) {
    if (raw === "'{}'" || /^ARRAY\[\]$/.test(raw)) return [];
    throw new Error(`Unparsed array literal ${raw}`);
  }
  const quoted = /^'(.*)'$/s.exec(raw);
  const text = quoted ? quoted[1]!.replaceAll("''", "'") : raw;
  switch (kind) {
    case 'int':
    case 'float':
      return Number(text);
    case 'bool':
      return text === 'true';
    case 'json':
      return JSON.parse(text);
    default:
      return text;
  }
}

function parseDefault(
  expr: string | null,
  kind: ColumnKind,
  isArray: boolean,
): ColumnDefault | null {
  if (expr == null) return null;
  if (expr === 'uuidv7()') return { kind: 'uuidv7' };
  if (expr === 'gen_random_uuid()') return { kind: 'uuid4' };
  if (expr === 'now()' || expr === 'CURRENT_TIMESTAMP') return { kind: 'now' };
  if (expr === 'clock_timestamp()') return { kind: 'clock' };
  if (expr === 'CURRENT_DATE') return { kind: 'today' };
  // Strip any trailing casts: 'x'::type, ARRAY[]::uuid[], '{}'::jsonb[]
  const uncast = expr.replace(/(::[a-z_."\s]+(\(\d+(,\d+)?\))?(\[\])?)+$/i, '');
  return { kind: 'literal', value: parseLiteral(uncast, kind, isArray) };
}

const OWNER_POLICY =
  /^\(?\(?(owner_id) = (ANY \()?accounter_schema\.get_current_business_(id|scope)\(\)\)?\)?\)?$/;

function tenancyOf(
  table: RawTable,
): Pick<TableMeta, 'tenancy' | 'ownerColumn' | 'writeGuard' | 'readScope'> {
  const policies = table.policies ?? [];
  if (policies.length === 0) {
    return { tenancy: 'global', ownerColumn: null, writeGuard: null, readScope: 'all' };
  }
  // Permissive policies OR together, so a table reads across the business scope when any policy
  // that applies to SELECT (`r` or `*`) uses the scope.
  const readPolicies = policies.filter(p => p.cmd === 'r' || p.cmd === '*');
  const readScope = readPolicies.some(p => p.using === 'true')
    ? 'all'
    : readPolicies.some(p => /get_current_business_scope\(\)/.test(p.using ?? ''))
      ? 'scope'
      : 'current';
  return { ...tenancyWithoutScope(table, policies), readScope };
}

function tenancyWithoutScope(
  table: RawTable,
  policies: NonNullable<RawTable['policies']>,
): Pick<TableMeta, 'tenancy' | 'ownerColumn' | 'writeGuard'> {
  const readsAll = policies.some(p => p.cmd === 'r' && p.using === 'true');
  const writeColumn = policies
    .map(p => /^\(+(owner_id|tenant_candidate) = /.exec(p.using ?? '')?.[1])
    .find(Boolean);
  if (table.name === 'financial_entities' || table.name === 'businesses') {
    // `businesses` and `financial_entities` also let a tenant see its own self-owned row; that row's
    // owner_id is its own id, so owner scoping covers it.
    return { tenancy: 'owner', ownerColumn: 'owner_id', writeGuard: null };
  }
  if (readsAll && policies.length === 1) {
    return { tenancy: 'global', ownerColumn: null, writeGuard: 'readonly' };
  }
  if (readsAll) {
    // Readable by every tenant, writable only for the current business: a global table with a guard.
    return { tenancy: 'global', ownerColumn: null, writeGuard: writeColumn ?? 'owner_id' };
  }
  if (readsAll || writeColumn === 'tenant_candidate') {
    return { tenancy: 'global', ownerColumn: null, writeGuard: writeColumn ?? 'owner_id' };
  }
  if (policies.every(p => OWNER_POLICY.test(p.using ?? ''))) {
    return { tenancy: 'owner', ownerColumn: 'owner_id', writeGuard: null };
  }
  throw new Error(
    `Unclassified RLS on ${table.name}: ${JSON.stringify(policies.map(p => p.using))}`,
  );
}

const ON_DELETE: Record<string, ForeignKeyMeta['onDelete']> = {
  a: 'noaction',
  r: 'restrict',
  c: 'cascade',
  n: 'setnull',
  d: 'setdefault',
};

function buildTable(table: RawTable): TableMeta {
  const columns: ColumnMeta[] = table.columns.map(col => {
    const isArray = col.type.endsWith('[]');
    const kind = kindOf(
      isArray ? col.type.slice(0, -2) : col.type,
      isArray ? col.elemTyptype : col.typtype,
    );
    if (col.generated)
      throw new Error(`Generated column ${table.name}.${col.name} is not supported`);
    return {
      name: col.name,
      pgType: col.type.replace(/^accounter_schema\./, ''),
      kind,
      array: isArray,
      notNull: col.notNull,
      default: parseDefault(col.default, kind, isArray),
    };
  });
  const constraints = table.constraints ?? [];
  const pk = constraints.find(c => c.type === 'p')?.columns ?? null;
  const uniques: UniqueMeta[] = [
    ...constraints
      .filter(c => c.type === 'u')
      .map(c => ({
        name: c.name,
        columns: c.columns ?? [],
        nullsNotDistinct: c.nullsNotDistinct === true,
        custom: false,
      })),
    ...(table.uniqueIndexes ?? []).map(index => ({
      name: index.name,
      columns: index.hasExpressions ? [] : (index.simpleColumns ?? []),
      nullsNotDistinct: index.nullsNotDistinct,
      // Expression or partial indexes are enforced by hand-written checks (constraints.ts).
      custom: index.hasExpressions || index.hasPredicate,
      definition: index.def.replaceAll('accounter_schema.', ''),
    })),
  ];
  const foreignKeys: ForeignKeyMeta[] = constraints
    .filter(c => c.type === 'f')
    .map(c => ({
      name: c.name,
      columns: c.columns ?? [],
      refTable: c.refTable!,
      refColumns: c.refColumns ?? [],
      onDelete: ON_DELETE[c.onDelete] ?? 'noaction',
    }));
  const checks = constraints
    .filter(c => c.type === 'c')
    .map(c => ({ name: c.name, definition: c.def.replaceAll('accounter_schema.', '') }));
  for (const c of constraints) {
    if (c.type === 'x' || c.type === 't') {
      throw new Error(`Unsupported constraint ${table.name}.${c.name} (${c.type})`);
    }
  }
  return {
    name: table.name,
    ...tenancyOf(table),
    primaryKey: pk,
    columns,
    uniques,
    foreignKeys,
    checks,
  };
}

const TS_TYPE: Record<ColumnKind, string> = {
  string: 'string',
  decimal: 'string',
  int8: 'string',
  int: 'number',
  float: 'number',
  bool: 'boolean',
  date: 'string',
  time: 'string',
  timestamp: 'Date',
  json: 'Json',
  bits: 'string',
};

function pascal(name: string): string {
  return name.replace(/(^|_)([a-z0-9])/g, (_, __, ch: string) => ch.toUpperCase());
}

function rowTypes(catalog: CatalogFile): string {
  const lines = [
    '// Generated by scripts/firestore/dump-catalog.ts. Do not edit.',
    '/* eslint-disable */',
    '',
    'export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };',
    '',
  ];
  for (const table of catalog.tables) {
    lines.push(`export interface ${pascal(table.name)}Row {`);
    for (const col of table.columns) {
      const enumValues = catalog.enums[col.pgType.replace(/\[\]$/, '')];
      const base = enumValues
        ? enumValues.map(v => JSON.stringify(v)).join(' | ')
        : TS_TYPE[col.kind];
      const type = col.array ? `Array<${base}>` : base;
      lines.push(`  ${col.name}: ${type}${col.notNull ? '' : ' | null'};`);
    }
    lines.push('}', '');
  }
  lines.push('export interface Tables {');
  for (const table of catalog.tables) lines.push(`  ${table.name}: ${pascal(table.name)}Row;`);
  lines.push('}', '', 'export type TableName = keyof Tables;', '');
  return lines.join('\n');
}

async function main() {
  const client = new pg.Client({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'accounter',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  });
  await client.connect();
  try {
    const { rows } = await client.query<{
      catalog: { tables: RawTable[]; enums: Record<string, string[]> };
    }>(CATALOG_SQL);
    const raw = rows[0]!.catalog;
    const { rows: migrationRows } = await client.query<{ name: string }>(
      'SELECT name FROM accounter_schema.migration ORDER BY name DESC LIMIT 1',
    );
    const catalog: CatalogFile = {
      schemaVersion: migrationRows[0]?.name ?? 'unknown',
      enums: raw.enums,
      tables: raw.tables.map(buildTable),
    };
    writeFileSync(
      resolve(schemaDir, 'catalog.generated.ts'),
      [
        '// Generated by scripts/firestore/dump-catalog.ts. Do not edit.',
        "import type { CatalogFile } from './catalog-types.js';",
        '',
        `export const catalog: CatalogFile = ${JSON.stringify(catalog, null, 2)};`,
        '',
      ].join('\n'),
    );
    writeFileSync(resolve(schemaDir, 'rows.generated.ts'), rowTypes(catalog));
    const tenant = catalog.tables.filter(t => t.tenancy === 'owner').length;
    console.log(
      `catalog: ${catalog.tables.length} tables (${tenant} tenant, ${catalog.tables.length - tenant} global), schema ${catalog.schemaVersion}`,
    );
  } finally {
    await client.end();
  }
}

await main();
