/**
 * The live in-memory copy of the collections an instance serves. Each (partition, table) is loaded
 * on first use and then kept current by a snapshot listener; commits from this instance are applied
 * at once so a request reads its own writes.
 */
import type { Timestamp } from 'firebase-admin/firestore';
import { log } from '../observability/log.js';
import type { StoreBackend } from './backend.js';
import { tableInfo, type TableInfo } from './catalog.js';
import { decodeRow, equalityKey, type StoredRow } from './values.js';

export type KeyFn = (row: StoredRow) => string | null;

/** Index key over columns; null when a column is NULL and nulls are distinct (SQL equality). */
export function columnsKeyFn(table: TableInfo, columns: string[], nullsEqual = false): KeyFn {
  const metas = columns.map(name => {
    const meta = table.columnByName.get(name);
    if (!meta) throw new Error(`column "${name}" does not exist on ${table.name}`);
    return meta;
  });
  return row => {
    const parts: string[] = [];
    for (const meta of metas) {
      const key = equalityKey(row[meta.name], meta.kind);
      if (key === null) {
        if (!nullsEqual) return null;
        parts.push('∅');
      } else parts.push(key);
    }
    return parts.join('\u0000');
  };
}

interface IndexState {
  keyFn: KeyFn;
  map: Map<string, Set<string>>;
}

export class TableData {
  readonly rows = new Map<string, StoredRow>();
  /** Bumped on every change; memoised views compare it. */
  version = 0;
  private knownTimes = new Map<string, number>();
  private indexes = new Map<string, IndexState>();

  constructor(
    readonly info: TableInfo,
    readonly partition: string,
  ) {}

  /** An index by key function, built on first use and kept current afterwards. */
  index(name: string, keyFn: KeyFn): Map<string, Set<string>> {
    let state = this.indexes.get(name);
    if (!state) {
      const map = new Map<string, Set<string>>();
      for (const [docId, row] of this.rows) addToIndex(map, keyFn(row), docId);
      state = { keyFn, map };
      this.indexes.set(name, state);
    }
    return state.map;
  }

  /**
   * Applies one document state. A change older than what this replica already holds for the
   * document is ignored, so a listener event that trails a local commit cannot roll it back.
   */
  apply(docId: string, row: StoredRow | null, time: Timestamp | null) {
    const millis = time ? time.toMillis() : Number.MAX_SAFE_INTEGER;
    const known = this.knownTimes.get(docId);
    if (known !== undefined && time && millis < known) return;
    if (time) this.knownTimes.set(docId, millis);
    const previous = this.rows.get(docId);
    if (previous)
      for (const state of this.indexes.values())
        removeFromIndex(state.map, state.keyFn(previous), docId);
    if (row) {
      this.rows.set(docId, row);
      for (const state of this.indexes.values()) addToIndex(state.map, state.keyFn(row), docId);
    } else {
      this.rows.delete(docId);
    }
    this.version++;
  }
}

function addToIndex(map: Map<string, Set<string>>, key: string | null, docId: string) {
  if (key === null) return;
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(docId);
}

function removeFromIndex(map: Map<string, Set<string>>, key: string | null, docId: string) {
  if (key === null) return;
  const set = map.get(key);
  if (!set) return;
  set.delete(docId);
  if (set.size === 0) map.delete(key);
}

export class Replica {
  private tables = new Map<string, Promise<TableData>>();
  private unsubscribers: (() => void)[] = [];

  constructor(private readonly backend: StoreBackend) {}

  /** The table's data for a partition, loading and subscribing on first use. */
  table(partition: string, table: string): Promise<TableData> {
    const info = tableInfo(table);
    const effectivePartition = info.tenancy === 'owner' ? partition : '';
    const key = `${effectivePartition}/${table}`;
    let pending = this.tables.get(key);
    if (!pending) {
      pending = this.load(info, effectivePartition);
      this.tables.set(key, pending);
      // A failed load is retried by the next request rather than cached.
      pending.catch(() => this.tables.delete(key));
    }
    return pending;
  }

  /** Tables already loaded, without loading new ones (cascades search these). */
  loadedPartitions(table: string): string[] {
    const partitions: string[] = [];
    for (const key of this.tables.keys()) {
      const slash = key.lastIndexOf('/');
      if (key.slice(slash + 1) === table) partitions.push(key.slice(0, slash));
    }
    return partitions;
  }

  private async load(info: TableInfo, partition: string): Promise<TableData> {
    const data = new TableData(info, partition);
    const started = Date.now();
    const unsubscribe = await this.backend.listen({ partition, table: info.name }, changes => {
      for (const change of changes) {
        data.apply(
          change.docId,
          change.data ? decodeRow(info, change.docId, change.data, change.time ?? undefined) : null,
          change.time,
        );
      }
    });
    this.unsubscribers.push(unsubscribe);
    const millis = Date.now() - started;
    if (millis > 1000 || data.rows.size > 5000) {
      log('info', 'firestore-table-loaded', {
        table: info.name,
        partition: partition || '(global)',
        rows: data.rows.size,
        millis,
      });
    }
    return data;
  }

  close() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    this.tables.clear();
  }
}
