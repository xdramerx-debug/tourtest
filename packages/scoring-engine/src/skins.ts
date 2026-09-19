import type { Id } from './types-proxy';

export interface SkinHoleResult {
  hole: number;
  winner?: Id;
  pot: number;         // разыграно на этой лунке (с учётом переноса)
  carry: boolean;      // ушло в carryover
}

export interface SkinsResult {
  holeResults: SkinHoleResult[];
  totals: Record<Id, { skins: number; units: number }>;
  unallocated: number; // неразыгранный carryover (делёж — решение клуба, FORMATS §9)
}

/**
 * Skins (FORMATS §9): единственный лучший результат на лунке забирает pot,
 * равенство лучших → перенос (если carryover), иначе pot сгорает/делится (pot=0).
 * nets[i] — значения (net или gross) по лункам; undefined — лунка не сыграна.
 */
export function allocateSkins(
  players: { id: Id; values: Array<number | undefined> }[],
  opts: { pot?: number[]; carryover?: boolean } = {},
): SkinsResult {
  const carryover = opts.carryover !== false;
  const holes = Math.max(...players.map((p) => p.values.length), 0);
  const holeResults: SkinHoleResult[] = [];
  const totals: Record<Id, { skins: number; units: number }> = {};
  for (const p of players) totals[p.id] = { skins: 0, units: 0 };

  let acc = 0;
  let unallocated = 0;
  for (let h = 0; h < holes; h++) {
    const basePot = opts.pot?.[h] ?? 1;
    acc += basePot;
    let best = Number.POSITIVE_INFINITY;
    let winners: Id[] = [];
    for (const p of players) {
      const v = p.values[h];
      if (v == null) continue;
      if (v < best) { best = v; winners = [p.id]; }
      else if (v === best) winners.push(p.id);
    }
    if (winners.length === 1 && best !== Number.POSITIVE_INFINITY) {
      const w = winners[0];
      totals[w].skins += 1;
      totals[w].units += acc;
      holeResults.push({ hole: h + 1, winner: w, pot: acc, carry: false });
      acc = 0;
    } else if (best === Number.POSITIVE_INFINITY) {
      // лунка никем не сыграна — pot не накапливается
      acc -= basePot;
      holeResults.push({ hole: h + 1, pot: 0, carry: false });
    } else {
      holeResults.push({ hole: h + 1, pot: 0, carry: carryover && acc > 0 });
      if (!carryover) acc = 0;
    }
  }
  unallocated = acc;
  return { holeResults, totals, unallocated };
}
