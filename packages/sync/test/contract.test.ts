import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ScoreAction } from '@csl/core';
import { DemoTransport } from '../src/demo';
import { createTournamentStore } from '../src/store';
import { MemoryStore } from '../src/queue';
import { entriesWithStatus } from '../src/projection';
import { buildLeaderboard } from '@csl/scoring-engine';

// jsdom-less node env: localStorage недоступен → DemoTransport/queue деградируют в память (by design)
const flush = () => new Promise((r) => setTimeout(r, 30));

describe('сквозной контракт: стор ↔ демо-транспорт ↔ engine', () => {
  let transport: DemoTransport;

  beforeEach(() => {
    transport = new DemoTransport({ tournamentId: 't-open', players: 24, startProgress: 3, simulate: false, seed: 11 });
  });

  it('connect: снапшот с турниром и прогрессом ботов', async () => {
    const st = createTournamentStore({ transport, store: new MemoryStore(), sessionStorageKey: 'k1' });
    await st.connect();
    expect(st.getState().tournament?.entries.length).toBe(24);
    const scored = Object.keys(st.getState().scores[0] ?? {}).length;
    expect(scored).toBeGreaterThan(5);
    expect(st.getState().status).toBe('online');
    st.destroy();
  });

  it('ввод счёта: оптимистично + ack чистит очередь + лидерборд пересчитан (E2-ядро)', async () => {
    const st = createTournamentStore({ transport, store: new MemoryStore(), sessionStorageKey: 'k2' });
    await st.connect();
    const t = st.getState().tournament!;
    const me = t.entries[0].playerId;
    const join = st.join({ code: t.joinCode, name: 'Тест Игрок', hi: 12.4, teeSetKey: 'mens', asMarker: false });
    expect(join.ok).toBe(true);
    st.setScore(me, 1, 4);
    st.setScore(me, 2, 5);
    await flush();
    expect(st.getState().queued).toBe(0);
    const state = st.getState();
    const lb = buildLeaderboard({
      tournament: { ...t, entries: entriesWithStatus(t.entries, state.statusByPlayer) },
      scores: state.scores, mode: 'gross',
    });
    const row = lb.rows.find((r) => r.playerId === me)!;
    expect(row.rounds[0].byHole[0].gross).toBe(4);
    expect(row.thru).toBeGreaterThanOrEqual(2);
    st.destroy();
  });

  it('офлайн-раунд: действия копятся, после сети — доставлены без потерь (E1, идемпотентно)', async () => {
    vi.useFakeTimers();
    let online = false;
    const tr = new DemoTransport({ tournamentId: 't-off', players: 24, startProgress: 0, simulate: false, seed: 3 });
    const st = createTournamentStore({ transport: tr, store: new MemoryStore(), sessionStorageKey: 'k3' });
    await st.connect();
    await vi.advanceTimersByTimeAsync(20);
    const t = st.getState().tournament!;
    // глушим транспорт: сеть упала
    const origPush = tr.push.bind(tr);
    tr.push = async (batch: ScoreAction[]) => (online ? origPush(batch) : Promise.resolve({ ok: false, applied: [] as string[] }));
    const me = t.entries[1].playerId;
    for (let h = 1; h <= 9; h++) st.setScore(me, h, 4); // 9 лунок без сети (E1)
    await vi.advanceTimersByTimeAsync(100);
    expect(st.getState().queued).toBe(9);
    expect(st.getState().scores[0][me][9]?.strokes).toBe(4); // оптимистичный UI
    online = true;
    // backoff 1с → первая удачная попытка, ack из фрейма
    await vi.advanceTimersByTimeAsync(3000);
    expect(st.getState().queued).toBe(0);
    // сервер видит все 9 лунок, повтор не дублирует
    const snap = tr.snapshot();
    expect(snap.projection.scores[0][me][9]?.strokes).toBe(4);
    expect(snap.projection.audit.filter((a) => a.result === 'duplicate').length).toBe(0);
    st.destroy();
    vi.useRealTimers();
  });

  it('конфликт E3: маркер «5» vs судья «4» в окне ±5с → судья побеждает, всё в аудите', async () => {
    const st = createTournamentStore({ transport, store: new MemoryStore(), sessionStorageKey: 'k4' });
    await st.connect();
    const t = st.getState().tournament!;
    const me = t.entries[2].playerId;
    const now = Date.now();
    transport.push([
      { actionId: 'm-1', type: 'score.set', tournamentId: t.id, roundIndex: 0, playerId: me, hole: 7, payload: { strokes: 5 }, authorId: 'm', authorRole: 'marker', deviceId: 'dm', clientTs: now, lamport: 1 },
    ] as ScoreAction[]);
    transport.push([
      { actionId: 'r-1', type: 'score.set', tournamentId: t.id, roundIndex: 0, playerId: me, hole: 7, payload: { strokes: 4 }, authorId: 'r', authorRole: 'referee', deviceId: 'dr', clientTs: now, lamport: 1 },
    ] as ScoreAction[]);
    await flush();
    expect(st.getState().scores[0][me][7]?.strokes).toBe(4);
    const audit = st.getState().audit;
    // версия маркера вытеснена решением судьи; обе зафиксированы в аудите (NFR §4)
    expect(audit.some((x) => x.actionId === 'm-1' && x.result === 'applied')).toBe(true);
    expect(audit.some((x) => x.actionId === 'r-1' && x.superseded === 'm-1')).toBe(true);
    st.destroy();
  });

  it('join: неверный код отвергается', async () => {
    const st = createTournamentStore({ transport, store: new MemoryStore(), sessionStorageKey: 'k5' });
    await st.connect();
    expect(st.join({ code: 'WRONG1', name: 'X Y', hi: 10, teeSetKey: 'mens', asMarker: false }).ok).toBe(false);
    st.destroy();
  });
});
