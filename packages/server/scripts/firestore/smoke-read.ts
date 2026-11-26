/**
 * Reads a few global tables back from a Firestore Accounter database through the store (the same
 * path the API uses), as a smoke test after an import.
 *
 *   FIRESTORE_PROJECT_ID=sbzero FIRESTORE_DATABASE_ID=accounter yarn workspace @accounter/server tsx scripts/firestore/smoke-read.ts
 */
import { firestoreStore } from '../../src/firestore/store.js';

const store = firestoreStore({
  projectId: process.env.FIRESTORE_PROJECT_ID,
  databaseId: process.env.FIRESTORE_DATABASE_ID ?? 'accounter',
});
const tx = store.begin(() => ({ businessId: null, scope: [], userId: null, authType: null }));
for (const table of ['countries', 'vat_value', 'roles', 'permissions', 'role_permissions']) {
  const rows = await tx.rows(table);
  console.log(`${table}: ${rows.length}`, JSON.stringify(rows[0]));
}
tx.rollback();
store.close();
process.exit(0);
