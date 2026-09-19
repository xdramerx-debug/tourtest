import type {
  Entry, Id, Leaderboard as LeaderboardAlias, RoundScores, Tournament,
} from './types-proxy';
import { courseHandicap, playingHandicap } from './handicap';
import { summarizeRound, type RoundContext, type RoundSummary } from './scores';
import { countbackCompare, ruleToN } from './countback';

export type BoardMode = 'gross' | 'net' | 'points';

export interface LeaderboardRow {
  playerId: Id;
  name: string;
  hi: number;
  flightId?: Id;
  status: Entry['status'];
  statusReason?: string;
  rounds: RoundSummary[];
  thru: number;
  todayToPar: number;
  totalGross: number;
  totalNet: number;
  totalToPar: number;
  totalNetToPar: number;
  totalPoints: number;
  playedHoles: number;
  ph: number;
  pos: number;
  tied: boolean;
}

export interface LeaderboardResult {
  rows: LeaderboardRow[];
  inactive: LeaderboardRow[];       // DQ/WD/DNS (RULES §8 — отдельная секция)
  computedAt: number;
}

export type { LeaderboardAlias };

export function courseParOf(t: Tournament, roundIndex?: number): number {
  const order = holeOrderOf(t, roundIndex ?? t.rounds[0]?.index ?? 0);
  return order.reduce((s, h) => s + h.par, 0);
}

export function holeOrderOf(t: Tournament, roundIndex: number) {
  const spec = t.rounds.find((r) => r.index === roundIndex);
  if (spec?.holeOrder?.length) {
    const byNum = new Map(t.course.holes.map((h) => [h.n, h]));
    return spec.holeOrder.map((n) => byNum.get(n)!).filter(Boolean);
  }
  return t.course.holes;
}

export function playingHandicapOf(t: Tournament, playerId: Id, roundIndex: number): number {
  const entry = t.entries.find((e) => e.playerId === playerId);
  const player = t.players[playerId];
  if (!entry || !player) return 0;
  const tee = t.course.teeSets.find((ts) => ts.key === entry.teeSetKey) ?? t.course.teeSets[0];
  const par = courseParOf(t, roundIndex);
  const ch = courseHandicap(player.hi, tee, par);
  return playingHandicap(ch, t.allowance);
}

function emptyRow(t: Tournament, playerId: Id): LeaderboardRow {
  const p = t.players[playerId];
  const e = t.entries.find((x) => x.playerId === playerId);
  return {
    playerId, name: p?.name ?? playerId, hi: p?.hi ?? 0,
    flightId: e?.flightId, status: e?.status ?? 'active', statusReason: e?.statusReason,
    rounds: [], thru: 0, todayToPar: 0,
    totalGross: 0, totalNet: 0, totalToPar: 0, totalNetToPar: 0, totalPoints: 0,
    playedHoles: 0, ph: 0, pos: 0, tied: false,
  };
}

interface BuildArgs {
  tournament: Tournament;
  scores: RoundScores[];                 // индекс = roundIndex
  mode: BoardMode;
  roundIndex?: number | 'all';
}

export function buildLeaderboard({ tournament: t, scores, mode, roundIndex = 'all' }: BuildArgs): LeaderboardResult {
  const roundIdxs = roundIndex === 'all'
    ? t.rounds.map((r) => r.index)
    : [roundIndex];

  const rows: LeaderboardRow[] = [];
  const inactive: LeaderboardRow[] = [];

  for (const e of t.entries) {
    const row = emptyRow(t, e.playerId);
    const ph = playingHandicapOf(t, e.playerId, roundIdxs[0] ?? 0);
    row.ph = ph;

    for (const ri of roundIdxs) {
      const holes = holeOrderOf(t, ri);
      const ctx: RoundContext = {
        holes, ph,
        capNDB: t.format.id === 'stroke' || t.format.id === 'stableford' ? true : false,
        stablefordTable: t.format.stablefordTable,
      };
      const summary = summarizeRound(scores[ri]?.[e.playerId], ctx);
      row.rounds[ri] = summary;
      row.totalGross += summary.gross;
      row.totalNet += summary.net;
      row.totalToPar += summary.toPar;
      row.totalNetToPar += summary.netToPar;
      row.totalPoints += summary.points;
      row.playedHoles += summary.playedHoles;
    }

    // «текущий» раунд: последний с playedHoles>0, иначе первый
    let cur = roundIdxs[0] ?? 0;
    for (const ri of roundIdxs) if ((row.rounds[ri]?.playedHoles ?? 0) > 0) cur = ri;
    row.thru = row.rounds[cur]?.thru ?? 0;
    row.todayToPar = row.rounds[cur]?.toPar ?? 0;

    (e.status === 'active' ? rows : inactive).push(row);
  }

  const key = (r: LeaderboardRow) =>
    mode === 'points' ? -r.totalPoints : mode === 'net' ? r.totalNetToPar : r.totalToPar;

  rows.sort((a, b) => {
    const ka = key(a); const kb = key(b);
    if (ka !== kb) return ka - kb;
    // цепочка тай-брейков (RULES §9): countback по последнему раунду
    const lastR = roundIdxs[roundIdxs.length - 1] ?? 0;
    for (const rule of t.tieBreak.length ? t.tieBreak : []) {
      const n = ruleToN(rule);
      if (n == null) return 0; // 'tie'
      const ra = a.rounds[lastR];
      const rb = b.rounds[lastR];
      if (!ra || !rb) continue;
      const c = countbackCompare(ra, rb, n, mode === 'points' ? 'points' : mode);
      if (c !== 0) return c;
    }
    return 0;
  });

  // позиции с T (ничьи после всех тай-брейков): сравнение соседних строк в отсортированном списке
  let lastKey = Number.NaN;
  let lastPos = 0;
  rows.forEach((r, i) => {
    const k = key(r);
    if (i > 0 && k === lastKey && tieEqual(rows[i - 1], r, t, roundIdxs, mode)) {
      r.pos = lastPos;
      r.tied = true;
      rows[i - 1].tied = true;
    } else {
      r.pos = i + 1;
      lastPos = i + 1;
    }
    lastKey = k;
  });

  return { rows, inactive, computedAt: Date.now() };
}

function tieEqual(a: LeaderboardRow, b: LeaderboardRow, t: Tournament, roundIdxs: number[], mode: BoardMode): boolean {
  const lastR = roundIdxs[roundIdxs.length - 1] ?? 0;
  for (const rule of t.tieBreak.length ? t.tieBreak : ['tie' as const]) {
    const n = ruleToN(rule);
    if (n == null) return true;
    const ra = a.rounds[lastR]; const rb = b.rounds[lastR];
    if (!ra || !rb) continue;
    if (countbackCompare(ra, rb, n, mode === 'points' ? 'points' : mode) !== 0) return false;
  }
  return true;
}
