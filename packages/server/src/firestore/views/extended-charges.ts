/**
 * `extended_charges`: a port of the view (see the schema dump / migrations for its definition).
 * Owned by the charges/ledger porting group.
 */
import type { QueryDb } from '../query-db.js';

export async function extendedCharges(_db: QueryDb): Promise<readonly Record<string, unknown>[]> {
  throw new Error('Firestore store: view extended_charges is not ported yet');
}
