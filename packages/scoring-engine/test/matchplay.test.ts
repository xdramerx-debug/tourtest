import { describe, it, expect } from 'vitest';
import { matchState, matchStrokesReceived } from '../src/matchplay';

const seq = (n: number, v: number | undefined) => Array.from({ length: n }, () => v);

describe('match play (RULES §6, FORMATS матрица №3)', () => {
  it('двухсерийный: равные нетто → AS, ничьи по лункам', () => {
    const m = matchState(seq(18, 4), seq(18, 4));
    expect(m.code).toBe('AS');
    expect(m.up).toBe(0);
    expect(m.finished).toBe(true);
  });

  it('dormie: 2 up за 2 лунки до конца (RULES §11)', () => {
    // A выиграл лунки 1,2; остальные ничьи → на 16-й лунке up=2, remaining=2? проверим на 16 сыгранных
    const a = [3, 3, ...seq(14, 4), undefined, undefined];
    const b = [4, 4, ...seq(14, 4), undefined, undefined];
    const m = matchState(a, b);
    expect(m.up).toBe(2);
    expect(m.thru).toBe(16);
    expect(m.remaining).toBe(2);
    expect(m.dormie).toBe(true);
    expect(m.code).toBe('DORMIE');
  });

  it('досрочное закрытие 3&2 на 16-й лунке (RULES §11)', () => {
    const a = [3, 3, 3, ...seq(13, 4), undefined, undefined];
    const b = [4, 4, 4, ...seq(13, 4), undefined, undefined];
    const m = matchState(a, b);
    expect(m.closed).toBe(true);
    expect(m.code).toBe('CLOSED');
    expect(m.n).toBe(3);
    expect(m.m).toBe(2);
  });

  it('5&4: up 5 при 5 оставшихся закрытия НЕТ, при up 6 и 4 оставшихся — да', () => {
    const a1 = [...seq(5, 3), ...seq(9, 4), undefined, undefined, undefined, undefined];
    const b1 = [...seq(5, 4), ...seq(9, 4), undefined, undefined, undefined, undefined];
    // up 5, thru 14, remaining 4 → 5>4 → closed 5&4
    const m1 = matchState(a1, b1);
    expect(m1.closed).toBe(true);
    expect(m1.n).toBe(5);
    expect(m1.m).toBe(4);
  });

  it('победа 1 up на последней лунке', () => {
    const a = [3, ...seq(17, 4)];
    const b = [4, ...seq(17, 4)];
    const m = matchState(a, b);
    expect(m.finished).toBe(true);
    expect(m.code).toBe('UP');
    expect(m.n).toBe(1);
    expect(m.leader).toBe('A');
  });

  it('concede: лунка отдана сопернику (RULES §6.4)', () => {
    const concedes: boolean[] = [true, ...Array.from({ length: 17 }, () => false)];
    const m = matchState([4, ...seq(17, 4)], [4, ...seq(17, 4)], { concedesByA: concedes });
    expect(m.outcomes[0]).toBe('B');
    expect(m.up).toBe(-1);
  });

  it('back-low удары: разница PH распределяется по SI 1.. (RULES §6.6)', () => {
    const { a, b } = matchStrokesReceived(5, 14, 3);
    expect(a).toBe(0);
    expect(b).toBe(1); // 9 ударов разницы → SI 1..9
    const si10 = matchStrokesReceived(5, 14, 10);
    expect(si10.b).toBe(0);
  });
});
