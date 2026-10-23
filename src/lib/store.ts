import { api, NetworkError } from '../api.ts';
import { emptyRecords, type AppState, type SyncOp } from '../../shared/types.ts';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

interface Snapshot {
  state: AppState | null;
  pending: number;
  status: SyncStatus;
}

const STORAGE_KEY = 'ember-store-v1';
const RETRY_MS = 20_000;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function applyOps(state: AppState, ops: SyncOp[]): AppState {
  if (ops.length === 0) return state;
  const records = { ...state.records };
  for (const op of ops) {
    const list = records[op.kind] as { id: string }[];
    const id = op.op === 'put' ? op.record.id : op.id;
    const rest = list.filter((r) => r.id !== id);
    (records as Record<string, unknown[]>)[op.kind] = op.op === 'put' ? [...rest, op.record] : rest;
  }
  return { ...state, records };
}

/** Older cached snapshots may predate newer record kinds. */
const normalise = (s: AppState): AppState => ({ ...s, records: { ...emptyRecords(), ...s.records } });

/**
 * Offline-first store: the last server snapshot plus an outbox of pending ops,
 * both persisted to localStorage. The UI reads server ⊕ outbox, so local changes
 * appear instantly and are pushed whenever the network allows.
 */
class SyncStore {
  private server: AppState | null = null;
  private outbox: SyncOp[] = [];
  private status: SyncStatus = 'syncing';
  private snapshot: Snapshot = { state: null, pending: 0, status: 'syncing' };
  private listeners = new Set<() => void>();
  private flushing = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  onRejected: (errors: string[]) => void = () => {};

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved) {
        this.server = saved.server && normalise(saved.server);
        this.outbox = saved.outbox ?? [];
      }
    } catch {}
    this.refresh();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flush());
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.flush());
      void this.flush();
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  private refresh() {
    this.snapshot = {
      state: this.server && applyOps(this.server, this.outbox),
      pending: this.outbox.length,
      status: this.status,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ server: this.server, outbox: this.outbox }));
    } catch {}
    this.listeners.forEach((fn) => fn());
  }

  /** Custom exercises are created online (they get server ids); show them without waiting for a refetch. */
  addExercise(exercise: AppState['exercises'][number]) {
    if (!this.server) return;
    this.server = { ...this.server, exercises: [...this.server.exercises, exercise] };
    this.refresh();
  }

  enqueue(...ops: SyncOp[]) {
    this.outbox.push(...ops);
    this.refresh();
    void this.flush();
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    clearTimeout(this.retryTimer);
    this.status = 'syncing';
    this.refresh();
    try {
      while (true) {
        const batch = this.outbox.slice();
        if (batch.length === 0) {
          this.server = normalise(await api.state());
        } else {
          const result = await api.sync(batch);
          this.server = normalise(result.state);
          this.outbox = this.outbox.slice(batch.length);
          if (result.rejected.length) this.onRejected(result.rejected.map((r) => r.error));
        }
        if (this.outbox.length === 0) break;
      }
      this.status = 'synced';
    } catch (err) {
      this.status = err instanceof NetworkError ? 'offline' : 'error';
      this.retryTimer = setTimeout(() => this.flush(), RETRY_MS);
    } finally {
      this.flushing = false;
      this.refresh();
    }
  }
}

export const store = new SyncStore();
