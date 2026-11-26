/**
 * Applies the verification fixtures (scripts/firestore/fixtures/*.sql, in name order) to a local
 * database. Refuses any host but localhost.
 *
 *   POSTGRES_HOST=localhost POSTGRES_PORT=54329 POSTGRES_DB=<verify db> \
 *     yarn workspace @accounter/server firestore:fixtures [--only <file name substring>]
 *
 * Every fixture file must be idempotent (ON CONFLICT DO NOTHING, fixed ids).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const host = process.env.POSTGRES_HOST ?? 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`firestore:fixtures only runs against a local database (POSTGRES_HOST=${host})`);
  process.exit(2);
}

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const dir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const files = readdirSync(dir)
  .filter(f => f.endsWith('.sql') && (!only || f.includes(only)))
  .sort();

const client = new pg.Client({
  host,
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? 'accounter_demo',
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
});
await client.connect();
try {
  for (const file of files) {
    await client.query(readFileSync(resolve(dir, file), 'utf8'));
    console.log(`applied ${file}`);
  }
} finally {
  await client.end();
}
