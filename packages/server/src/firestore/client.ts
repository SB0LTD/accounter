/**
 * A `pg` Pool / PoolClient look-alike over the Firestore store.
 *
 * The server's database code (TenantAwareDBClient, withTenantContext, the jobs) drives a pg pool:
 * BEGIN, `set_config('app.current_business_id', ...)`, queries, COMMIT. This class speaks that
 * protocol, so none of it changes:
 *
 * - BEGIN / COMMIT / ROLLBACK / SAVEPOINT open, end and mark a store Transaction;
 * - `set_config('app.*', ...)` sets the tenant context the store enforces in place of RLS;
 * - a pgTyped query (see sql.ts) runs its ported TypeScript implementation;
 * - a handful of raw statements run their ports (raw/index.ts);
 * - anything else fails loudly, naming the statement.
 *
 * Outside BEGIN each statement is its own transaction, as in Postgres's autocommit. A failed
 * statement inside a transaction aborts it (25P02) until ROLLBACK or ROLLBACK TO SAVEPOINT.
 */
import { EventEmitter } from 'node:events';
import { DbError, unportedSql } from './errors.js';
import { runPortedQuery } from './queries/run.js';
import { queryDb, type QueryDb } from './query-db.js';
import { findRawStatement } from './raw/index.js';
import { takePendingCall } from './sql.js';
import type { Store } from './store.js';
import type { SessionContext, Transaction } from './transaction.js';

export interface QueryResultLike<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  command: string;
  fields: [];
  oid: number;
}

const result = <T>(rows: T[], command = 'SELECT'): QueryResultLike<T> => ({
  rows,
  rowCount: rows.length,
  command,
  fields: [],
  oid: 0,
});

const CONTROL =
  /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK\s+TO\s+SAVEPOINT\s+(\w+)|ROLLBACK|SAVEPOINT\s+(\w+)|RELEASE\s+SAVEPOINT\s+(\w+))\s*;?\s*$/i;

const SET_CONFIG = /set_config\(\s*'([^']+)'\s*,\s*(?:\$(\d+)|'([^']*)')\s*,\s*(true|false)\s*\)/gi;

function parseScope(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map(part => part.trim().replace(/^"|"$/g, '').replaceAll('\\"', '"'))
    .filter(Boolean);
}

export class FirestoreClient extends EventEmitter {
  private tx: Transaction | null = null;
  private aborted = false;
  private readonly localVars = new Map<string, string>();
  private readonly sessionVars = new Map<string, string>();

  constructor(
    private readonly store: Store,
    private readonly onRelease: (client: FirestoreClient) => void,
  ) {
    super();
  }

  /** The tenant context of the current statement, from the `app.*` settings. */
  context(): SessionContext {
    const read = (name: string) => {
      const value = this.localVars.has(name)
        ? this.localVars.get(name)
        : this.sessionVars.get(name);
      return value === undefined || value === '' ? null : value;
    };
    const businessId = read('app.current_business_id');
    const scope = parseScope(read('app.current_business_scope') ?? undefined);
    return {
      businessId,
      scope: scope.length ? scope : businessId ? [businessId] : [],
      userId: read('app.current_user_id'),
      authType: read('app.auth_type'),
    };
  }

  async query(
    textOrConfig: string | { text: string; values?: unknown[] },
    maybeValues?: unknown[],
  ): Promise<QueryResultLike> {
    const text = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
    const values =
      typeof textOrConfig === 'string' ? maybeValues : (textOrConfig.values ?? maybeValues);

    const control = CONTROL.exec(text);
    if (control) return this.control(control);

    if (/\bset_config\s*\(/i.test(text)) return this.setConfig(text, values ?? []);

    if (/^\s*SELECT\s+1\s+(AS\s+)?health\s*;?\s*$/i.test(text)) return result([{ health: 1 }]);

    const call = takePendingCall(text, values);
    if (call) {
      return this.statement(async db =>
        result(await runPortedQuery(call.key, call.params, db, text)),
      );
    }

    const raw = findRawStatement(text);
    if (raw)
      return this.statement(async db => result(await raw.run(values ?? [], db), raw.command));

    throw unportedSql(text);
  }

  private control(match: RegExpExecArray): QueryResultLike {
    const word = match[1]!.toUpperCase().replace(/\s+/g, ' ');
    if (word === 'BEGIN' || word === 'START TRANSACTION') {
      if (!this.tx) {
        this.tx = this.store.begin(() => this.context());
        this.aborted = false;
      }
      return result([], 'BEGIN');
    }
    if (word.startsWith('ROLLBACK TO SAVEPOINT')) {
      this.requireTx().rollbackTo(match[2]!);
      this.aborted = false;
      return result([], 'ROLLBACK');
    }
    if (word.startsWith('SAVEPOINT')) {
      this.assertNotAborted();
      this.requireTx().savepoint(match[3]!);
      return result([], 'SAVEPOINT');
    }
    if (word.startsWith('RELEASE SAVEPOINT')) {
      this.assertNotAborted();
      this.requireTx().release(match[4]!);
      return result([], 'RELEASE');
    }
    // COMMIT / END / ROLLBACK end the transaction; the commit itself is async, so hand it back.
    return this.endTransaction(word === 'ROLLBACK' || this.aborted) as unknown as QueryResultLike;
  }

  private async endTransaction(rollback: boolean): Promise<QueryResultLike> {
    const tx = this.tx;
    this.tx = null;
    this.aborted = false;
    this.localVars.clear();
    if (!tx) return result([], rollback ? 'ROLLBACK' : 'COMMIT');
    if (rollback) {
      tx.rollback();
      return result([], 'ROLLBACK');
    }
    await tx.commit();
    return result([], 'COMMIT');
  }

  private setConfig(text: string, values: unknown[]): QueryResultLike {
    this.assertNotAborted();
    const row: Record<string, unknown> = {};
    for (const match of text.matchAll(SET_CONFIG)) {
      const [, name, param, literal, isLocal] = match;
      const value = param ? values[Number(param) - 1] : literal;
      const text = value == null ? '' : String(value);
      if (isLocal!.toLowerCase() === 'true' && this.tx) this.localVars.set(name!, text);
      else if (isLocal!.toLowerCase() === 'true') {
        // set_config(..., true) outside a transaction lasts for that statement only.
      } else this.sessionVars.set(name!, text);
      row['set_config'] = text;
    }
    return result([row]);
  }

  private requireTx(): Transaction {
    if (!this.tx) {
      throw new DbError('SAVEPOINT can only be used in transaction blocks', '25P01');
    }
    return this.tx;
  }

  private assertNotAborted() {
    if (this.aborted) {
      throw new DbError(
        'current transaction is aborted, commands ignored until end of transaction block',
        '25P02',
      );
    }
  }

  private async statement(
    work: (db: QueryDb) => Promise<QueryResultLike>,
  ): Promise<QueryResultLike> {
    if (this.tx) {
      this.assertNotAborted();
      try {
        return await work(queryDb(this.tx));
      } catch (error) {
        this.aborted = true;
        throw error;
      }
    }
    const tx = this.store.begin(() => this.context());
    try {
      const output = await work(queryDb(tx));
      await tx.commit();
      return output;
    } catch (error) {
      tx.rollback();
      throw error;
    }
  }

  release(_error?: Error | boolean) {
    if (this.tx) {
      this.tx.rollback();
      this.tx = null;
    }
    this.aborted = false;
    this.localVars.clear();
    this.sessionVars.clear();
    this.onRelease(this);
  }
}

/** A pg.Pool look-alike. Connections are free, so `connect()` never waits. */
export class FirestorePool extends EventEmitter {
  private checkedOut = new Set<FirestoreClient>();
  readonly options = { max: Number.POSITIVE_INFINITY };

  constructor(readonly store: Store) {
    super();
  }

  get totalCount() {
    return this.checkedOut.size;
  }

  get idleCount() {
    return 0;
  }

  get waitingCount() {
    return 0;
  }

  async connect(): Promise<FirestoreClient> {
    const client = new FirestoreClient(this.store, c => this.checkedOut.delete(c));
    this.checkedOut.add(client);
    return client;
  }

  /** `pool.query(...)`: one statement on a client of its own. */
  async query(textOrConfig: string | { text: string; values?: unknown[] }, values?: unknown[]) {
    const client = await this.connect();
    try {
      return await client.query(textOrConfig, values);
    } finally {
      client.release();
    }
  }

  async end() {
    this.store.close();
  }
}
