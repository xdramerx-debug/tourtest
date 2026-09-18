// Внутренний реэкспорт доменных типов (изоляция графа импортов: engine → core только типы).
export type {
  Entry, Flight, FormatConfig, HoleScore, HoleSpec, Id, Player, RoundScores, StablefordTable, Team, TeeSet, Tournament,
} from '@csl/core';

// Заглушка-алиас на будущую materialized-модель (ARCHITECTURE.md §4).
export interface Leaderboard {
  tournamentId: string;
  computedAt: number;
}
