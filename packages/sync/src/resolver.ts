import { ROLE_RANK, type ScoreAction } from '@csl/core';

export const CONFLICT_WINDOW_MS = 5000;

/**
 * Конфликт-резолвер (NFR §3, ARCHITECTURE §6.3). Детерминирован, общий для клиента и сервера.
 * Победа: бóльший clientTs; в окне ±5 с — старшая роль (referee > marker > captain > player);
 * далее — бóльший lamport; далее — лексикографически бóльший actionId (полная детерминированность).
 * Возврат: >0 — `a` побеждает `b`.
 */
export function compareActions(a: ScoreAction, b: ScoreAction): number {
  const dt = a.clientTs - b.clientTs;
  if (Math.abs(dt) > CONFLICT_WINDOW_MS) return dt;
  const rr = ROLE_RANK[a.authorRole] - ROLE_RANK[b.authorRole];
  if (rr !== 0) return rr;
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  if (a.clientTs !== b.clientTs) return dt; // равная роль — поздний из двух
  return a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0;
}

/** Ячейка, которую мутирует действие (для per-cell LWW). */
export function cellKeyOf(a: ScoreAction): string {
  const who = a.playerId ?? a.teamId ?? '-';
  const aspect = a.type.startsWith('score.') || a.type === 'match.result' ? 'score' : 'entry';
  const hole = a.hole ?? 0;
  return `${a.roundIndex}|${who}|${hole}|${aspect}`;
}
