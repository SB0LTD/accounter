/**
 * Dispatch from a query key to its ported implementation, and the result handling pg does: rows
 * are fresh objects the caller may change.
 */
import { DbError } from '../errors.js';
import type { QueryDb } from '../query-db.js';
import { QUERIES } from './index.generated.js';
import { runImpl } from './run-impl.js';

export type { QueryImpl, QueryShape } from './port.js';
export { runImpl } from './run-impl.js';

export async function runPortedQuery(
  key: string,
  params: unknown,
  db: QueryDb,
  text: string,
): Promise<Record<string, unknown>[]> {
  const entry = QUERIES[key];
  if (!entry) {
    throw new DbError(
      `Firestore store: query ${key} is not in the query index (re-run firestore:queries): ${text.slice(0, 200)}`,
      '0A000',
    );
  }
  if (!entry.impl) {
    throw new DbError(`Firestore store: query ${entry.source} is not ported yet`, '0A000');
  }
  return runImpl(entry.impl, params, db);
}
