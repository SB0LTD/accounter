/**
 * Proves the Firestore ports: runs every ported query against Postgres (the original SQL) and
 * against the Firestore store (the port) on the same data, and compares the rows.
 *
 *   POSTGRES_HOST=localhost POSTGRES_PORT=54329 POSTGRES_DB=<your verify db> \
 *     yarn workspace @accounter/server firestore:verify [--only <path substring>] [--verbose]
 *
 * - Ports are found by convention (src/firestore/queries/<provider path>, export named like the
 *   query), not through the generated index, so several people can port at once.
 * - The data is whatever that local database holds; it is copied into an in-memory store, so
 *   Postgres and the store start identical.
 * - Postgres runs each query as an RLS-bound role (`SET LOCAL ROLE accounter_verify`) with the same
 *   `app.*` settings TenantAwareDBClient sets, so tenant visibility is compared too.
 * - Every case runs in a transaction that is rolled back on both sides; writes compare their
 *   RETURNING rows, with generated ids and timestamps masked.
 * - Rows compare in order when the statement ends with a top-level ORDER BY, as multisets otherwise.
 *   Arrays inside rows that differ only in element order are reported as ARRAY-ORDER, not FAIL.
 * - Both sides run in UTC, as Cloud Run does.
 *
 * Refuses any database host but localhost.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { sql as pgTypedSql } from '@pgtyped/runtime';
import { allTables, tableInfo, type AnyRow, type TableName } from '../../src/firestore/catalog.js';
import type { Cases, Snapshot } from '../../src/firestore/queries/cases.js';
import type { QueryImpl, QueryShape } from '../../src/firestore/queries/port.js';
import { runImpl } from '../../src/firestore/queries/run-impl.js';
import { queryDb } from '../../src/firestore/query-db.js';
import { memoryStore } from '../../src/firestore/store.js';
import type { SessionContext } from '../../src/firestore/transaction.js';
import { docIdFor, encodeRow } from '../../src/firestore/values.js';
import { pgTypeParsers } from '../../src/shared/helpers/pg-type-parsers.js';

process.env.TZ = 'UTC';

const here = dirname(fileURLToPath(import.meta.url));
const portsDir = resolve(here, '../../src/firestore/queries');
const SQL_INDEX: Record<string, { source: string; type: string | null; text: string }> = JSON.parse(
  readFileSync(resolve(here, 'queries.sql.generated.json'), 'utf8'),
);

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const verbose = args.includes('--verbose');

const host = process.env.POSTGRES_HOST ?? 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`firestore:verify only runs against a local database (POSTGRES_HOST=${host})`);
  process.exit(2);
}

const ROLE = 'accounter_verify';

// -------------------------------------------------------------------------------------------
// Comparison
// -------------------------------------------------------------------------------------------

function normalize(value: unknown, sortArrays = false): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return { $date: value.toISOString() };
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) {
    const items = value.map(v => normalize(v, sortArrays));
    return sortArrays ? items.map(i => JSON.stringify(i)).sort() : items;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(k => [k, normalize((value as AnyRow)[k], sortArrays)]),
    );
  }
  return value;
}

/** Whether the statement's outermost query ends in ORDER BY (ignoring subqueries and strings). */
function hasTopLevelOrderBy(text: string): boolean {
  let depth = 0;
  let found = false;
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (ch === "'") {
      i = lower.indexOf("'", i + 1);
      if (i < 0) break;
    } else if (ch === '-' && lower[i + 1] === '-') {
      i = lower.indexOf('\n', i);
      if (i < 0) break;
    } else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && /^order\s+by\b/.test(lower.slice(i, i + 12))) found = true;
    else if (depth === 0 && /^union\b/.test(lower.slice(i, i + 6))) found = false;
  }
  return found;
}

const isWrite = (text: string) => /\b(insert\s+into|update\s+[\w.]+|delete\s+from)\b/i.test(text);

const GENERATED = /^(id|.*_at)$/;

function mask(rows: unknown[], write: boolean): unknown[] {
  if (!write) return rows;
  return rows.map(row => {
    if (!row || typeof row !== 'object') return row;
    return Object.fromEntries(
      Object.entries(row as AnyRow).map(([k, v]) => [
        k,
        GENERATED.test(k) && v != null ? '<generated>' : v,
      ]),
    );
  });
}

function serialize(rows: unknown[], sortArrays: boolean): string[] {
  return rows.map(r => JSON.stringify(normalize(r, sortArrays)));
}

function compareOnce(a: string[], b: string[], ordered: boolean): string | null {
  if (a.length !== b.length) {
    return `row count: postgres ${a.length}, firestore ${b.length}\n  pg[0]=${a[0] ?? '-'}\n  fs[0]=${b[0] ?? '-'}`;
  }
  if (ordered) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        const sameSet = [...a].sort().join('\n') === [...b].sort().join('\n');
        return `${sameSet ? 'ORDER ONLY: ' : ''}row ${i} differs\n  pg=${a[i]}\n  fs=${b[i]}`;
      }
    }
    return null;
  }
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return `rows differ\n  pg=${sa[i]}\n  fs=${sb[i]}`;
  }
  return null;
}

function compare(pgRows: unknown[], fsRows: unknown[], ordered: boolean): string | null {
  const exact = compareOnce(serialize(pgRows, false), serialize(fsRows, false), ordered);
  if (!exact) return null;
  const ignoringArrayOrder = compareOnce(serialize(pgRows, true), serialize(fsRows, true), ordered);
  return ignoringArrayOrder ? exact : `ARRAY-ORDER: ${exact}`;
}

// -------------------------------------------------------------------------------------------
// Setup
// -------------------------------------------------------------------------------------------

async function ensureRole(client: pg.Client) {
  const { rows } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [ROLE]);
  if (rows.length === 0) await client.query(`CREATE ROLE ${ROLE} NOLOGIN NOINHERIT NOBYPASSRLS`);
  await client.query(`GRANT USAGE ON SCHEMA accounter_schema TO ${ROLE}`);
  await client.query(`GRANT ALL ON ALL TABLES IN SCHEMA accounter_schema TO ${ROLE}`);
  await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA accounter_schema TO ${ROLE}`);
}

async function snapshot(client: pg.Client) {
  const data = new Map<string, AnyRow[]>();
  for (const table of allTables()) {
    const order = table.primaryKey ? ` ORDER BY ${table.primaryKey.join(', ')}` : '';
    const { rows } = await client.query(`SELECT * FROM accounter_schema.${table.name}${order}`);
    data.set(table.name, rows);
  }
  return data;
}

function makeSnapshot(data: Map<string, AnyRow[]>, ctx: SessionContext): Snapshot {
  return {
    rows: (table: TableName) => data.get(table) ?? [],
    ids: (table: TableName, n = 3) =>
      (data.get(table) ?? [])
        .map(r => r.id as string)
        .filter(Boolean)
        .slice(0, n),
    values: (table: TableName, column: string, n = 3) => {
      const seen = new Map<string, unknown>();
      for (const row of data.get(table) ?? []) {
        const v = row[column];
        if (v != null && !seen.has(JSON.stringify(v))) seen.set(JSON.stringify(v), v);
      }
      return [...seen.values()].slice(0, n);
    },
    businessId: ctx.businessId!,
    userId: ctx.userId,
    missingId: '00000000-0000-4000-8000-00000000dead',
  };
}

const moduleCache = new Map<string, Record<string, unknown> | null>();
async function loadModule(file: string): Promise<Record<string, unknown> | null> {
  if (moduleCache.has(file)) return moduleCache.get(file)!;
  const path = resolve(portsDir, file);
  const module = existsSync(path)
    ? ((await import(pathToFileURL(path).href)) as Record<string, unknown>)
    : null;
  moduleCache.set(file, module);
  return module;
}

// -------------------------------------------------------------------------------------------
// Running
// -------------------------------------------------------------------------------------------

async function runPostgres(client: pg.Client, text: string, params: unknown, ctx: SessionContext) {
  const strings = Object.assign([text], { raw: [text] }) as unknown as TemplateStringsArray;
  const query = pgTypedSql<{ params: unknown; result: unknown }>(strings);
  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL ROLE ${ROLE}`);
    await client.query(
      `SELECT set_config('app.current_business_id', $1, true), set_config('app.current_user_id', $2, true),
              set_config('app.auth_type', $3, true), set_config('app.current_business_scope', $4, true)`,
      [
        ctx.businessId,
        ctx.userId ?? '',
        ctx.authType,
        `{${ctx.scope.map(s => `"${s}"`).join(',')}}`,
      ],
    );
    return await query.run(params as never, client);
  } finally {
    await client.query('ROLLBACK');
  }
}

const describeError = (error: unknown) =>
  `${(error as { code?: string }).code ?? ''} ${(error as Error).message}`.trim();

async function main() {
  const client = new pg.Client({
    host,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'accounter_demo',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    types: pgTypeParsers,
  });
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");
  await ensureRole(client);
  const data = await snapshot(client);

  const { store, backend } = memoryStore();
  for (const [name, rows] of data) {
    const info = tableInfo(name);
    const byPartition = new Map<string, { docId: string; data: Record<string, unknown> }[]>();
    for (const row of rows) {
      const partition = info.tenancy === 'owner' ? String(row[info.ownerColumn!]) : '';
      const list = byPartition.get(partition) ?? [];
      list.push({ docId: docIdFor(info, row), data: encodeRow(info, row) });
      byPartition.set(partition, list);
    }
    for (const [partition, docs] of byPartition) backend.seed({ partition, table: name }, docs);
  }

  const tenants = [...new Set((data.get('user_context') ?? []).map(r => r.owner_id as string))];
  if (tenants.length === 0) throw new Error('No tenant (user_context row) in the database');
  const contexts: SessionContext[] = tenants.map(businessId => ({
    businessId,
    scope: [businessId],
    userId:
      ((data.get('business_users') ?? []).find(r => r.business_id === businessId)
        ?.user_id as string) ?? null,
    authType: 'jwt',
  }));

  const totals = { pass: 0, fail: 0, soft: 0, noCases: 0, unported: 0 };
  const problems: string[] = [];

  for (const [key, entry] of Object.entries(SQL_INDEX)) {
    if (only && !entry.source.includes(only)) continue;
    const [file, name] = entry.source.split('#') as [string, string];
    const module = await loadModule(file);
    const impl = module?.[name] as QueryImpl<QueryShape> | undefined;
    if (!impl) {
      totals.unported++;
      if (verbose) console.log(`unported  ${entry.source}`);
      continue;
    }
    const casesModule = await loadModule(file.replace(/\.ts$/, '.cases.ts'));
    const caseFn = (casesModule?.cases as Cases | undefined)?.[name];
    const hasParams = /[$:]\w/.test(entry.text.replace(/::\w+/g, ''));

    for (const ctx of contexts) {
      const snap = makeSnapshot(data, ctx);
      const paramSets = caseFn ? caseFn(snap) : hasParams ? null : [{}];
      if (!paramSets) {
        totals.noCases++;
        problems.push(`NO CASES  ${entry.source}`);
        break;
      }
      for (const [i, params] of paramSets.entries()) {
        const label = `${entry.source} [case ${i}]`;
        const write = isWrite(entry.text);
        let pgRows: unknown[] | null = null;
        let pgError: unknown = null;
        try {
          pgRows = await runPostgres(client, entry.text, params, ctx);
        } catch (error) {
          pgError = error;
        }
        let fsRows: unknown[] | null = null;
        let fsError: unknown = null;
        const tx = store.begin(() => ctx);
        try {
          // Ports that call set_config get a session that only reports the value, as the Postgres
          // side's setting is rolled back with its transaction too.
          fsRows = await runImpl(
            impl,
            params,
            queryDb(tx, { setConfig: (_name, value) => (value == null ? '' : String(value)) }),
          );
        } catch (error) {
          fsError = error;
        } finally {
          tx.rollback();
        }

        let problem: string | null = null;
        let outcome = `${pgRows?.length ?? 0} rows`;
        if (pgError || fsError) {
          const pgCode = (pgError as { code?: string } | null)?.code;
          const fsCode = (fsError as { code?: string } | null)?.code;
          if (pgError && fsError && pgCode === fsCode) {
            outcome = `both raised ${pgCode}`;
          } else {
            problem = `postgres ${pgError ? `raised ${describeError(pgError)}` : 'succeeded'}; firestore ${fsError ? `raised ${describeError(fsError)}` : 'succeeded'}`;
            if (fsError && verbose) console.error(fsError);
          }
        } else {
          problem = compare(
            mask(pgRows!, write),
            mask(fsRows!, write),
            hasTopLevelOrderBy(entry.text),
          );
        }

        if (!problem) {
          totals.pass++;
          if (verbose) console.log(`ok        ${label} (${outcome})`);
        } else if (problem.startsWith('ORDER ONLY') || problem.startsWith('ARRAY-ORDER')) {
          totals.soft++;
          problems.push(`SOFT      ${label}: ${problem}`);
        } else {
          totals.fail++;
          problems.push(`FAIL      ${label}: ${problem}`);
        }
      }
    }
  }

  await client.end();
  store.close();
  for (const line of problems) console.log(line);
  console.log(
    `firestore:verify  pass ${totals.pass}  fail ${totals.fail}  soft ${totals.soft}  no-cases ${totals.noCases}  unported ${totals.unported}`,
  );
  process.exit(totals.fail || totals.noCases ? 1 : 0);
}

await main();
