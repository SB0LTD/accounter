/**
 * Where documents live. `FirestoreBackend` is production; `MemoryBackend` serves tests and the
 * verification harness, which load data straight into it.
 */
import type { Firestore, Timestamp, WriteResult } from 'firebase-admin/firestore';

/** A collection: a table in one partition. Partition '' is global; otherwise a tenant id. */
export interface CollectionRef {
  partition: string;
  table: string;
}

export interface DocChange {
  docId: string;
  /** null: the document was removed. */
  data: Record<string, unknown> | null;
  /** Update time of the document (or the snapshot's read time for removals). */
  time: Timestamp | null;
}

export interface WriteOp {
  kind: 'create' | 'update' | 'delete';
  ref: CollectionRef;
  docId: string;
  data?: Record<string, unknown>;
  /** The update time the row was read at; the write fails if the document changed since. */
  precondition?: Timestamp;
}

export interface StoreBackend {
  /** Listens to a collection. The first call of `onChanges` is the full initial snapshot. */
  listen(ref: CollectionRef, onChanges: (changes: DocChange[]) => void): Promise<() => void>;
  /** Writes the operations; each returned time pairs with its op (null for deletes). */
  commit(ops: WriteOp[]): Promise<(Timestamp | null)[]>;
}

export function collectionPath(ref: CollectionRef): string {
  return ref.partition ? `tenants/${ref.partition}/${ref.table}` : ref.table;
}

/**
 * Firestore's limit on writes per batch. Larger commits are split into several batches, which are
 * then no longer atomic together; only bulk imports get that large.
 */
const BATCH_LIMIT = 450;

export class FirestoreBackend implements StoreBackend {
  constructor(private readonly db: Firestore) {}

  listen(ref: CollectionRef, onChanges: (changes: DocChange[]) => void): Promise<() => void> {
    return new Promise((resolve, reject) => {
      let first = true;
      const unsubscribe = this.db.collection(collectionPath(ref)).onSnapshot(
        snapshot => {
          const changes: DocChange[] = snapshot
            .docChanges()
            .map(change =>
              change.type === 'removed'
                ? { docId: change.doc.id, data: null, time: snapshot.readTime }
                : { docId: change.doc.id, data: change.doc.data(), time: change.doc.updateTime },
            );
          onChanges(changes);
          if (first) {
            first = false;
            resolve(unsubscribe);
          }
        },
        error => {
          if (first) reject(error);
          else console.error(`firestore listener ${collectionPath(ref)} failed`, error);
        },
      );
    });
  }

  async commit(ops: WriteOp[]): Promise<(Timestamp | null)[]> {
    const times: (Timestamp | null)[] = [];
    for (let start = 0; start < ops.length; start += BATCH_LIMIT) {
      const chunk = ops.slice(start, start + BATCH_LIMIT);
      const batch = this.db.batch();
      for (const op of chunk) {
        const doc = this.db.collection(collectionPath(op.ref)).doc(op.docId);
        const precondition = op.precondition ? { lastUpdateTime: op.precondition } : undefined;
        if (op.kind === 'create') batch.create(doc, op.data!);
        else if (op.kind === 'update') {
          if (precondition) batch.update(doc, op.data!, precondition);
          else batch.set(doc, op.data!);
        } else if (precondition) batch.delete(doc, precondition);
        else batch.delete(doc);
      }
      const results: WriteResult[] = await batch.commit();
      results.forEach((result, i) =>
        times.push(chunk[i]!.kind === 'delete' ? null : result.writeTime),
      );
    }
    return times;
  }
}

/** An in-process backend with the same contract. */
export class MemoryBackend implements StoreBackend {
  private collections = new Map<
    string,
    Map<string, { data: Record<string, unknown>; time: Timestamp }>
  >();
  private listeners = new Map<string, Set<(changes: DocChange[]) => void>>();
  private clock = 0;

  constructor(private readonly makeTimestamp: (millis: number) => Timestamp) {}

  private collection(path: string) {
    let docs = this.collections.get(path);
    if (!docs) {
      docs = new Map();
      this.collections.set(path, docs);
    }
    return docs;
  }

  private nextTime(): Timestamp {
    this.clock = Math.max(this.clock + 1, Date.now());
    return this.makeTimestamp(this.clock);
  }

  /** Loads documents directly, bypassing listeners (harness setup). */
  seed(ref: CollectionRef, docs: { docId: string; data: Record<string, unknown> }[]) {
    const collection = this.collection(collectionPath(ref));
    for (const doc of docs) collection.set(doc.docId, { data: doc.data, time: this.nextTime() });
  }

  async listen(ref: CollectionRef, onChanges: (changes: DocChange[]) => void): Promise<() => void> {
    const path = collectionPath(ref);
    const initial = [...this.collection(path)].map(([docId, doc]) => ({
      docId,
      data: doc.data,
      time: doc.time,
    }));
    onChanges(initial);
    let set = this.listeners.get(path);
    if (!set) {
      set = new Set();
      this.listeners.set(path, set);
    }
    set.add(onChanges);
    return () => set.delete(onChanges);
  }

  async commit(ops: WriteOp[]): Promise<(Timestamp | null)[]> {
    // Validate first so a failed commit writes nothing, as a Firestore batch would.
    for (const op of ops) {
      const existing = this.collection(collectionPath(op.ref)).get(op.docId);
      if (op.kind === 'create' && existing) throw new Error(`ALREADY_EXISTS: ${op.docId}`);
      if (op.precondition && existing && existing.time.toMillis() !== op.precondition.toMillis()) {
        throw new Error(`FAILED_PRECONDITION: ${op.docId}`);
      }
    }
    const byPath = new Map<string, DocChange[]>();
    const times = ops.map(op => {
      const path = collectionPath(op.ref);
      const collection = this.collection(path);
      const time = this.nextTime();
      if (op.kind === 'delete') collection.delete(op.docId);
      else collection.set(op.docId, { data: op.data!, time });
      const list = byPath.get(path) ?? [];
      list.push({ docId: op.docId, data: op.kind === 'delete' ? null : op.data!, time });
      byPath.set(path, list);
      return op.kind === 'delete' ? null : time;
    });
    queueMicrotask(() => {
      for (const [path, changes] of byPath) {
        for (const listener of this.listeners.get(path) ?? []) listener(changes);
      }
    });
    return times;
  }
}
