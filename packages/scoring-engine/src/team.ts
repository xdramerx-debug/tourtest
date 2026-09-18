/**
 * Командные форматы (FORMATS §6–§10). Все функции чистые.
 */

const SCRAMBLE_WEIGHTS: Record<number, number[]> = {
  2: [0.35, 0.15],
  3: [0.30, 0.20, 0.10],
  4: [0.25, 0.20, 0.15, 0.10],
};

/** Командный playing handicap для scramble (веса от низшего CH, FORMATS §6). */
export function scramblePlayingHandicap(chs: number[]): number {
  const w = SCRAMBLE_WEIGHTS[chs.length];
  if (!w) throw new Error(`scramble team size must be 2..4, got ${chs.length}`);
  const sorted = [...chs].sort((a, b) => a - b);
  return Math.round(sorted.reduce((s, c, i) => s + c * w[i], 0));
}

/**
 * Best ball / better ball: лучшие N значений на каждой лунке (FORMATS §7–§8).
 * members[h][playerIdx] — нетто участников на лунке h (undefined — не сыграно).
 * Возврат: по лункам сумма N лучших (или undefined, если никто не сыграл).
 */
export function bestBallHoles(members: Array<Array<number | undefined>>, nBest = 1): Array<number | undefined> {
  return members.map((vals) => {
    const defined = vals.filter((v): v is number => v != null).sort((a, b) => a - b);
    if (defined.length < nBest) return defined.length === 0 ? undefined : defined.slice(0, nBest).reduce((a, b) => a + b, 0);
    return defined.slice(0, nBest).reduce((a, b) => a + b, 0);
  });
}

/** Team Aggregate: сумма N лучших нетто раунда по лункам → командный итог toPar. */
export function teamAggregateRound(
  members: Array<Array<number | undefined>>,
  pars: number[],
  nBest: number,
): { byHole: Array<number | undefined>; total: number; toPar: number } {
  const byHole = bestBallHoles(members, nBest);
  let total = 0;
  let toPar = 0;
  byHole.forEach((v, i) => {
    if (v != null) {
      total += v;
      toPar += v - nBest * pars[i]; // N лучших суммируются → пар тоже ×N
    }
  });
  return { byHole, total, toPar };
}

/** Foursome: гандикап пары = ½ суммы CH (FORMATS §5). */
export function foursomePairCH(chA: number, chB: number): number {
  return Math.round((chA + chB) / 2);
}

/** Fourball strokes: от нижнего PH четвёрки с allowance (FORMATS §4). */
export function fourballPlayingHandicaps(chs: number[], allowance = 0.9): number[] {
  const phs = chs.map((c) => Math.round(c * allowance));
  const low = Math.min(...phs);
  return phs.map((p) => p - low);
}
