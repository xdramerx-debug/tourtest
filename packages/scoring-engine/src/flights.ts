import type { Flight, Id } from './types-proxy';

/**
 * Флайты (VARIANTS B2, FORMATS): разбивка игроков по HI на N флайтов.
 * - сортировка по HI по убыванию (A — самый сильный);
 * - равные по HI не растаскиваются по разным флайтам (авто-баланс по границе разрыва);
 * - размеры сбалансированы (±1), границы фиксируются в hiFrom/hiTo.
 */
export function splitFlights(
  items: { playerId: Id; hi: number }[],
  count: number,
  names = 'ABCDEF',
): Flight[] {
  if (count < 1 || items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.hi - b.hi);
  const n = sorted.length;
  const base = Math.floor(n / count);
  const rem = n % count;

  const bounds: Array<[number, number]> = []; // [start, end) индексы
  let start = 0;
  for (let f = 0; f < count && start < n; f++) {
    let size = base + (f < rem ? 1 : 0);
    let end = Math.min(start + size, n);
    // авто-баланс: не делить игроков с одинаковым HI — расширяем или ужимаем границу
    while (end < n && sorted[end - 1].hi === sorted[end].hi) end += 1;
    bounds.push([start, end]);
    start = end;
  }
  // догон: остаток в последний флайт
  if (bounds.length && start < n) bounds[bounds.length - 1][1] = n;

  return bounds
    .filter(([s, e]) => e > s)
    .map(([s, e], i) => ({
      id: names[i] ?? String(i + 1),
      name: `Флайт ${names[i] ?? i + 1}`,
      hiFrom: sorted[s].hi,
      hiTo: sorted[e - 1].hi,
    }));
}

/** Раскидать entries по флайтам (детерминированно, id флайта = буква). */
export function assignFlights(
  items: { playerId: Id; hi: number }[],
  flights: Flight[],
): Record<Id, Id> {
  const out: Record<Id, Id> = {};
  for (const it of items) {
    const f = flights.find((x) => it.hi >= x.hiFrom && it.hi <= x.hiTo) ?? flights[flights.length - 1];
    if (f) out[it.playerId] = f.id;
  }
  return out;
}
