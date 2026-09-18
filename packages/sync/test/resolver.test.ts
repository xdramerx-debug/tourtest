import { describe, it, expect } from 'vitest';
import type { ScoreAction } from '@csl/core';
import { compareActions, cellKeyOf } from '../src/resolver';

const mk = (over: Partial<ScoreAction> = {}): ScoreAction => ({
  actionId: 'a-1', type: 'score.set', tournamentId: 't1', roundIndex: 0,
  playerId: 'p1', hole: 7, payload: { strokes: 5 },
  authorId: 'x', authorRole: 'player', deviceId: 'd1',
  clientTs: 1_000_000, lamport: 1, ...over,
});

describe('конфликт-резолвер (NFR §3, ARCHITECTURE §6.3)', () => {
  it('LWW по clientTs вне окна ±5с', () => {
    const a = mk({ clientTs: 1_010_000 });
    const b = mk({ clientTs: 1_000_000, authorRole: 'referee' });
    expect(compareActions(a, b)).toBeGreaterThan(0);
    expect(compareActions(b, a)).toBeLessThan(0);
  });
  it('окно ±5с: судья > маркер > игрок', () => {
    const ref = mk({ authorRole: 'referee', clientTs: 1_000_000 });
    const mrk = mk({ authorRole: 'marker', clientTs: 1_002_000 });
    const plr = mk({ authorRole: 'player', clientTs: 1_004_900 });
    expect(compareActions(ref, mrk)).toBeGreaterThan(0);
    expect(compareActions(mrk, plr)).toBeGreaterThan(0);
    expect(compareActions(plr, ref)).toBeLessThan(0);
  });
  it('равная роль в окне: поздний lamport, затем clientTs', () => {
    const a = mk({ lamport: 5, clientTs: 1_000_000 });
    const b = mk({ lamport: 3, clientTs: 1_001_000 });
    expect(compareActions(a, b)).toBeGreaterThan(0);
  });
  it('полный паритет → детерминизм по actionId', () => {
    const a = mk({ actionId: 'aaa' });
    const b = mk({ actionId: 'bbb' });
    expect(compareActions(a, b)).toBeLessThan(0);
    expect(compareActions(b, a)).toBeGreaterThan(0);
    expect(compareActions(a, a)).toBe(0);
  });
  it('cellKey: score vs entry разные ячейки', () => {
    const s = mk();
    const e = mk({ type: 'entry.status', hole: undefined, payload: { status: 'dq' } });
    expect(cellKeyOf(s)).toBe('0|p1|7|score');
    expect(cellKeyOf(e)).toBe('0|p1|0|entry');
  });
});
