/**
 * A unit of work over the replica: what one Postgres transaction did.
 *
 * Writes go to per-table change sets that reads see through (read-your-writes). Constraints are
 * checked statement by statement, as Postgres checks non-deferred constraints. Commit turns the
 * change sets into one Firestore write (preconditioned on the versions the transaction read) and
 * applies the result to the replica.
 */
import type { Timestamp } from 'firebase-admin/firestore';
import type { WriteOp } from './backend.js';
import { tableInfo, type AnyRow, type TableInfo } from './catalog.js';
import { runChecks } from './constraints/checks.js';
import { customUniques, type UniqueRule } from './constraints/uniques.js';
import {
  checkViolation,
  DbError,
  foreignKeyStillReferenced,
  foreignKeyViolation,
  notNullViolation,
  rlsViolation,
  uniqueViolation,
} from './errors.js';
import { columnsKeyFn, type KeyFn, type TableData } from './replica.js';
import type { Store } from './store.js';
import {
  coerceValue,
  defaultValue,
  DOC_ID,
  docIdFor,
  encodeRow,
  sealRow,
  UPDATE_TIME,
  type StoredRow,
} from './values.js';

export interface SessionContext {
  /** `app.current_business_id`: where writes go. */
  businessId: string | null;
  /** `app.current_business_scope`: which tenants reads see (defaults to the business). */
  scope: readonly string[];
  userId: string | null;
  authType: string | null;
}

interface IndexState {
  keyFn: KeyFn;
  map: Map<string, Set<string>>;
}

/** The changes a transaction made to one (partition, table). */
class TableChanges {
  /** Current state of each touched document; null = deleted. */
  readonly current = new Map<string, StoredRow | null>();
  /** State of each touched document when the transaction first touched it. */
  readonly before = new Map<string, StoredRow | null>();
  version = 0;
  private indexes = new Map<string, IndexState>();

  constructor(readonly data: TableData) {}

  set(docId: string, row: StoredRow | null) {
    if (!this.before.has(docId)) this.before.set(docId, this.data.rows.get(docId) ?? null);
    const previous = this.current.has(docId) ? this.current.get(docId)! : null;
    for (const state of this.indexes.values()) {
      if (previous) remove(state.map, state.keyFn(previous), docId);
      if (row) add(state.map, state.keyFn(row), docId);
    }
    this.current.set(docId, row);
    this.version++;
  }

  /** Restores a document to the state an undo entry recorded. */
  restore(docId: string, previous: StoredRow | null | undefined) {
    const now = this.current.has(docId) ? this.current.get(docId)! : null;
    for (const state of this.indexes.values()) {
      if (now) remove(state.map, state.keyFn(now), docId);
      if (previous) add(state.map, state.keyFn(previous), docId);
    }
    if (previous === undefined) {
      this.current.delete(docId);
      this.before.delete(docId);
    } else this.current.set(docId, previous);
    this.version++;
  }

  index(name: string, keyFn: KeyFn): Map<string, Set<string>> {
    let state = this.indexes.get(name);
    if (!state) {
      const map = new Map<string, Set<string>>();
      for (const [docId, row] of this.current) if (row) add(map, keyFn(row), docId);
      state = { keyFn, map };
      this.indexes.set(name, state);
    }
    return state.map;
  }
}

function add(map: Map<string, Set<string>>, key: string | null, docId: string) {
  if (key === null) return;
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  set.add(docId);
}

function remove(map: Map<string, Set<string>>, key: string | null, docId: string) {
  if (key === null) return;
  const set = map.get(key);
  set?.delete(docId);
  if (set && set.size === 0) map.delete(key);
}

/** One partition of one table as the transaction sees it. */
export class TableView {
  private memo: { dataVersion: number; changesVersion: number; rows: StoredRow[] } | null = null;

  constructor(
    readonly data: TableData,
    readonly changes: TableChanges | null,
  ) {}

  get info(): TableInfo {
    return this.data.info;
  }

  get(docId: string): StoredRow | undefined {
    if (this.changes?.current.has(docId)) return this.changes.current.get(docId) ?? undefined;
    return this.data.rows.get(docId);
  }

  all(): StoredRow[] {
    const changesVersion = this.changes?.version ?? -1;
    if (
      this.memo &&
      this.memo.dataVersion === this.data.version &&
      this.memo.changesVersion === changesVersion
    ) {
      return this.memo.rows;
    }
    const rows: StoredRow[] = [];
    const changed = this.changes?.current;
    for (const [docId, row] of this.data.rows) if (!changed?.has(docId)) rows.push(row);
    if (changed) for (const row of changed.values()) if (row) rows.push(row);
    this.memo = { dataVersion: this.data.version, changesVersion, rows };
    return rows;
  }

  /** Rows whose key under `keyFn` equals `key`. */
  lookup(name: string, keyFn: KeyFn, key: string): StoredRow[] {
    const result: StoredRow[] = [];
    const changed = this.changes?.current;
    for (const docId of this.data.index(name, keyFn).get(key) ?? []) {
      if (changed?.has(docId)) continue;
      const row = this.data.rows.get(docId);
      if (row) result.push(row);
    }
    if (this.changes) {
      for (const docId of this.changes.index(name, keyFn).get(key) ?? []) {
        const row = this.changes.current.get(docId);
        if (row) result.push(row);
      }
    }
    return result;
  }
}

export interface ConflictOptions {
  /** Constraint columns (`ON CONFLICT (a, b)`) or a constraint name (`ON CONSTRAINT x`); omit for any. */
  target?: string[] | { constraint: string };
  /** `DO NOTHING`, or `DO UPDATE SET ...` computed from the existing row and the proposed one. */
  action: 'nothing' | ((existing: StoredRow, excluded: StoredRow) => AnyRow);
}

interface UndoEntry {
  changes: TableChanges;
  docId: string;
  previous: StoredRow | null | undefined;
}

/** pg's uniqueness constraints of a table: primary key, unique constraints and custom indexes. */
function uniqueRules(info: TableInfo): UniqueRule[] {
  const rules: UniqueRule[] = [];
  if (info.primaryKey) {
    rules.push({
      name: `${info.name}_pkey`,
      columns: info.primaryKey,
      keyFn: columnsKeyFn(info, info.primaryKey),
    });
  }
  for (const unique of info.uniques) {
    if (unique.custom) continue;
    rules.push({
      name: unique.name,
      columns: unique.columns,
      keyFn: columnsKeyFn(info, unique.columns, unique.nullsNotDistinct),
    });
  }
  rules.push(...customUniques(info));
  return rules;
}

/**
 * Tables with an `allow_bootstrap_root` policy, and the commands it permits: a business may write its
 * own root row (`id = current_business_id`) before it owns itself.
 * financial_entities: every command; businesses: INSERT only.
 */
const BOOTSTRAP_ROOT: Record<string, readonly ('insert' | 'update')[]> = {
  financial_entities: ['insert', 'update'],
  businesses: ['insert'],
};

const rulesCache = new Map<string, UniqueRule[]>();
function rulesFor(info: TableInfo): UniqueRule[] {
  let rules = rulesCache.get(info.name);
  if (!rules) rulesCache.set(info.name, (rules = uniqueRules(info)));
  return rules;
}

export class Transaction {
  /** `now()`: fixed for the whole transaction, as in Postgres. */
  readonly time = new Date();
  private touched = new Map<string, TableChanges>();
  private undo: UndoEntry[] = [];
  private savepoints: { name: string; mark: number }[] = [];
  private finished = false;

  constructor(
    readonly store: Store,
    private readonly context: () => SessionContext,
  ) {}

  get ctx(): SessionContext {
    return this.context();
  }

  // -------------------------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------------------------

  /** Partitions a request reads for a table (RLS `USING`). */
  readPartitions(info: TableInfo): string[] {
    if (info.tenancy === 'global') return [''];
    const { businessId, scope } = this.ctx;
    if (info.readScope === 'current') return businessId ? [businessId] : [];
    return [...new Set(scope.length ? scope : businessId ? [businessId] : [])];
  }

  async view(table: string, partition: string): Promise<TableView> {
    const info = tableInfo(table);
    const effective = info.tenancy === 'owner' ? partition : '';
    const data = await this.store.replica.table(effective, table);
    return new TableView(data, this.touched.get(`${effective}/${table}`) ?? null);
  }

  /** Every row of a table the request may read, with this transaction's changes applied. */
  async rows(table: string): Promise<StoredRow[]> {
    const info = tableInfo(table);
    const partitions = this.readPartitions(info);
    const views = await Promise.all(partitions.map(p => this.view(table, p)));
    let rows = views.length === 1 ? views[0]!.all() : views.flatMap(v => v.all());
    if (info.tenancy === 'global' && info.readScope === 'current' && info.writeGuard) {
      const guard = info.writeGuard;
      const businessId = this.ctx.businessId;
      rows = rows.filter(row => businessId !== null && row[guard] === businessId);
    }
    return rows;
  }

  /** Rows of a table whose columns equal the given values (index-backed). */
  async lookup(table: string, columns: string[], values: unknown[]): Promise<StoredRow[]> {
    const info = tableInfo(table);
    const keyFn = columnsKeyFn(info, columns);
    const key = keyFn(Object.fromEntries(columns.map((c, i) => [c, values[i]])) as StoredRow);
    if (key === null) return [];
    const name = `cols:${columns.join(',')}`;
    const views = await Promise.all(this.readPartitions(info).map(p => this.view(table, p)));
    let rows = views.flatMap(v => v.lookup(name, keyFn, key));
    if (info.tenancy === 'global' && info.readScope === 'current' && info.writeGuard) {
      const guard = info.writeGuard;
      rows = rows.filter(row => row[guard] === this.ctx.businessId);
    }
    return rows;
  }

  // -------------------------------------------------------------------------------------------
  // Writing
  // -------------------------------------------------------------------------------------------

  private changesFor(data: TableData): TableChanges {
    const key = `${data.partition}/${data.info.name}`;
    let changes = this.touched.get(key);
    if (!changes) this.touched.set(key, (changes = new TableChanges(data)));
    return changes;
  }

  private record(changes: TableChanges, docId: string, row: StoredRow | null) {
    this.undo.push({
      changes,
      docId,
      previous: changes.current.has(docId) ? changes.current.get(docId)! : undefined,
    });
    changes.set(docId, row);
  }

  private partitionOf(info: TableInfo, row: AnyRow): string {
    if (info.tenancy === 'global') return '';
    const owner = row[info.ownerColumn!];
    if (typeof owner === 'string' && owner) return owner;
    // A business's own root row is written before it owns itself (`allow_bootstrap_root`): it lives
    // in the business's own partition, where it stays once `owner_id = id` is set.
    if (BOOTSTRAP_ROOT[info.name] && typeof row.id === 'string' && row.id) return row.id;
    throw rlsViolation(info.name);
  }

  /** RLS `WITH CHECK`: the new row must belong to the current business. */
  private checkWrite(info: TableInfo, row: AnyRow, bypass: boolean, command: 'insert' | 'update') {
    if (bypass) return;
    const { businessId } = this.ctx;
    if (info.tenancy === 'owner') {
      if (!businessId) throw rlsViolation(info.name);
      if (row[info.ownerColumn!] === businessId) return;
      // `allow_bootstrap_root`: a business may write its own root row whoever owns it.
      if (BOOTSTRAP_ROOT[info.name]?.includes(command) && row.id === businessId) return;
      throw rlsViolation(info.name);
    } else if (info.writeGuard === 'readonly') {
      throw rlsViolation(info.name);
    } else if (info.writeGuard) {
      if (!businessId || row[info.writeGuard] !== businessId) throw rlsViolation(info.name);
    }
  }

  private buildRow(info: TableInfo, values: AnyRow, base: AnyRow | null): StoredRow {
    const row: AnyRow = {};
    for (const column of info.columns) {
      if (
        Object.prototype.hasOwnProperty.call(values, column.name) &&
        values[column.name] !== undefined
      ) {
        row[column.name] = coerceValue(values[column.name], column, info.name);
      } else if (base) {
        row[column.name] = base[column.name];
      } else {
        row[column.name] = defaultValue(column, { transactionTime: this.time });
      }
    }
    for (const key of Object.keys(values)) {
      if (!info.columnByName.has(key) && values[key] !== undefined) {
        throw new DbError(`column "${key}" of relation "${info.name}" does not exist`, '42703');
      }
    }
    return row;
  }

  private validate(info: TableInfo, row: AnyRow) {
    for (const column of info.columns) {
      if (column.notNull && row[column.name] == null)
        throw notNullViolation(info.name, column.name);
    }
    const failed = runChecks(info.name, row);
    if (failed) throw checkViolation(info.name, failed);
  }

  /** Partitions to search for rows that conflict with, or reference, a row in `partition`. */
  private searchPartitions(info: TableInfo, partition: string): string[] {
    if (info.tenancy === 'global') return [''];
    return [...new Set([partition, ...this.store.replica.loadedPartitions(info.name)])];
  }

  private async findConflict(
    info: TableInfo,
    row: StoredRow,
    partition: string,
    selfDocId: string | null,
    only?: (rule: UniqueRule) => boolean,
  ): Promise<{ rule: UniqueRule; existing: StoredRow } | null> {
    for (const rule of rulesFor(info)) {
      if (only && !only(rule)) continue;
      const key = rule.keyFn(row);
      if (key === null) continue;
      for (const p of this.searchPartitions(info, partition)) {
        const view = await this.view(info.name, p);
        const hit = view
          .lookup(`u:${rule.name}`, rule.keyFn, key)
          .find(r => r[DOC_ID] !== selfDocId);
        if (hit) return { rule, existing: hit };
      }
    }
    return null;
  }

  private async checkParents(
    info: TableInfo,
    row: AnyRow,
    partition: string,
    previous: AnyRow | null,
  ) {
    for (const fk of info.foreignKeys) {
      const values = fk.columns.map(c => row[c]);
      if (values.some(v => v == null)) continue;
      if (previous && fk.columns.every(c => previous[c] === row[c])) continue;
      const parent = tableInfo(fk.refTable);
      const keyFn = columnsKeyFn(parent, fk.refColumns);
      const key = keyFn(
        Object.fromEntries(fk.refColumns.map((c, i) => [c, values[i]])) as StoredRow,
      );
      const candidates =
        parent.tenancy === 'global'
          ? ['']
          : [
              ...new Set([
                ...(info.tenancy === 'owner' ? [partition] : []),
                ...(this.ctx.businessId ? [this.ctx.businessId] : []),
                ...this.ctx.scope,
                ...(info.tenancy === 'global'
                  ? this.store.replica.loadedPartitions(parent.name)
                  : []),
              ]),
            ];
      let found = false;
      for (const p of candidates) {
        const view = await this.view(parent.name, p);
        if (view.lookup(`cols:${fk.refColumns.join(',')}`, keyFn, key!).length > 0) {
          found = true;
          break;
        }
      }
      if (!found) {
        throw foreignKeyViolation(
          info.name,
          fk.name,
          `Key (${fk.columns.join(', ')})=(${values.join(', ')}) is not present in table "${parent.name}".`,
        );
      }
    }
  }

  /**
   * INSERT one row. Returns the stored row, or null when `ON CONFLICT DO NOTHING` skipped it.
   * `bypassRls` is for trigger and FK-action writes, which Postgres runs without RLS.
   */
  async insert(
    table: string,
    values: AnyRow,
    options: { onConflict?: ConflictOptions; bypassRls?: boolean } = {},
  ): Promise<StoredRow | null> {
    const info = tableInfo(table);
    const row = this.buildRow(info, values, null);
    // Postgres checks the RLS policy before NOT NULL and CHECK constraints.
    this.checkWrite(info, row, options.bypassRls ?? false, 'insert');
    this.validate(info, row);
    const partition = this.partitionOf(info, row);
    const docId = docIdFor(info, row);
    const sealed = sealRow(row as StoredRow, docId);

    const conflict = await this.findConflict(info, sealed, partition, null);
    if (conflict) {
      const onConflict = options.onConflict;
      const targeted = onConflict && matchesTarget(conflict.rule, onConflict.target);
      if (!onConflict || !targeted) {
        throw uniqueViolation(info.name, conflict.rule.name);
      }
      if (onConflict.action === 'nothing') return null;
      const patch = onConflict.action(conflict.existing, sealed);
      return this.update(table, conflict.existing, patch, { bypassRls: options.bypassRls });
    }

    await this.checkParents(info, row, partition, null);
    const view = await this.view(table, partition);
    this.record(this.changesFor(view.data), docId, sealed);
    await this.store.hooks.afterInsert(this, info.name, sealed);
    return sealed;
  }

  /** UPDATE one row with a patch. Returns the new row. */
  async update(
    table: string,
    existing: StoredRow,
    patch: AnyRow,
    options: { bypassRls?: boolean } = {},
  ): Promise<StoredRow> {
    const info = tableInfo(table);
    const oldDocId = existing[DOC_ID] ?? docIdFor(info, existing);
    const oldPartition = this.partitionOf(info, existing);
    let row = this.buildRow(info, patch, existing);
    row = this.store.hooks.beforeUpdate(this, info.name, existing, row);
    this.checkWrite(info, row, options.bypassRls ?? false, 'update');
    this.validate(info, row);
    const partition = this.partitionOf(info, row);
    const docId = info.primaryKey ? docIdFor(info, row) : oldDocId;
    const sealed = sealRow(row as StoredRow, docId);

    const conflict = await this.findConflict(info, sealed, partition, oldDocId);
    if (conflict) throw uniqueViolation(info.name, conflict.rule.name);
    await this.checkParents(info, row, partition, existing);

    if (docId !== oldDocId || partition !== oldPartition) {
      await this.checkReferencesUnchanged(info, existing, row);
      const oldView = await this.view(table, oldPartition);
      this.record(this.changesFor(oldView.data), oldDocId, null);
    }
    const view = await this.view(table, partition);
    this.record(this.changesFor(view.data), docId, sealed);
    return sealed;
  }

  /** Changing a referenced key while children still point at it is an error (ON UPDATE NO ACTION). */
  private async checkReferencesUnchanged(info: TableInfo, before: AnyRow, after: AnyRow) {
    for (const { table: child, fk } of info.referencedBy) {
      if (fk.refColumns.every(c => before[c] === after[c])) continue;
      if ((await this.children(child, fk, before, this.partitionOf(info, before))).length > 0) {
        throw foreignKeyStillReferenced(info.name, fk.name, child);
      }
    }
  }

  private async children(
    childTable: string,
    fk: TableInfo['foreignKeys'][number],
    parent: AnyRow,
    parentPartition: string,
  ): Promise<StoredRow[]> {
    const child = tableInfo(childTable);
    const values = fk.refColumns.map(c => parent[c]);
    if (values.some(v => v == null)) return [];
    const keyFn = columnsKeyFn(child, fk.columns);
    const key = keyFn(Object.fromEntries(fk.columns.map((c, i) => [c, values[i]])) as StoredRow);
    if (key === null) return [];
    const partitions =
      child.tenancy === 'global'
        ? ['']
        : [
            ...new Set([
              parentPartition || this.ctx.businessId || '',
              ...this.store.replica.loadedPartitions(childTable),
            ]),
          ].filter(Boolean);
    const rows: StoredRow[] = [];
    for (const p of partitions) {
      const view = await this.view(childTable, p);
      rows.push(...view.lookup(`cols:${fk.columns.join(',')}`, keyFn, key));
    }
    return rows;
  }

  /** DELETE one row, applying the ON DELETE actions of the foreign keys that reference it. */
  async delete(
    table: string,
    existing: StoredRow,
    options: { bypassRls?: boolean } = {},
  ): Promise<StoredRow> {
    const info = tableInfo(table);
    // The restrictive `tenant_isolation_delete` policies: a request deletes only rows of the current
    // business, even when its read scope covers more. Ports filter first, as the DELETE's USING
    // would; reaching here with another business's row is refused rather than skipped, so a port
    // bug can never delete another tenant's data. FK actions (cascades) run without RLS.
    if (!options.bypassRls && info.tenancy === 'owner') {
      const owner = existing[info.ownerColumn!];
      const ownRoot = BOOTSTRAP_ROOT[info.name] && existing.id === this.ctx.businessId;
      if (!this.ctx.businessId || (owner !== this.ctx.businessId && !ownRoot)) {
        throw rlsViolation(info.name);
      }
    }
    const docId = existing[DOC_ID] ?? docIdFor(info, existing);
    const partition = this.partitionOf(info, existing);
    const view = await this.view(table, partition);
    if (!view.get(docId)) return existing;
    this.record(this.changesFor(view.data), docId, null);

    for (const { table: childTable, fk } of info.referencedBy) {
      const children = await this.children(childTable, fk, existing, partition);
      if (children.length === 0) continue;
      switch (fk.onDelete) {
        case 'cascade':
          for (const child of children) await this.delete(childTable, child, { bypassRls: true });
          break;
        case 'setnull':
          for (const child of children) {
            await this.update(
              childTable,
              child,
              Object.fromEntries(fk.columns.map(c => [c, null])),
              { bypassRls: true },
            );
          }
          break;
        case 'setdefault': {
          const childInfo = tableInfo(childTable);
          for (const child of children) {
            const patch = Object.fromEntries(
              fk.columns.map(c => [
                c,
                defaultValue(childInfo.columnByName.get(c)!, { transactionTime: this.time }),
              ]),
            );
            await this.update(childTable, child, patch, { bypassRls: true });
          }
          break;
        }
        default:
          throw foreignKeyStillReferenced(info.name, fk.name, childTable);
      }
    }
    return existing;
  }

  // -------------------------------------------------------------------------------------------
  // Savepoints and commit
  // -------------------------------------------------------------------------------------------

  savepoint(name: string) {
    this.savepoints.push({ name, mark: this.undo.length });
  }

  rollbackTo(name: string) {
    const index = this.savepoints.map(s => s.name).lastIndexOf(name);
    if (index < 0) throw new DbError(`savepoint "${name}" does not exist`, '3B001');
    const { mark } = this.savepoints[index]!;
    while (this.undo.length > mark) {
      const entry = this.undo.pop()!;
      entry.changes.restore(entry.docId, entry.previous);
    }
    this.savepoints.length = index + 1;
  }

  release(name: string) {
    const index = this.savepoints.map(s => s.name).lastIndexOf(name);
    if (index < 0) throw new DbError(`savepoint "${name}" does not exist`, '3B001');
    this.savepoints.length = index;
  }

  get hasChanges(): boolean {
    for (const changes of this.touched.values()) if (changes.current.size) return true;
    return false;
  }

  rollback() {
    this.finished = true;
    this.touched.clear();
    this.undo = [];
  }

  async commit(): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    if (!this.hasChanges) return;
    await this.store.commit(async () => {
      const ops: WriteOp[] = [];
      const applied: { changes: TableChanges; docId: string; row: StoredRow | null }[] = [];
      for (const changes of this.touched.values()) {
        const { info, partition } = changes.data;
        for (const [docId, row] of changes.current) {
          const before = changes.before.get(docId) ?? null;
          const precondition = before?.[UPDATE_TIME] as Timestamp | undefined;
          if (row === null) {
            if (!before) continue;
            ops.push({ kind: 'delete', ref: { partition, table: info.name }, docId, precondition });
          } else {
            // Another transaction may have committed a conflicting unique key since we checked.
            await this.recheckUnique(info, row, partition, docId);
            ops.push({
              kind: before ? 'update' : 'create',
              ref: { partition, table: info.name },
              docId,
              data: encodeRow(info, row),
              precondition,
            });
          }
          applied.push({ changes, docId, row });
        }
      }
      let times: (Timestamp | null)[];
      try {
        times = await this.store.backend.commit(ops);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/ALREADY_EXISTS|FAILED_PRECONDITION|already exists|precondition/i.test(message)) {
          throw new DbError(
            `could not serialize access due to concurrent update (${message})`,
            '40001',
          );
        }
        throw error;
      }
      applied.forEach(({ changes, docId, row }, i) => {
        const time = times[i] ?? null;
        changes.data.apply(docId, row ? sealRow({ ...row }, docId, time ?? undefined) : null, time);
      });
    });
  }

  private async recheckUnique(info: TableInfo, row: StoredRow, partition: string, docId: string) {
    for (const rule of rulesFor(info)) {
      const key = rule.keyFn(row);
      if (key === null) continue;
      const data = await this.store.replica.table(partition, info.name);
      for (const otherId of data.index(`u:${rule.name}`, rule.keyFn).get(key) ?? []) {
        if (otherId === docId) continue;
        const changes = this.touched.get(`${data.partition}/${info.name}`);
        // Rows this transaction deleted or re-keyed do not conflict.
        if (changes?.current.has(otherId) && changes.current.get(otherId) === null) continue;
        throw uniqueViolation(info.name, rule.name);
      }
    }
  }
}

function matchesTarget(rule: UniqueRule, target: ConflictOptions['target']): boolean {
  if (!target) return true;
  if (Array.isArray(target)) {
    return (
      rule.columns.length === target.length && target.every(column => rule.columns.includes(column))
    );
  }
  return rule.name === target.constraint;
}
