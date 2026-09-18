import { describe, it, expect } from 'vitest';
import type { FormatConfig, HoleScore, RoundScores, Tournament } from '@csl/core';
import { buildLeaderboard } from '../src/leaderboard';
import { countbackCompare } from '../src/countback';
import { summarizeRound } from '../src/scores';

function mkTournament(
  playerIds: string[],
  opts: { format?: FormatConfig['id']; rounds?: number[]; statuses?: Record<string, 'active' | 'dq' | 'wd' | 'dns'> } = {},
): Tournament {
  const pars = Array.from({ length: 18 }, () => 4 as const);
  return {
    id: 't1', name: 'Тест', status: 'live',
    course: {
      id: 'c1', name: 'Тест-поле', revision: 1,
      holes: pars.map((par, i) => ({ n: i + 1, par, si: i + 1, lengths: {} })),
      teeSets: [{ key: 'mens', label: 'Мужские', cr: 72, slope: 113 }],
    },
    format: { id: opts.format ?? 'stroke', netEnabled: true },
    allowance: 1,
    tieBreak: ['countback9', 'countback6', 'countback3', 'countback1', 'tie'],
    rounds: (opts.rounds ?? [0]).map((index) => ({ index })),
    entries: playerIds.map((playerId) => ({
      playerId, teeSetKey: 'mens' as const, status: opts.statuses?.[playerId] ?? 'active',
    })),
    players: Object.fromEntries(playerIds.map((id, i) => [id, { id, name: `Игрок ${id}`, hi: [0, 18, 36, -2][i % 4] }])),
    teams: [], flights: [], teeTimes: [], joinCode: 'TEST26',
  };
}

const fill = (n: number, v: number, extra: Record<number, HoleScore> = {}) => {
  const m: Record<number, HoleScore> = {};
  for (let i = 1; i <= n; i++) m[i] = { strokes: v };
  return { ...m, ...extra };
};

describe('leaderboard: stroke play', () => {
  it('toPar-сортировка; равные 72/72 решает countback по последним 9 (RULES §11, FORMATS №9)', () => {
    const t = mkTournament(['a', 'b']);
    const scores: RoundScores[] = [{
      a: fill(18, 4), // 72, last9=36
      b: { ...fill(9, 5), ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 10, { strokes: 3 }])) }, // 45+27=72, last9=27
    }];
    const lb = buildLeaderboard({ tournament: t, scores, mode: 'gross' });
    expect(lb.rows[0].playerId).toBe('b');
    expect(lb.rows[0].pos).toBe(1);
    expect(lb.rows[1].pos).toBe(2);
    expect(lb.rows[0].tied).toBe(false);
  });

  it('полные равные карточки → T-позиции (tie)', () => {
    const t = mkTournament(['a', 'b', 'c']);
    const scores: RoundScores[] = [{ a: fill(18, 4), b: fill(18, 4), c: fill(18, 5) }];
    const lb = buildLeaderboard({ tournament: t, scores, mode: 'gross' });
    expect(lb.rows[0].pos).toBe(1);
    expect(lb.rows[1].pos).toBe(1);
    expect(lb.rows[0].tied).toBe(true);
    expect(lb.rows[2].pos).toBe(3);
  });

  it('thru/todayToPar по текущему раунду; НЕсыгранные лунки не считаются', () => {
    const t = mkTournament(['a', 'b']);
    const scores: RoundScores[] = [{ a: fill(5, 4), b: fill(9, 5) }];
    const lb = buildLeaderboard({ tournament: t, scores, mode: 'gross' });
    const a = lb.rows.find((r) => r.playerId === 'a')!;
    const b = lb.rows.find((r) => r.playerId === 'b')!;
    expect(a.thru).toBe(5);
    expect(a.todayToPar).toBe(0);
    expect(b.thru).toBe(9);
    expect(b.todayToPar).toBe(9);
  });

  it('multi-round: итог суммируется по раундам (FORMATS №10 прекондишн)', () => {
    const t = mkTournament(['a', 'b'], { rounds: [0, 1] });
    const scores: RoundScores[] = [
      { a: fill(18, 4), b: fill(18, 5) },
      { a: fill(18, 5), b: fill(18, 4) },
    ];
    const lb = buildLeaderboard({ tournament: t, scores, mode: 'gross' });
    const a = lb.rows.find((r) => r.playerId === 'a')!;
    expect(a.totalGross).toBe(72 + 90);
    expect(a.rounds.length).toBeGreaterThan(1);
    // 162 vs 162 → решает countback финального (2-го) раунда: b лучше
    expect(lb.rows[0].playerId).toBe('b');
  });

  it('фильтр раунда roundIndex', () => {
    const t = mkTournament(['a', 'b'], { rounds: [0, 1] });
    const scores: RoundScores[] = [
      { a: fill(18, 4), b: fill(18, 5) },
      { a: fill(18, 6), b: fill(18, 4) },
    ];
    const lb = buildLeaderboard({ tournament: t, scores, mode: 'gross', roundIndex: 1 });
    expect(lb.rows[0].playerId).toBe('b');
    const a = lb.rows.find((r) => r.playerId === 'a')!;
    expect(a.totalGross).toBe(108);
  });

  it('DQ исключён из зачёта в inactive, счёт сохранён (RULES §8, FORMATS №10)', () => {
    const t = mkTournament(['a', 'b', 'c'], { statuses: { c: 'dq' } });
    const scores: RoundScores[] = [
      { a: fill(18, 4), b: fill(18, 5), c: fill(18, 3) },
      { a: fill(18, 5), b: fill(18, 4) },
    ].concat([{ a: fill(18, 5), b: fill(18, 4) }]) as RoundScores[];
    const t2 = { ...t, rounds: [0, 1].map((index) => ({ index })) };
    const lb = buildLeaderboard({ tournament: t2, scores, mode: 'gross' });
    expect(lb.rows.some((r) => r.playerId === 'c')).toBe(false);
    const c = lb.inactive.find((r) => r.playerId === 'c')!;
    expect(c.status).toBe('dq');
    expect(c.rounds[0].gross).toBe(54); // первый раунд сохранён в архиве
    expect(c.rounds[1]?.playedHoles ?? 0).toBe(0);
  });

  it('PH считается через tee set и allowance (hi 18, slope 113, cr 72, par 72, allowance 1 → PH 18)', () => {
    const t = mkTournament(['a', 'b']);
    const lb = buildLeaderboard({ tournament: t, scores: [{ a: fill(18, 4) }], mode: 'gross' });
    const b = lb.rows.find((r) => r.playerId === 'b')!; // hi 18 (i=1)
    expect(b.ph).toBe(18);
  });

  it('net-режим: нетто упорядочивание', () => {
    const t = mkTournament(['a', 'b']);
    const scores: RoundScores[] = [{ a: fill(18, 4), b: fill(18, 5) }]; // a: hi0 net 72; b: hi18 net 90-18=72
    const lb = buildLeaderboard({ tournament: t, scores, mode: 'net' });
    // оба netToPar = 0 → countback по нетто: b последние 9: 4 net на лунку=0? b gross5−1=4 =E; a 4=E → T
    expect(lb.rows[0].pos).toBe(1);
    expect(lb.rows[1].pos).toBe(1);
  });
});

describe('leaderboard: stableford', () => {
  it('points: сортировка по убыванию очков; pickup=0', () => {
    const t = mkTournament(['a', 'b'], { format: 'stableford' });
    (t as Tournament).allowance = 1;
    const scores: RoundScores[] = [{
      a: fill(18, 4),               // hi 0 → 2 очка/лунка = 36 (18 лунок по 2)
      b: fill(18, 4, { 18: { pickup: true } }), // hi 18: 3 очка/лунка ×17 + 0
    }];
    const lb = buildLeaderboard({ tournament: t, scores, mode: 'points' });
    const a = lb.rows.find((r) => r.playerId === 'a')!;
    const b = lb.rows.find((r) => r.playerId === 'b')!;
    expect(b.totalPoints).toBe(17 * 3);
    expect(a.totalPoints).toBe(36);
    expect(lb.rows[0].playerId).toBe('b');
  });
});

describe('countbackCompare граничные случаи', () => {
  const mkSummary = (backNine: number, frontNine = 36) => {
    // раунд: первые 9 = frontNine (по 4), последние 9 — кастом
    const scores: Record<number, HoleScore> = {};
    for (let i = 1; i <= 9; i++) scores[i] = { strokes: frontNine / 9 };
    const per = backNine / 9;
    for (let i = 10; i <= 18; i++) scores[i] = { strokes: per };
    const holes = Array.from({ length: 18 }, (_, i) => ({ n: i + 1, par: 4 as const, si: i + 1, lengths: {} }));
    return summarizeRound(scores, { holes, ph: 0 });
  };
  it('points-режим: больше очков = лучше', () => {
    const a = mkSummary(27); // birdies
    const b = mkSummary(36);
    expect(countbackCompare(a, b, 9, 'gross')).toBeLessThan(0);
    expect(countbackCompare(b, a, 9, 'gross')).toBeGreaterThan(0);
  });
  it('пустой срез → равенство', () => {
    const holes = [{ n: 1, par: 4 as const, si: 1, lengths: {} }];
    const e = summarizeRound({}, { holes, ph: 0 });
    expect(countbackCompare(e, e, 9, 'gross')).toBe(0);
  });
});
