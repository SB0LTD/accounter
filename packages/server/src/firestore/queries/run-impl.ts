import type { QueryDb } from '../query-db.js';
import type { QueryImpl, QueryShape } from './port.js';

/** Runs a port and hands back fresh rows, as pg does (callers may change them). */
export async function runImpl(
  impl: QueryImpl<QueryShape>,
  params: unknown,
  db: QueryDb,
): Promise<Record<string, unknown>[]> {
  const rows = await impl((params ?? {}) as never, db);
  return rows.map(row => structuredClone(row) as Record<string, unknown>);
}
