import type { RoundSummary } from './scores';

/**
 * Countback (RULES §9.1): сравнение по последним 9/6/3/1 лунках финального раунда.
 * Метрика — сумма «относительно пара»: gross/net −3.. или очки stableford.
 * Ниже лучше для gross/net, выше лучше для points.
 * Возврат: <0 — a лучше, 0 — равны, >0 — b лучше.
 */
export function countbackCompare(
  a: RoundSummary,
  b: RoundSummary,
  n: 9 | 6 | 3 | 1,
  mode: 'gross' | 'net' | 'points',
): number {
  const metric = (s: RoundSummary): number | null => {
    const played = s.byHole.filter((h) => h.played);
    const slice = played.slice(-n);
    if (slice.length === 0) return null;
    let sum = 0;
    let used = 0;
    for (const h of slice) {
      if (mode === 'points') {
        if (h.points == null) continue;
        sum += h.points;
      } else {
        const v = mode === 'gross' ? h.gross : h.net;
        if (v == null) continue;
        sum += v - h.par;
      }
      used += 1;
    }
    return used === 0 ? null : sum;
  };
  const ma = metric(a);
  const mb = metric(b);
  if (ma == null && mb == null) return 0;
  if (ma == null) return 1;
  if (mb == null) return -1;
  if (ma === mb) return 0;
  if (mode === 'points') return ma > mb ? -1 : 1;
  return ma < mb ? -1 : 1;
}

export function ruleToN(rule: string): 9 | 6 | 3 | 1 | null {
  if (rule === 'countback9') return 9;
  if (rule === 'countback6') return 6;
  if (rule === 'countback3') return 3;
  if (rule === 'countback1') return 1;
  return null;
}
