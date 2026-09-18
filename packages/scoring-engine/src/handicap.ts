/**
 * Гандикап-математика (RULES.md §3–§4, WHS-совместимые формулы, локальное применение).
 */

/** CH = round(HI × Slope/113 + (CR − Par)). */
export function courseHandicap(hi: number, tee: { slope: number; cr: number }, coursePar: number): number {
  return Math.round((hi * tee.slope) / 113 + (tee.cr - coursePar));
}

/** PH = round(CH × allowance). */
export function playingHandicap(ch: number, allowance: number): number {
  return Math.round(ch * allowance);
}

/**
 * Удары, получаемые на лунке с данным SI при playing handicap PH (RULES §3.2).
 * PH>0: удары с лунки SI=1 вверх. PH<0 (плюсовый): снятие с SI=18 вниз.
 */
export function strokesReceived(ph: number, si: number, holes = 18): number {
  if (ph === 0) return 0;
  const sign = ph > 0 ? 1 : -1;
  const r = Math.abs(ph);
  const base = Math.floor(r / holes);
  const extra = r % holes;
  let e = 0;
  if (sign > 0) e = si <= extra ? 1 : 0;
  else e = holes + 1 - si <= extra ? 1 : 0;
  const v = sign * (base + e);
  return v === 0 ? 0 : v; // нормализация -0
}

/** Маркировка лунок, где игрок получает удары (для UI-звёздочек). */
export function strokesMap(holeSpecs: { n: number; si: number }[], ph: number, holes = 18): Record<number, number> {
  const out: Record<number, number> = {};
  for (const h of holeSpecs) out[h.n] = strokesReceived(ph, h.si, holes);
  return out;
}

/** CH/PH для 9-луночного раунда (RULES §4.3). */
export function courseHandicap9(hi: number, tee: { slope: number; cr: number }, par9: number): number {
  return Math.round((hi / 2) * (tee.slope / 113) + (tee.cr - par9));
}
