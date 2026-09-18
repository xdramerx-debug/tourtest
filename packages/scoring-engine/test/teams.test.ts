import { describe, it, expect } from 'vitest';
import { allocateSkins } from '../src/skins';
import { bestBallHoles, foursomePairCH, fourballPlayingHandicaps, scramblePlayingHandicap, teamAggregateRound } from '../src/team';
import { splitFlights, assignFlights } from '../src/flights';

describe('skins (FORMATS §9, матрица №6)', () => {
  it('единственный лучший забирает pot; равенство → carryover ×3 и разыгрыш', () => {
    const r = allocateSkins([
      { id: 'a', values: [4, 4, 4, 3] },
      { id: 'b', values: [4, 4, 4, 5] },
      { id: 'c', values: [4, 4, 4, 6] },
    ], { carryover: true });
    // лунки 1-3 ничья → carry; 4-ю выигрывает a с pot 4
    expect(r.holeResults[0].carry).toBe(true);
    expect(r.holeResults[1].carry).toBe(true);
    expect(r.holeResults[2].carry).toBe(true);
    expect(r.holeResults[3].winner).toBe('a');
    expect(r.holeResults[3].pot).toBe(4);
    expect(r.totals.a).toEqual({ skins: 1, units: 4 });
  });

  it('неразыгранный carryover в конце → unallocated (делёж клубом)', () => {
    const r = allocateSkins([
      { id: 'a', values: [4, 4] },
      { id: 'b', values: [4, 4] },
    ]);
    expect(r.unallocated).toBe(2);
  });

  it('carryover off → pot сгорает при ничьей', () => {
    const r = allocateSkins([
      { id: 'a', values: [4, 3] },
      { id: 'b', values: [4, 4] },
    ], { carryover: false });
    expect(r.holeResults[1].pot).toBe(1);
    expect(r.totals.a.units).toBe(1);
  });

  it('per-hole pot (возрастающий)', () => {
    const r = allocateSkins([
      { id: 'a', values: [4, 4, 3] },
      { id: 'b', values: [4, 4, 4] },
    ], { pot: [1, 2, 4] });
    expect(r.holeResults[2].pot).toBe(7);
  });
});

describe('командные форматы (FORMATS §5–§8, §10, матрица №4,№5,№7,№8)', () => {
  it('scramble PH по весам 4 игроков: 0.25/0.20/0.15/0.10 от низшего', () => {
    expect(scramblePlayingHandicap([10, 20, 30, 40])).toBe(Math.round(10 * 0.25 + 20 * 0.2 + 30 * 0.15 + 40 * 0.1));
    expect(scramblePlayingHandicap([40, 10, 30, 20])).toBe(Math.round(10 * 0.25 + 20 * 0.2 + 30 * 0.15 + 40 * 0.1));
  });
  it('scramble размер 2 и 3', () => {
    expect(scramblePlayingHandicap([10, 20])).toBe(Math.round(10 * 0.35 + 20 * 0.15));
    expect(scramblePlayingHandicap([10, 20, 30])).toBe(Math.round(10 * 0.3 + 20 * 0.2 + 30 * 0.1));
  });
  it('scramble: неверный размер команды — ошибка', () => {
    expect(() => scramblePlayingHandicap([10])).toThrow();
    expect(() => scramblePlayingHandicap([1, 2, 3, 4, 5])).toThrow();
  });

  it('best ball: лучший мяч на лунке; undefined если никто не сыграл', () => {
    expect(bestBallHoles([[4, 5, undefined], [undefined, undefined, undefined]], 1)).toEqual([4, undefined]);
  });
  it('better ball парный зачёт = best 1 из 2', () => {
    expect(bestBallHoles([[4, 5]], 1)).toEqual([4]);
  });
  it('team aggregate 2-из-4: сумма двух лучших и toPar с паром ×2 (матрица №7)', () => {
    const r = teamAggregateRound([[4, 5, 6, 4], [5, 5, 4, 7]], [4, 5], 2);
    expect(r.byHole).toEqual([8, 9]);
    expect(r.toPar).toBe(8 - 8 + (9 - 10));
  });

  it('foursome PH пары = ½ суммы CH', () => {
    expect(foursomePairCH(10, 15)).toBe(13);
    expect(foursomePairCH(10, 14)).toBe(12);
  });

  it('fourball: allowance 0.9 от нижнего PH четвёрки', () => {
    const ph = fourballPlayingHandicaps([5, 10, 15, 20]);
    const scaled = [5, 10, 15, 20].map((c) => Math.round(c * 0.9));
    const low = Math.min(...scaled);
    expect(ph).toEqual(scaled.map((x) => x - low));
    expect(Math.min(...ph)).toBe(0);
  });
});

describe('флайты (VARIANTS B2)', () => {
  it('разбивка по HI: A самый сильный, равные HI не делятся', () => {
    const items = [
      { playerId: 'p1', hi: 1 }, { playerId: 'p2', hi: 1 },
      { playerId: 'p3', hi: 10 }, { playerId: 'p4', hi: 20 },
      { playerId: 'p5', hi: 20 }, { playerId: 'p6', hi: 30 },
    ];
    const flights = splitFlights(items, 2);
    expect(flights.length).toBe(2);
    // граница не режет пару hi=20
    const f1 = flights[0]; const f2 = flights[1];
    expect(f1.hiTo).toBeLessThanOrEqual(f2.hiFrom);
    const assigned = assignFlights(items, flights);
    expect(assigned.p5).toBe(assigned.p4);
  });
  it('144 игрока → 4 флайта сбалансированы ±N и покрывают всех', () => {
    const items = Array.from({ length: 144 }, (_, i) => ({ playerId: `p${i}`, hi: 0.5 + (i * 0.25) }));
    const flights = splitFlights(items, 4);
    expect(flights.length).toBe(4);
    const sizes = flights.map((f, i) => {
      const from = f.hiFrom; const to = f.hiTo;
      return items.filter((x) => x.hi >= from && x.hi <= to && (i === 0 || x.hi > flights[i - 1].hiTo)).length;
    });
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(2);
  });
});
