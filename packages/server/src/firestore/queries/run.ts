/**
 * Dispatch from a query key to its ported implementation, and the result handling pg does: rows
 * are fresh objects the caller may change, and pgTyped's `!` / `?` column hints are stripped.
 */
import { DbError } from '../errors.js';
import type { QueryDb } from '../query-db.js';
import { QUERIES } from './index.generated.js';

export type QueryShape = { params: unknown; result: unknown };

/** A ported query: the same parameters and result rows as the pgTyped query it replaces. */
export type QueryImpl<Q extends QueryShape> = (
  params: Q['params'],
  db: QueryDb,
) => Promise<readonly Q['result'][]>;

/** Declares a port; the type ties it to the pgTyped query's generated types. */
export const port = <Q extends QueryShape>(impl: QueryImpl<Q>): QueryImpl<Q> => impl;

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
  const rows = await entry.impl((params ?? {}) as never, db);
  return rows.map(row => structuredClone(row) as Record<string, unknown>);
}
