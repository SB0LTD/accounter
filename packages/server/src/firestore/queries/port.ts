/**
 * How a ported query is declared. Kept free of imports from the query index, so port files can
 * import it without a cycle.
 */
import type { QueryDb } from '../query-db.js';

export type QueryShape = { params: unknown; result: unknown };

/** A ported query: the same parameters and result rows as the pgTyped query it replaces. */
export type QueryImpl<Q extends QueryShape> = (
  params: Q['params'],
  db: QueryDb,
) => Promise<readonly Q['result'][]>;

/** Declares a port; the type ties it to the pgTyped query's generated types. */
export const port = <Q extends QueryShape>(impl: QueryImpl<Q>): QueryImpl<Q> => impl;
