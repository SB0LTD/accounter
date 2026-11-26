/**
 * The `sql` tag the providers use, in place of `@pgtyped/runtime`'s.
 *
 * On Postgres it is pgTyped's tag, unchanged. On Firestore (`ACCOUNTER_DB_ENGINE=firestore`),
 * `.run(params, connection)` still goes through `connection.query(...)`, so the request's
 * TenantAwareDBClient keeps managing the session, but the statement text carries the query's key
 * and the bound parameters travel by reference to the Firestore client, which runs the ported
 * TypeScript implementation registered under that key (see queries/registry.ts).
 */
import { createHash } from 'node:crypto';
import { sql as pgTypedSql, TaggedQuery } from '@pgtyped/runtime';

export { TaggedQuery };
export type { IDatabaseConnection } from '@pgtyped/runtime';

export const firestoreEngine = (): boolean => process.env['ACCOUNTER_DB_ENGINE'] === 'firestore';

/** Stable key of a query: a hash of its SQL with whitespace collapsed. */
export function queryKey(text: string): string {
  return createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 20);
}

const MARKER = /^\/\*fsq:([0-9a-f]{20})\*\//;

export interface PendingCall {
  key: string;
  params: unknown;
}

const pending = new WeakMap<object, PendingCall>();

/** The ported-query call a statement carries, if it is one. */
export function takePendingCall(text: string, values: unknown): PendingCall | null {
  const match = MARKER.exec(text);
  if (!match) return null;
  const call = values && typeof values === 'object' ? pending.get(values) : undefined;
  if (!call || call.key !== match[1]) {
    throw new Error(`Firestore store: lost parameters for query ${match[1]}`);
  }
  return call;
}

type QueryShape = { params: unknown; result: unknown };

export function sql<T extends QueryShape>(strings: TemplateStringsArray): TaggedQuery<T> {
  const tagged = pgTypedSql<T>(strings);
  if (!firestoreEngine()) return tagged;
  const text = strings[0]!;
  const key = queryKey(text);
  const statement = `/*fsq:${key}*/ ${text}`;
  tagged.run = async (params, connection) => {
    // An array, because pg-shaped clients pass `values` through as given; its identity carries
    // the named parameters to the Firestore client.
    const values: unknown[] = [];
    pending.set(values, { key, params });
    const result = await connection.query(statement, values);
    return result.rows as T['result'][];
  };
  return tagged;
}
