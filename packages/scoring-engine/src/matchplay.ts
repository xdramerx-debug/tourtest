/**
 * Match play — статусная машина (RULES §6).
 * Чистая функция от нетто-результатов лунок двух сторон (плюс conceded-флаги).
 */

export type HoleOutcome = 'A' | 'B' | 'H' | null;

export interface MatchState {
  outcomes: HoleOutcome[];
  /** >0 — лидирует A, <0 — лидирует B */
  up: number;
  thru: number;
  remaining: number;
  closed: boolean;   // закрыт досрочно (up > remaining)
  finished: boolean; // все лунки учтены или закрыт
  dormie: boolean;
  leader: 'A' | 'B' | null;
  /** 'A/S' | '2 UP' | '3&2' | 'DORMIE 1' … — для локализации UI переводит код */
  code: 'AS' | 'UP' | 'CLOSED' | 'DORMIE';
  n: number; // величина up для UP/DORMIE, величина "N&M".n для CLOSED
  m?: number;
}

export function matchState(
  aNets: Array<number | undefined>,
  bNets: Array<number | undefined>,
  opts: { concedesByA?: boolean[]; concedesByB?: boolean[] } = {},
): MatchState {
  const holes = Math.max(aNets.length, bNets.length);
  const outcomes: HoleOutcome[] = [];
  let up = 0;
  let thru = 0;
  let closed = false;

  for (let i = 0; i < holes; i++) {
    const remaining0 = holes - i;
    if (closed) { outcomes.push(null); continue; }
    let out: HoleOutcome = null;
    if (opts.concedesByA?.[i]) out = 'B';
    else if (opts.concedesByB?.[i]) out = 'A';
    else {
      const a = aNets[i];
      const b = bNets[i];
      if (a != null && b != null) out = a < b ? 'A' : a > b ? 'B' : 'H';
    }
    outcomes.push(out);
    if (out === 'A') up += 1;
    else if (out === 'B') up -= 1;
    if (out !== null) {
      thru = i + 1;
      const remainingAfter = remaining0 - 1;
      // закрытие: up > оставшихся, и это НЕ последняя лунка (иначе — обычный финиш "N up")
      if (Math.abs(up) > remainingAfter && remainingAfter > 0) closed = true;
    }
  }
  if (closed) {
    // пересчёт: закрытие фиксируется на лунке, где |up| > remaining после неё
    let u = 0; thru = 0; up = 0;
    for (let i = 0; i < holes; i++) {
      const o = outcomes[i];
      if (o === 'A') u += 1; else if (o === 'B') u -= 1;
      if (o !== null) {
        thru = i + 1;
        up = u;
        if (Math.abs(u) > holes - thru && holes - thru > 0) break;
      }
    }
  }

  const remaining = holes - thru;
  const finished = closed || thru >= holes;
  const absUp = Math.abs(up);
  const dormie = !finished && absUp === remaining && remaining > 0;

  let code: MatchState['code'] = 'AS';
  let m: number | undefined;
  if (closed) { code = 'CLOSED'; m = remaining; }
  else if (dormie) code = 'DORMIE';
  else if (absUp > 0) code = 'UP';

  return {
    outcomes, up, thru, remaining, closed, finished, dormie,
    leader: up > 0 ? 'A' : up < 0 ? 'B' : null,
    code, n: absUp, m,
  };
}

/** Удары в гандикап-матче: от нижнего PH (back-low, RULES §6.6). */
export function matchStrokesReceived(phA: number, phB: number, si: number, holes = 18) {
  const low = Math.min(phA, phB);
  const dA = phA - low;
  const dB = phB - low;
  const sr = (r: number) => {
    const base = Math.floor(r / holes);
    const extra = r % holes;
    return base + (si <= extra ? 1 : 0);
  };
  return { a: sr(dA), b: sr(dB) };
}
