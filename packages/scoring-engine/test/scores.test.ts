import { describe, it, expect } from 'vitest';
import type { HoleScore, HoleSpec } from '@csl/core';
import { grossOf, stablefordPoints, summarizeRound } from '../src/scores';

const holes18: HoleSpec[] = Array.from({ length: 18 }, (_, i) => ({
  n: i + 1, par: (i % 6 === 2 ? 3 : i % 6 === 4 ? 5 : 4) as 3 | 4 | 5, si: i + 1, lengths: {},
}));

const allPars = holes18.map((h) => ({ ...h, par: 4 as const }));

describe('scores: grossOf / штрафы (RULES §1.2)', () => {
  it('штрафы включаются в итог лунки', () => {
    expect(grossOf({ strokes: 4, penalties: 2 })).toBe(6);
  });
  it('pickup/conceded/пусто → undefined', () => {
    expect(grossOf({ pickup: true })).toBeUndefined();
    expect(grossOf({ conceded: true })).toBeUndefined();
    expect(grossOf({})).toBeUndefined();
    expect(grossOf(undefined)).toBeUndefined();
  });
});

describe('stableford points (RULES §5.1, §11)', () => {
  it.each([
    [-4, 5], [-3, 5], [-2, 4], [-1, 3], [0, 2], [1, 1], [2, 0], [5, 0],
  ])('diff %i → %i очков', (d, p) => {
    expect(stablefordPoints(d)).toBe(p);
  });
  it('модифицированная таблица [8,5,3,0,-1,-3]', () => {
    const t: [number, number, number, number, number, number] = [8, 5, 3, 0, -1, -3];
    expect(stablefordPoints(-3, t)).toBe(8);
    expect(stablefordPoints(0, t)).toBe(0);
    expect(stablefordPoints(2, t)).toBe(-3);
  });
});

describe('summarizeRound', () => {
  it('pickup = 0 очков, Thru продвигается (FORMATS матрица №1)', () => {
    const scores: Record<number, HoleScore> = { 1: { strokes: 4 }, 2: { pickup: true }, 3: { strokes: 3 } };
    const s = summarizeRound(scores, { holes: holes18.slice(0, 3), ph: 18 });
    expect(s.byHole[1].points).toBe(0);
    expect(s.thru).toBe(3);
    expect(s.playedHoles).toBe(3);
  });

  it('NDB cap: 10 ударов на пар-4 с ударом → учётные 7 (RULES §11)', () => {
    const s = summarizeRound({ 1: { strokes: 10 } }, { holes: [allPars[0]], ph: 1, capNDB: true });
    expect(s.byHole[0].rawGross).toBe(10);
    expect(s.byHole[0].gross).toBe(7); // par 4 + 2 + 1 удар
    expect(s.byHole[0].net).toBe(6);
  });

  it('без cap — учитывается введённый счёт', () => {
    const s = summarizeRound({ 1: { strokes: 10 } }, { holes: [allPars[0]], ph: 1, capNDB: false });
    expect(s.byHole[0].gross).toBe(10);
  });

  it('net = gross − удары; нетто пар−1 с ударом → 3 очка (RULES §11)', () => {
    // gross 4 на пар-4 (дубл. нет) — возьмём gross 4, sr 1 → net 3 → diff −1 → 3 очка
    const s = summarizeRound({ 1: { strokes: 4 } }, { holes: [allPars[0]], ph: 18 });
    expect(s.byHole[0].net).toBe(3);
    expect(s.byHole[0].points).toBe(3);
  });

  it('thru — префикс сыгранных подряд; пропуск останавливает (RULES §1.5)', () => {
    const scores: Record<number, HoleScore> = { 1: { strokes: 4 }, 3: { strokes: 5 } };
    const s = summarizeRound(scores, { holes: holes18.slice(0, 4), ph: 0 });
    expect(s.thru).toBe(1);
    expect(s.playedHoles).toBe(2);
    expect(s.toPar).toBe(0 + 2); // E на 1-й (пар 4), +2 на 3-й (пар 3!)
  });

  it('полный раунд: суммы gross/net/toPar/points согласованы', () => {
    const scores: Record<number, HoleScore> = {};
    for (const h of holes18) scores[h.n] = { strokes: h.par }; // весь раунд в пар
    const s = summarizeRound(scores, { holes: holes18, ph: 9 });
    expect(s.gross).toBe(s.parPlayed);
    expect(s.toPar).toBe(0);
    expect(s.thru).toBe(18);
    expect(s.points).toBeGreaterThan(18 * 2); // с 9 ударами очков больше 2/лунка
  });

  it('пустой/неполный ввод — без NaN, playedHoles=0', () => {
    const s = summarizeRound(undefined, { holes: holes18, ph: 0 });
    expect(s.playedHoles).toBe(0);
    expect(s.gross).toBe(0);
    expect(s.thru).toBe(0);
  });
});
