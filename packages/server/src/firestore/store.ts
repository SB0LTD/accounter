/**
 * The instance-wide store: backend, live replica, triggers, and commit serialisation.
 */
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { FirestoreBackend, MemoryBackend, type StoreBackend } from './backend.js';
import { Hooks } from './hooks/index.js';
import { Replica } from './replica.js';
import { Transaction, type SessionContext } from './transaction.js';

export class Store {
  readonly replica: Replica;
  readonly hooks = new Hooks();
  private commitTail: Promise<unknown> = Promise.resolve();

  constructor(readonly backend: StoreBackend) {
    this.replica = new Replica(backend);
  }

  begin(context: () => SessionContext): Transaction {
    return new Transaction(this, context);
  }

  /**
   * Runs commits one at a time, so the unique-key re-check and the write of one commit cannot
   * interleave with another's in this instance.
   */
  commit<T>(work: () => Promise<T>): Promise<T> {
    const run = this.commitTail.then(work, work);
    this.commitTail = run.catch(() => undefined);
    return run;
  }

  close() {
    this.replica.close();
  }
}

export interface FirestoreSettings {
  projectId?: string;
  databaseId: string;
}

let shared: Store | null = null;

/** The process's store on Firestore (Application Default Credentials). */
export function firestoreStore(settings: FirestoreSettings): Store {
  if (shared) return shared;
  const app: App =
    getApps()[0] ??
    initializeApp(settings.projectId ? { projectId: settings.projectId } : undefined);
  const db = getFirestore(app, settings.databaseId);
  db.settings({ ignoreUndefinedProperties: true });
  shared = new Store(new FirestoreBackend(db));
  return shared;
}

/** A store on an in-memory backend, for tests and the verification harness. */
export function memoryStore(): { store: Store; backend: MemoryBackend } {
  const backend = new MemoryBackend(millis => Timestamp.fromMillis(millis));
  return { store: new Store(backend), backend };
}
