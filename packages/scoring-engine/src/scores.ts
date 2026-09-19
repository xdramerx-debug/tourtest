import type { HoleScore, HoleSpec, StablefordTable } from '@csl/core';
import { STABLEFORD_DEFAULT } from '@csl/core';
import { strokesReceived } from './handicap';

/** Итоговые удары лунки: базовые + штрафные (RULES §1.2). pickup/concede → undefined. */
export function grossOf(s: HoleScore | undefined): number | undefined {
  if (!s) return undefined;
  if (s.pickup || s.conceded) return undefined;
  if (s.strokes == null) return undefined;
  return s.strokes + (s.penalties ?? 0);
}

/** Очки стабилфорда по разнице «нетто − пар» (RULES §5, таблица настраивается). */
export function stablefordPoints(diff: number, table: StablefordTable = STABLEFORD_DEFAULT): number {
  if (diff <= -3) return table[0];
  if (diff === -2) return table[1];
  if (diff === -1) return table[2];
  if (diff === 0) return table[3];
  if (diff === 1) return table[4];
  return table[5];
}

export interface HoleResult {
  hole: number;
  par: number;
  si: number;
  strokesReceived: number;
  rawGross?: number;    // введённый счёт (до cap)
  gross?: number;       // учётный (после NDB-cap)
  net?: number;
  points?: number;
  played: boolean;
  pickup: boolean;
  conceded: boolean;
}

export interface RoundSummary {
  byHole: HoleResult[];
  gross: number;        // сумма учётных gross по сыгранным
  net: number;
  toPar: number;        // Σ(gross − par) по сыгранным
  netToPar: number;     // Σ(net − par) по сыгранным
  points: number;
  thru: number;         // префикс завершённых лунок подряд (RULES §1.5)
  playedHoles: number;
  parPlayed: number;
}

export interface RoundContext {
  holes: HoleSpec[];    // игровой порядок
  ph: number;
  capNDB?: boolean;     // Net Double Bogey cap (RULES §7.2, по умолчанию вкл в клубе)
  stablefordTable?: StablefordTable;
}

const EMPTY: RoundSummary = {
  byHole: [], gross: 0, net: 0, toPar: 0, netToPar: 0, points: 0, thru: 0, playedHoles: 0, parPlayed: 0,
};

export function summarizeRound(
  scoreMap: Record<number, HoleScore> | undefined,
  ctx: RoundContext,
): RoundSummary {
  if (!scoreMap && ctx.holes.length === 0) return EMPTY;
  const byHole: HoleResult[] = [];
  let thru = 0;
  let stopped = false;
  let gross = 0, net = 0, toPar = 0, netToPar = 0, points = 0, playedHoles = 0, parPlayed = 0;

  for (const h of ctx.holes) {
    const s = scoreMap?.[h.n];
    const played = !!s && (s.pickup === true || s.conceded === true || s.strokes != null);
    if (!played) stopped = true;
    else if (!stopped) thru += 1;

    const sr = strokesReceived(ctx.ph, h.si);
    const raw = grossOf(s);
    let g = raw;
    if (raw != null && ctx.capNDB) g = Math.min(raw, h.par + 2 + sr);
    const n = g != null ? g - sr : undefined;
    let pts: number | undefined;
    if (played) {
      if (s?.pickup && !s?.conceded) pts = 0; // RULES §5.3
      else if (n != null) pts = stablefordPoints(n - h.par, ctx.stablefordTable);
      else pts = 0;
    }

    if (played) {
      playedHoles += 1;
      parPlayed += h.par;
      if (g != null) { gross += g; toPar += g - h.par; }
      if (n != null) { net += n; netToPar += n - h.par; }
      if (pts != null) points += pts;
    }
    byHole.push({
      hole: h.n, par: h.par, si: h.si, strokesReceived: sr,
      rawGross: raw, gross: g, net: n, points: pts,
      played, pickup: s?.pickup === true, conceded: s?.conceded === true,
    });
  }
  return { byHole, gross, net, toPar, netToPar, points, thru, playedHoles, parPlayed };
}
