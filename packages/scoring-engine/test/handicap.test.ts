import { describe, it, expect } from 'vitest';
import { courseHandicap, playingHandicap, strokesReceived, courseHandicap9, strokesMap } from '../src/handicap';

describe('RULES §11 — эталонные вычисления гандикапа', () => {
  it('CH: HI 18.0, Slope 131, CR 72.4, Par 72 → 21', () => {
    expect(courseHandicap(18.0, { slope: 131, cr: 72.4 }, 72)).toBe(21);
  });
  it('PH: CH 21 × allowance 0.95 → 20', () => {
    expect(playingHandicap(21, 0.95)).toBe(20);
  });
  it('PH: full allowance', () => {
    expect(playingHandicap(21, 1)).toBe(21);
  });
  it('плюсовой гандикап: HI −2, slope 113, CR == Par → CH −2', () => {
    expect(courseHandicap(-2, { slope: 113, cr: 72 }, 72)).toBe(-2);
  });
  it('strokesReceived: PH 20 → +1 на всех, +2 на SI 1..2', () => {
    expect(strokesReceived(20, 1)).toBe(2);
    expect(strokesReceived(20, 2)).toBe(2);
    expect(strokesReceived(20, 3)).toBe(1);
    expect(strokesReceived(20, 18)).toBe(1);
  });
  it('strokesReceived: PH 36 → +2 везде', () => {
    for (let si = 1; si <= 18; si++) expect(strokesReceived(36, si)).toBe(2);
  });
  it('strokesReceived: PH −2 → снятие с SI 18 и 17', () => {
    expect(strokesReceived(-2, 18)).toBe(-1);
    expect(strokesReceived(-2, 17)).toBe(-1);
    expect(strokesReceived(-2, 16)).toBe(0);
    expect(strokesReceived(-2, 1)).toBe(0);
  });
  it('strokesReceived: PH 0 → 0', () => {
    for (let si = 1; si <= 18; si++) expect(strokesReceived(0, si)).toBe(0);
  });
  it('9 лунок: CH_9 = round((HI/2)(Slope/113) + CR − Par)', () => {
    expect(courseHandicap9(18.0, { slope: 113, cr: 36.2 }, 36)).toBe(Math.round(9 + 0.2));
  });
  it('strokesMap покрывает все лунки', () => {
    const m = strokesMap([{ n: 1, si: 5 }, { n: 2, si: 1 }], 19);
    expect(m).toEqual({ 1: 1, 2: 2 });
  });
});
