import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ScoreAction } from '@csl/core';
import { DexieStore, MemoryStore, Sender, SyncQueue } from '../src/queue';

const mk = (i: number, over: Partial<ScoreAction> = {}): ScoreAction => ({
  actionId: `q-${i}`, type: 'score.set', tournamentId: 't1', roundIndex: 0,
  playerId: `p${i}`, hole: 1, payload: { strokes: 4 },
  authorId: 'x', authorRole: 'player', deviceId: 'd1',
  clientTs: 1_000_000 + i, lamport: i, ...over,
});

describe('очередь: персист и порядок', () => {
  it('MemoryStore + peek <=50, FIFO по clientTs', async () => {
    const q = new SyncQueue(new MemoryStore());
    for (let i = 60; i >= 0; i--) await q.enqueue(mk(i));
    const batch = await q.peek(50);
    expect(batch.length).toBe(50);
    expect(batch[0].actionId).toBe('q-0');
    await q.ack(batch.map((b) => b.actionId));
    expect(await q.size()).toBe(11);
  });

  it('DexieStore: персист в IndexedDB (переживает «перезагрузку»)', async () => {
    const s1 = new DexieStore('csl-test-q');
    await s1.add(mk(1));
    await s1.add(mk(2));
    const s2 = new DexieStore('csl-test-q'); // «новая сессия» — то же хранилище
    expect(await s2.count()).toBe(2);
    await s2.remove(['q-1', 'q-2']);
    expect(await s2.count()).toBe(0);
  });
});

describe('Sender: backoff и доставка (NFR §3)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('успешная отправка: ack чистит очередь', async () => {
    const q = new SyncQueue(new MemoryStore());
    await q.enqueue(mk(1));
    const pushes: string[][] = [];
    const s = new Sender(q, async (batch) => { pushes.push(batch.map((b) => b.actionId)); return { ok: true, applied: batch.map((b) => b.actionId) }; });
    s.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(pushes).toEqual([['q-1']]);
    expect(await q.size()).toBe(0);
    s.stop();
  });

  it('ошибка сети → экспоненциальный backoff, потом доставка ≤30с (эмуляция)', async () => {
    const q = new SyncQueue(new MemoryStore());
    await q.enqueue(mk(1));
    let calls = 0;
    const s = new Sender(q, async (batch) => {
      calls++;
      if (calls < 4) throw new Error('no net');
      return { ok: true, applied: batch.map((b) => b.actionId) };
    }, { baseDelayMs: 1000, maxDelayMs: 60000, jitter: 0 });
    s.start();
    await vi.advanceTimersByTimeAsync(0);   // попытка 1
    await vi.advanceTimersByTimeAsync(2000); // backoff 2с → попытка 2
    await vi.advanceTimersByTimeAsync(4000); // backoff 4с → попытка 3
    await vi.advanceTimersByTimeAsync(8000); // backoff 8с → попытка 4: успех
    expect(calls).toBe(4);
    expect(await q.size()).toBe(0);
    s.stop();
  });

  it('kick() во время ошибки не параллелит отправки', async () => {
    const q = new SyncQueue(new MemoryStore());
    await q.enqueue(mk(1));
    let inFlight = 0;
    let maxInFlight = 0;
    const s = new Sender(q, async (batch) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 50));
      inFlight--;
      return { ok: true, applied: batch.map((b) => b.actionId) };
    });
    s.start();
    void s.kick(); void s.kick(); void s.kick();
    await vi.advanceTimersByTimeAsync(500);
    expect(maxInFlight).toBe(1);
    s.stop();
  });
});
