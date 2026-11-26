/**
 * End-to-end check of the Firestore engine: replays the web client's own GraphQL queries against a
 * running API and records the answers, then compares two recordings (Postgres engine vs Firestore
 * engine on the same data).
 *
 *   # API on Postgres (ALLOW_DEV_AUTH=1), then:
 *   yarn workspace @accounter/server tsx scripts/firestore/compare-graphql.ts record pg.json
 *   # API on Firestore with the same data imported, then:
 *   yarn workspace @accounter/server tsx scripts/firestore/compare-graphql.ts record fs.json
 *   yarn workspace @accounter/server tsx scripts/firestore/compare-graphql.ts compare pg.json fs.json
 *
 * Every query operation in packages/client/src/gql/graphql.ts is sent with its required variables
 * filled from the local Postgres demo data (POSTGRES_* env, ids of the dev-auth user's business).
 * Operations whose variables cannot be filled are listed and skipped.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  Kind,
  print,
  type DocumentNode,
  type OperationDefinitionNode,
  type TypeNode,
  type VariableDefinitionNode,
} from 'graphql';
import pg from 'pg';
import * as client from '../../../client/src/gql/graphql.js';

const API = process.env.API_URL ?? 'http://localhost:4000/graphql';
const USER = process.env.DEV_AUTH_USER_ID ?? '0bbbf9b0-e4e5-553a-8a0b-cc26cd2f1a61';

type Recording = Record<
  string,
  { variables: Record<string, unknown>; status: number; body: unknown; ms: number }
>;

function typeName(type: TypeNode): { name: string; list: boolean; required: boolean } {
  let required = false;
  let list = false;
  let t = type;
  if (t.kind === Kind.NON_NULL_TYPE) {
    required = true;
    t = t.type;
  }
  if (t.kind === Kind.LIST_TYPE) {
    list = true;
    t = t.type;
    if (t.kind === Kind.NON_NULL_TYPE) t = t.type;
  }
  return { name: (t as { name: { value: string } }).name.value, list, required };
}

async function sampleIds() {
  const db = new pg.Client({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 54329),
    database: process.env.POSTGRES_DB ?? 'accounter_demo',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  });
  await db.connect();
  const one = async (sql: string) => (await db.query(sql)).rows.map(r => Object.values(r)[0]);
  const owner = (
    await db.query('SELECT business_id FROM accounter_schema.business_users WHERE user_id = $1', [
      USER,
    ])
  ).rows[0]?.business_id as string;
  const ids = {
    owner,
    charge: await one(
      `SELECT id FROM accounter_schema.charges WHERE owner_id = '${owner}' ORDER BY id LIMIT 3`,
    ),
    business: await one(
      `SELECT id FROM accounter_schema.businesses WHERE owner_id = '${owner}' AND id <> '${owner}' ORDER BY id LIMIT 3`,
    ),
    document: await one(
      `SELECT id FROM accounter_schema.documents WHERE owner_id = '${owner}' ORDER BY id LIMIT 3`,
    ),
    transaction: await one(
      `SELECT id FROM accounter_schema.transactions WHERE owner_id = '${owner}' ORDER BY id LIMIT 3`,
    ),
    tag: await one(
      `SELECT id FROM accounter_schema.tags WHERE owner_id = '${owner}' ORDER BY id LIMIT 3`,
    ),
    taxCategory: await one(
      `SELECT id FROM accounter_schema.tax_categories WHERE owner_id = '${owner}' ORDER BY id LIMIT 3`,
    ),
    financialAccount: await one(
      `SELECT id FROM accounter_schema.financial_accounts WHERE owner = '${owner}' ORDER BY id LIMIT 3`,
    ),
  };
  await db.end();
  return ids;
}

type Ids = Awaited<ReturnType<typeof sampleIds>>;

/** A value for a required variable, or undefined when there is no sensible one. */
function valueFor(variable: VariableDefinitionNode, ids: Ids): unknown {
  const name = variable.variable.name.value.toLowerCase();
  const { name: type, list } = typeName(variable.type);
  const pick = (): unknown => {
    switch (type) {
      case 'UUID':
      case 'ID': {
        const key = (
          [
            ['charge', 'charge'],
            ['document', 'document'],
            ['transaction', 'transaction'],
            ['tag', 'tag'],
            ['taxcategory', 'taxCategory'],
            ['account', 'financialAccount'],
            ['owner', 'owner'],
            ['admin', 'owner'],
            ['business', 'business'],
            ['counterparty', 'business'],
            ['client', 'business'],
            ['entity', 'business'],
          ] as const
        ).find(([needle]) => name.includes(needle))?.[1];
        if (!key) return undefined;
        const value = ids[key];
        return Array.isArray(value) ? value[0] : value;
      }
      case 'TimelessDate':
      case 'Date':
        return /to|end|until/.test(name) ? '2024-12-31' : '2024-01-01';
      case 'Int':
        if (name.includes('year')) return 2024;
        if (name.includes('limit') || name.includes('size')) return 50;
        if (name.includes('page')) return 1;
        return undefined;
      case 'String':
        return name.includes('year') ? '2024' : undefined;
      case 'Boolean':
        return false;
      default:
        return undefined;
    }
  };
  if (list) {
    const one = pick();
    if (one === undefined) return undefined;
    const key = typeof one === 'string' && one === ids.owner ? null : one;
    return key === null ? [one] : [one];
  }
  return pick();
}

function operations(): { name: string; text: string; op: OperationDefinitionNode }[] {
  const result = [];
  for (const [exportName, value] of Object.entries(client)) {
    if (!exportName.endsWith('Document')) continue;
    const doc = value as DocumentNode;
    const op = doc.definitions?.find(
      (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION,
    );
    if (!op || op.operation !== 'query') continue;
    result.push({ name: op.name?.value ?? exportName, text: print(doc), op });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

async function record(file: string) {
  const ids = await sampleIds();
  const recording: Recording = {};
  const skipped: string[] = [];
  for (const { name, text, op } of operations()) {
    const variables: Record<string, unknown> = {};
    let missing: string | null = null;
    for (const v of op.variableDefinitions ?? []) {
      if (v.type.kind !== Kind.NON_NULL_TYPE || v.defaultValue) continue;
      const value = valueFor(v, ids);
      if (value === undefined) {
        missing = `$${v.variable.name.value}: ${print(v.type)}`;
        break;
      }
      variables[v.variable.name.value] = value;
    }
    if (missing) {
      skipped.push(`${name} (${missing})`);
      continue;
    }
    const started = Date.now();
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dev-auth': USER },
      body: JSON.stringify({ query: text, variables, operationName: op.name?.value }),
    });
    const body = await response.json().catch(() => null);
    recording[name] = { variables, status: response.status, body, ms: Date.now() - started };
    const errors = (body as { errors?: { message: string }[] } | null)?.errors;
    console.log(
      `${errors ? 'ERR ' : 'ok  '} ${name} (${Date.now() - started} ms)${errors ? `: ${errors[0]!.message.slice(0, 160)}` : ''}`,
    );
  }
  writeFileSync(file, JSON.stringify(recording, null, 1));
  console.log(
    `recorded ${Object.keys(recording).length} operations to ${file}; skipped ${skipped.length}`,
  );
  if (skipped.length) console.log(`skipped: ${skipped.join('; ')}`);
}

function canonical(value: unknown, sortArrays: boolean): unknown {
  if (Array.isArray(value)) {
    const items = value.map(v => canonical(v, sortArrays));
    return sortArrays ? items.map(i => JSON.stringify(i)).sort() : items;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(k => [k, canonical((value as Record<string, unknown>)[k], sortArrays)]),
    );
  }
  return value;
}

function firstDifference(a: unknown, b: unknown, path = ''): string | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const diff = firstDifference(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
      if (diff) return diff;
    }
  }
  return `${path || '(root)'}: pg=${JSON.stringify(a)?.slice(0, 200)} fs=${JSON.stringify(b)?.slice(0, 200)}`;
}

function compare(pgFile: string, fsFile: string) {
  const pgRec: Recording = JSON.parse(readFileSync(pgFile, 'utf8'));
  const fsRec: Recording = JSON.parse(readFileSync(fsFile, 'utf8'));
  let same = 0;
  let orderOnly = 0;
  const different: string[] = [];
  for (const name of Object.keys(pgRec).sort()) {
    const a = pgRec[name]!.body;
    const b = fsRec[name]?.body;
    if (JSON.stringify(canonical(a, false)) === JSON.stringify(canonical(b, false))) same++;
    else if (JSON.stringify(canonical(a, true)) === JSON.stringify(canonical(b, true))) orderOnly++;
    else
      different.push(`${name}\n    ${firstDifference(canonical(a, false), canonical(b, false))}`);
  }
  for (const line of different) console.log(`DIFF ${line}`);
  console.log(
    `compare: ${same} identical, ${orderOnly} same up to array order, ${different.length} different (of ${Object.keys(pgRec).length})`,
  );
}

const [command, a, b] = process.argv.slice(2);
if (command === 'record' && a) await record(a);
else if (command === 'compare' && a && b) compare(a, b);
else {
  console.error('usage: compare-graphql.ts record <file> | compare <pg file> <fs file>');
  process.exit(2);
}
