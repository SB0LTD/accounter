/**
 * `extended_business_trip_transactions`: a port of the view (see the schema dump / migrations for its
 * definition). Owned by the business-trips porting group.
 */
import type { QueryDb } from '../query-db.js';

export async function extendedBusinessTripTransactions(
  _db: QueryDb,
): Promise<readonly Record<string, unknown>[]> {
  throw new Error('Firestore store: view extended_business_trip_transactions is not ported yet');
}
