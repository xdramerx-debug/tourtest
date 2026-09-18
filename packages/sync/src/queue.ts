import type { ScoreAction } from '@csl/core';

/**
 * Offline-очередь исходящих действий (ARCHITECTURE §6.1–6.2).
 * Персист мгновенный (RPO=0), переживает reload/перезагрузку. Backoff 1→60 с, jitter 20%.
 */

export interface ActionStore {
  add(a: ScoreAction): Promise<void>;
  all(): Promise<ScoreAction[]>;
  remove(ids: string[]): Promise<void>;
  count(): Promise<number>;
}

export class MemoryStore implements ActionStore {
  private items = new Map<string, ScoreAction>();
  async add(a: ScoreAction) { this.items.set(a.actionId, a); }
  async all() { return [...this.items.values()]; }
  async remove(ids: string[]) { ids.forEach((id) => this.items.delete(id)); }
  async count() { return this.items.size; }
}

/** IndexedDB-хранилище через Dexie (браузер). */
export class DexieStore implements ActionStore {
  private ready: Promise<import('dexie').Table<ScoreAction, string>>;
  constructor(dbName = 'csl-queue') {
    this.ready = (async () => {
      const { default: Dexie } = await import('dexie');
      const db = new Dexie(dbName);
      db.version(1).stores({ actions: 'actionId, clientTs' });
      return db.table<ScoreAction, string>('actions');
    })();
  }
  async add(a: ScoreAction) { (await this.ready).put(a); }
  async all() { const t = await this.ready; return t.orderBy('clientTs').toArray(); }
  async remove(ids: string[]) { (await this.ready).bulkDelete(ids); }
  async count() { return (await this.ready).count(); }
}

export type QueueListener = (size: number) => void;

export class SyncQueue {
  constructor(private store: ActionStore) {}
  private listeners = new Set<QueueListener>();

  onChange(fn: QueueListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private async emit() {
    const n = await this.store.count();
    this.listeners.forEach((fn) => fn(n));
  }
  async enqueue(a: ScoreAction) {
    await this.store.add(a); // сначала персист — потом всё остальное
    await this.emit();
  }
  /** Батч для отправки: FIFO с пер-entity упорядочиванием (cell key внутри RoundScores атомарен). */
  async peek(max = 50): Promise<ScoreAction[]> {
    const all = await this.store.all();
    return all
      .sort((x, y) => x.clientTs - y.clientTs || x.lamport - y.lamport)
      .slice(0, max);
  }
  async ack(ids: string[]) {
    await this.store.remove(ids);
    await this.emit();
  }
  async size() { return this.store.count(); }
}

export interface SenderOptions {
  batchMax?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: number;
  now?: () => number;
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (h: ReturnType<typeof setTimeout>) => void;
}

export interface PushResult { ok: boolean; applied: string[] }

/** Отправитель с экспоненциальным backoff. Online-событие — немедленная попытка. */
export class Sender {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private delay: number;
  private running = false;
  private stopped = false;
  onState: ((s: 'idle' | 'sending' | 'error') => void) | null = null;

  constructor(
    private queue: SyncQueue,
    private push: (batch: ScoreAction[]) => Promise<PushResult>,
    private opts: SenderOptions = {},
  ) {
    this.delay = opts.baseDelayMs ?? 1000;
  }

  private get setT() { return this.opts.setTimeoutFn ?? setTimeout; }
  private get clearT() { return this.opts.clearTimeoutFn ?? clearTimeout; }

  start() { this.stopped = false; void this.kick(); }
  stop() { this.stopped = true; if (this.timer) this.clearT(this.timer); this.timer = null; }

  /** Немедленная попытка (например, по событию online). */
  async kick() {
    if (this.stopped || this.running) return;
    if (this.timer) { this.clearT(this.timer); this.timer = null; }
    this.running = true;
    try {
      await this.flushOnce();
      this.delay = this.opts.baseDelayMs ?? 1000;
    } finally {
      this.running = false;
    }
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    if (this.timer) this.clearT(this.timer);
    this.timer = this.setT(() => void this.kick(), ms);
  }

  private async flushOnce() {
    const max = this.opts.batchMax ?? 50;
    for (;;) {
      if (this.stopped) return;
      const batch = await this.queue.peek(max);
      if (batch.length === 0) {
        // подстраховочный тихий тик (self-healing)
        this.schedule(this.opts.maxDelayMs ?? 60000);
        return;
      }
      this.onState?.('sending');
      try {
        const res = await this.push(batch);
        if (!res.ok) throw new Error('push rejected');
        await this.queue.ack(res.applied);
        this.onState?.('idle');
        this.delay = this.opts.baseDelayMs ?? 1000;
      } catch {
        this.onState?.('error');
        const jitter = this.delay * (this.opts.jitter ?? 0.2) * Math.random();
        this.delay = Math.min((this.opts.maxDelayMs ?? 60000), this.delay * 2);
        this.schedule(this.delay + jitter);
        return;
      }
    }
  }
}
