import { describe, it, expect } from 'vitest';
import type { ScoreAction } from '@csl/core';
import { Projection, entriesWithStatus } from '../src/projection';

const mk = (over: Partial<ScoreAction> = {}): ScoreAction => ({
  actionId: `a-${Math.random().toString(36).slice(2, 9)}`, type: 'score.set', tournamentId: 't1', roundIndex: 0,
  playerId: 'p1', hole: 7, payload: { strokes: 5 },
  authorId: 'x', authorRole: 'player', deviceId: 'd1',
  clientTs: 1_000_000, lamport: 1, ...over,
});

describe('Projection: идемпотентность и конфликты (контракт sync)', () => {
  it('повтор actionId → duplicate, состояние не меняется', () => {
    const p = new Projection();
    const a = mk();
    expect(p.apply(a).result).toBe('applied');
    expect(p.apply({ ...a }).result).toBe('duplicate');
    expect(p.scores[0].p1[7].strokes).toBe(5);
    expect(p.snapshot().seq).toBe(1);
  });

  it('LWW: более поздний clientTs побеждает, старая версия в аудите как superseded', () => {
    const p = new Projection();
    const late = mk({ actionId: 'late', clientTs: 2_000_000, payload: { strokes: 4 } });
    const early = mk({ actionId: 'early', clientTs: 1_000_000 });
    p.apply(late);
    const r = p.apply(early);
    expect(r.result).toBe('overridden');
    expect(p.scores[0].p1[7].strokes).toBe(4);
    p.apply(mk({ actionId: 'later', clientTs: 3_000_000, payload: { strokes: 6 } }));
    expect(p.scores[0].p1[7].strokes).toBe(6);
    expect(p.audit.some((x) => x.superseded === 'late')).toBe(true);
  });

  it('окно ±5с: роль решает (судья правит маркера — F4)', () => {
    const p = new Projection();
    p.apply(mk({ actionId: 'm', authorRole: 'marker', clientTs: 1_001_000, payload: { strokes: 5 } }));
    p.apply(mk({ actionId: 'r', authorRole: 'referee', clientTs: 1_000_000, payload: { strokes: 4 } }));
    expect(p.scores[0].p1[7].strokes).toBe(4);
  });

  it('score.set замещает pickup; penalty добавляется к gross', () => {
    const p = new Projection();
    p.apply(mk({ actionId: '1', type: 'score.pickup', payload: {} }));
    expect(p.scores[0].p1[7].pickup).toBe(true);
    p.apply(mk({ actionId: '2', clientTs: 2_000_000, payload: { strokes: 6, penalties: undefined } }));
    expect(p.scores[0].p1[7].pickup).toBeUndefined();
    expect(p.scores[0].p1[7].strokes).toBe(6);
    p.apply(mk({ actionId: '3', clientTs: 3_000_000, type: 'score.penalty', payload: { penalties: 2 } }));
    expect(p.scores[0].p1[7].penalties).toBe(2);
  });

  it('score.clear убирает ячейку; entry.status → статус, отмена возвращает active', () => {
    const p = new Projection();
    p.apply(mk({ actionId: 's1' }));
    p.apply(mk({ actionId: 's2', clientTs: 2_000_000, type: 'score.clear', payload: {} }));
    expect(p.scores[0].p1[7]).toBeUndefined();
    p.apply(mk({ actionId: 'st1', type: 'entry.status', hole: undefined, payload: { status: 'dq', reason: 'правило 1.2' } }));
    expect(p.statusByPlayer.p1).toEqual({ status: 'dq', reason: 'правило 1.2' });
    const entries = entriesWithStatus([{ playerId: 'p1', teeSetKey: 'mens', status: 'active' }], p.statusByPlayer);
    expect(entries[0].status).toBe('dq');
    p.apply(mk({ actionId: 'st2', clientTs: 2_000_000, type: 'entry.status', hole: undefined, payload: { status: 'active' } }));
    expect(p.statusByPlayer.p1).toBeUndefined();
  });

  it('snapshot/restore: реплей журнала даёт то же состояние', () => {
    const p = new Projection();
    const acts = [mk({ actionId: 'x1' }), mk({ actionId: 'x2', clientTs: 5_000, payload: { strokes: 3 } })];
    const order = [...acts].sort((a, b) => compareActionsSafe(a, b));
    for (const a of acts) p.apply(a);
    const p2 = Projection.restore(order);
    expect(p2.scores).toEqual(p.scores);
    expect(p2.snapshot().seq).toBe(p.snapshot().seq);
  });
});

// для restore: сортируем по clientTs — реплей в хронологии детерминирован
import { compareActions } from '../src/resolver';
function compareActionsSafe(a: ScoreAction, b: ScoreAction) { return compareActions(a, b); }
