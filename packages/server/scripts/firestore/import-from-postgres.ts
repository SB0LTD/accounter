/**
 * Copies a Postgres Accounter database into a Firestore database, table by table, in the store's
 * layout (docs/firestore/design.md): tenant rows under `tenants/{owner}/{table}`, global rows in
 * top-level collections, document id = primary key, values encoded as the store reads them.
 *
 *   POSTGRES_HOST=localhost POSTGRES_PORT=54329 POSTGRES_DB=accounter_bootstrap \
 *   FIRESTORE_PROJECT_ID=sbzero FIRESTORE_DATABASE_ID=accounter \
 *     yarn workspace @accounter/server firestore:import [--tables a,b] [--dry-run] [--merge]
 *
 * Needs Application Default Credentials that may write the Firestore database.
 *
 * - Refuses to write a collection that already has documents, unless --merge (then documents with the
 *   same id are overwritten and others are left alone).
 * - The source is read as the database owner (no RLS), so every tenant is copied.
 * - Writes go in batches of 450; a failure stops the import and reports how far it got.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import pg from 'pg';
import { collectionPath } from '../../src/firestore/backend.js';
import { allTables } from '../../src/firestore/catalog.js';
import { docIdFor, encodeRow } from '../../src/firestore/values.js';
import { pgTypeParsers } from '../../src/shared/helpers/pg-type-parsers.js';

process.env.TZ = 'UTC';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => (flag(name) ? args[args.indexOf(name) + 1] : undefined);
const dryRun = flag('--dry-run');
const merge = flag('--merge');
const onlyTables = option('--tables')?.split(',').filter(Boolean) ?? null;

const projectId = process.env.FIRESTORE_PROJECT_ID;
const databaseId = process.env.FIRESTORE_DATABASE_ID ?? 'accounter';
if (!projectId) {
  console.error('Set FIRESTORE_PROJECT_ID (and FIRESTORE_DATABASE_ID, default accounter)');
  process.exit(2);
}

const client = new pg.Client({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? 'accounter',
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  ssl: process.env.POSTGRES_SSL === '1' ? { rejectUnauthorized: false } : undefined,
  types: pgTypeParsers,
});

const db = getFirestore(initializeApp({ projectId }), databaseId);

async function main() {
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");
  let total = 0;
  try {
    for (const table of allTables()) {
      if (onlyTables && !onlyTables.includes(table.name)) continue;
      const { rows } = await client.query(`SELECT * FROM accounter_schema.${table.name}`);
      if (rows.length === 0) continue;

      const byPartition = new Map<string, { docId: string; data: Record<string, unknown> }[]>();
      for (const row of rows) {
        const partition = table.tenancy === 'owner' ? String(row[table.ownerColumn!]) : '';
        const list = byPartition.get(partition) ?? [];
        list.push({ docId: docIdFor(table, row), data: encodeRow(table, row) });
        byPartition.set(partition, list);
      }

      for (const [partition, docs] of byPartition) {
        const path = collectionPath({ partition, table: table.name });
        const collection = db.collection(path);
        if (!merge && !dryRun) {
          const existing = await collection.limit(1).get();
          if (!existing.empty) {
            throw new Error(`${path} already has documents; use --merge to overwrite by id`);
          }
        }
        console.log(`${dryRun ? '[dry run] ' : ''}${path}: ${docs.length} documents`);
        if (dryRun) continue;
        for (let start = 0; start < docs.length; start += 450) {
          const batch = db.batch();
          for (const doc of docs.slice(start, start + 450)) {
            batch.set(collection.doc(doc.docId), doc.data);
          }
          await batch.commit();
          total += Math.min(450, docs.length - start);
        }
      }
    }
  } finally {
    await client.end();
  }
  console.log(
    `${dryRun ? '[dry run] ' : ''}imported ${total} documents into ${projectId}/${databaseId}`,
  );
}

await main();
