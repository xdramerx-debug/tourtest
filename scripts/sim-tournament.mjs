#!/usr/bin/env node
/**
 * Нагрузочная симуляция (NFR §1, SUCCESS): 144 игрока × 18 лунок, пачки действий,
 * замер пересчёта лидерборда (цель ≤ 2 с на обновление; расчёт без сети — чистый движок).
 * node scripts/sim-tournament.mjs [players]
 */
import { performance } from 'node:perf_hooks';
import { buildFixtureTournament, buildScoresForRound } from '../packages/testing/src/index.ts';
import { Projection } from '../packages/sync/src/projection.ts';
import { buildLeaderboard } from '../packages/scoring-engine/src/index.ts';

const PLAYERS = Number(process.argv[2] ?? 144);
const tournament = buildFixtureTournament({ players: PLAYERS, format: 'stroke', rounds: 1, flights: 4, seed: 5 });
const scores = buildScoresForRound(tournament, { holes: 9, seed: 3 });

// 1) Разворачиваем ScoreBook в поток ScoreAction (как пришло бы с устройств)
const projection = new Projection();
let lamport = 0;
const actions = [];
for (const [pid, cells] of Object.entries(scores)) {
  for (const [hole, cell] of Object.entries(cells)) {
    actions.push({
      actionId: `sim-${pid}-${hole}`, type: 'score.set', tournamentId: tournament.id,
      roundIndex: 0, playerId: pid, hole: Number(hole), payload: { strokes: cell.strokes },
      authorId: pid, authorRole: 'marker', deviceId: 'sim', clientTs: Date.now(), lamport: ++lamport,
    });
  }
}
let t0 = performance.now();
for (const a of actions) projection.apply(a);
const applyMs = performance.now() - t0;

// 2) Лидерборд: buildLeaderboard на каждое обновление (как в UI)
t0 = performance.now();
const REBUILDS = 50;
let lb = null;
for (let i = 0; i < REBUILDS; i++) {
  lb = buildLeaderboard({ tournament, scores: projection.scores, mode: 'gross', roundIndex: 'all' });
}
const lbMs = (performance.now() - t0) / REBUILDS;

const total = actions.length;
console.log(JSON.stringify({
  players: PLAYERS, actions: total,
  ingestPerActionMs: +(applyMs / total).toFixed(3),
  leaderboardRebuildMs: +lbMs.toFixed(2),
  rows: lb.rows.length,
  leaderboardBudgetMs: 2000,
  ok: lbMs < 2000 && applyMs / total < 2,
}, null, 2));
process.exit(lbMs < 2000 ? 0 : 1);
