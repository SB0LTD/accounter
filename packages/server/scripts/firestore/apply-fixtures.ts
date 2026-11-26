/**
 * Applies fixtures.sql to the local verification database. Refuses any host but localhost.
 *
 *   POSTGRES_HOST=localhost POSTGRES_PORT=54329 POSTGRES_DB=accounter_demo \
 *     yarn workspace @accounter/server firestore:fixtures
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const host = process.env.POSTGRES_HOST ?? 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`firestore:fixtures only runs against a local database (POSTGRES_HOST=${host})`);
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const client = new pg.Client({
  host,
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? 'accounter_demo',
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
});
await client.connect();
try {
  await client.query(readFileSync(resolve(here, 'fixtures.sql'), 'utf8'));
  console.log('fixtures applied');
} finally {
  await client.end();
}
