/**
 * Registers a super-admin in a Firestore Accounter database: the person (by email) must have signed
 * in to the app once, so their Firebase account exists. The app itself cannot do this (super_admins
 * is read-only for it, as in Postgres); this is the "direct DBA connection" of
 * docs/super-user/super-admin-runbook.md.
 *
 *   FIREBASE_AUTH_PROJECT_ID=sbzero FIRESTORE_PROJECT_ID=sbzero FIRESTORE_DATABASE_ID=accounter \
 *     yarn workspace @accounter/server firestore:add-super-admin --email asaf@sb0.tech [--note "..."]
 *
 * Needs Application Default Credentials allowed to read Firebase Authentication users and write the
 * database. Idempotent.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { collectionPath } from '../../src/firestore/backend.js';
import { tableInfo } from '../../src/firestore/catalog.js';
import { docIdFor, encodeRow } from '../../src/firestore/values.js';

const args = process.argv.slice(2);
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const email = option('--email');
const note = option('--note') ?? 'super-admin';

const authProject = process.env.FIREBASE_AUTH_PROJECT_ID;
const firestoreProject = process.env.FIRESTORE_PROJECT_ID ?? authProject;
const databaseId = process.env.FIRESTORE_DATABASE_ID ?? 'accounter';
if (!email || !authProject || !firestoreProject) {
  console.error(
    'Usage: FIREBASE_AUTH_PROJECT_ID=... FIRESTORE_PROJECT_ID=... firestore:add-super-admin --email <email>',
  );
  process.exit(2);
}

const app = initializeApp({ projectId: firestoreProject });
const auth = getAuth(
  authProject === firestoreProject ? app : initializeApp({ projectId: authProject }, 'auth'),
);
let uid: string;
try {
  uid = (await auth.getUserByEmail(email)).uid;
} catch (error) {
  if ((error as { code?: string }).code === 'auth/user-not-found') {
    console.error(
      `${email} has no account in ${authProject} yet: they must sign in to the app once.`,
    );
    process.exit(1);
  }
  throw error;
}

const table = tableInfo('super_admins');
const row = { auth0_user_id: uid, created_at: Timestamp.now().toDate(), note };
const ref = getFirestore(app, databaseId)
  .collection(collectionPath({ partition: '', table: table.name }))
  .doc(docIdFor(table, row));
const existing = await ref.get();
if (existing.exists) {
  console.log(`${email} (${uid}) is already a super-admin`);
} else {
  await ref.create(encodeRow(table, row));
  console.log(`${email} (${uid}) is now a super-admin of ${firestoreProject}/${databaseId}`);
}
