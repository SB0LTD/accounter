/**
 * What a ported query sees: typed tables of the request's tenants, plus INSERT / UPDATE / DELETE with
 * Postgres's constraint, default, trigger and RLS behaviour (see transaction.ts).
 *
 * Rows handed out are frozen and shared with the replica. Build new objects for results; never
 * mutate a row.
 */
import type { AnyRow, Row, TableName } from './catalog.js';
import type { ConflictOptions, SessionContext, Transaction } from './transaction.js';
import { equalityKey, type StoredRow } from './values.js';
import { viewsFor, type Views } from './views/index.js';

export interface QueryDb {
  readonly ctx: SessionContext & { now: Date };
  /** Every row of the table the request may read (RLS `USING`). */
  rows<T extends TableName>(table: T): Promise<readonly Row<T>[]>;
  /** Rows whose columns equal the values (`WHERE a = $1 AND b = $2`), index-backed. */
  where<T extends TableName>(
    table: T,
    match: Partial<{ [K in keyof Row<T>]: Row<T>[K] }>,
  ): Promise<readonly Row<T>[]>;
  /** Rows whose column is one of the values (`WHERE col IN (...)`), index-backed. */
  whereIn<T extends TableName, K extends keyof Row<T> & string>(
    table: T,
    column: K,
    values: readonly unknown[],
  ): Promise<readonly Row<T>[]>;
  insert<T extends TableName>(
    table: T,
    values: Partial<Row<T>>,
    onConflict?: ConflictOptions,
  ): Promise<Row<T> | null>;
  update<T extends TableName>(table: T, row: Row<T>, patch: Partial<Row<T>>): Promise<Row<T>>;
  delete<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>;
  /** The schema's views (`extended_charges`, ...). */
  readonly views: Views;
  /** The underlying transaction, for triggers and raw handlers. */
  readonly tx: Transaction;
  /**
   * `set_config(name, value, is_local)` on the request's session (e.g. `app.current_business_id`),
   * for ports of queries that call it. Returns the value as set_config does ('' for NULL).
   */
  setConfig(name: string, value: unknown, isLocal: boolean): string;
}

/** The session a port runs in: the Firestore client that sent the statement. */
export interface QuerySession {
  setConfig(name: string, value: unknown, isLocal: boolean): string;
}

const NO_SESSION: QuerySession = {
  setConfig: () => {
    throw new Error(
      'Firestore store: set_config needs a client session (run through FirestoreClient)',
    );
  },
};

export function queryDb(tx: Transaction, session: QuerySession = NO_SESSION): QueryDb {
  const db: QueryDb = {
    get ctx() {
      return { ...tx.ctx, now: tx.time };
    },
    rows: table => tx.rows(table) as never,
    where: async (table, match) => {
      const columns = Object.keys(match).filter(k => (match as AnyRow)[k] !== undefined);
      if (columns.length === 0) return tx.rows(table) as never;
      return tx.lookup(
        table,
        columns,
        columns.map(c => (match as AnyRow)[c]),
      ) as never;
    },
    whereIn: async (table, column, values) => {
      // Each row has one value in the column, so distinct values never return a row twice.
      const distinct = new Map<string, unknown>();
      for (const value of values) {
        const key = equalityKey(value);
        if (key !== null) distinct.set(key, value);
      }
      const result: StoredRow[] = [];
      for (const value of distinct.values()) {
        result.push(...(await tx.lookup(table, [column], [value])));
      }
      return result as never;
    },
    insert: (table, values, onConflict) =>
      tx.insert(table, values as AnyRow, { onConflict }) as never,
    update: (table, row, patch) =>
      tx.update(table, row as unknown as StoredRow, patch as AnyRow) as never,
    delete: (table, row) => tx.delete(table, row as unknown as StoredRow) as never,
    get views() {
      return viewsFor(db);
    },
    tx,
    setConfig: (name, value, isLocal) => session.setConfig(name, value, isLocal),
  };
  return db;
}
