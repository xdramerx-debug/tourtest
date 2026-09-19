import type { Tournament, FormatId, Player, Entry, Flight, TeeSetKey } from '@csl/core';
import { buildCourse } from '@csl/testing';
import type { DemoTournamentInfo } from '../../config';

const KEY = 'csl.customTournaments';

export interface CustomTournamentRecord {
  info: DemoTournamentInfo & { name: { ru: string; en: string } };
  tournament: Tournament;
}

/** Турниры, созданные мастером (USER_FLOWS F3) — витринное хранилище браузера. */
export function extraTournaments(): DemoTournamentInfo[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as CustomTournamentRecord[]).map((r) => r.info);
  } catch { return []; }
}

export function saveCustomTournament(input: {
  name: string;
  format: FormatId;
  allowance: number;
  flights: number;
  players: { name: string; hi: number; teeSetKey?: TeeSetKey; flightId?: string }[];
  status?: 'registration' | 'live';
}): CustomTournamentRecord {
  const id = `t-custom-${Date.now().toString(36)}`;
  const players: Record<string, Player> = {};
  const entries: Entry[] = [];
  input.players.forEach((p, i) => {
    const pid = `cp${i + 1}`;
    players[pid] = { id: pid, name: p.name, hi: p.hi };
    entries.push({ playerId: pid, teeSetKey: p.teeSetKey ?? 'mens', status: 'active', flightId: p.flightId });
  });
  const flights: Flight[] = input.flights > 0
    ? Array.from({ length: input.flights }, (_, i) => ({
        id: `F${String.fromCharCode(65 + i)}`, name: `Flight ${String.fromCharCode(65 + i)}`, hiFrom: i * 12, hiTo: i * 12 + 11.9,
      }))
    : [];
  const tournament: Tournament = {
    id,
    name: input.name,
    status: input.status ?? 'live',
    course: buildCourse('course-1', 'Дубровка Парк'),
    format: { id: input.format, netEnabled: input.format === 'stroke' },
    allowance: input.allowance,
    tieBreak: ['countback9', 'countback6', 'countback3', 'countback1', 'tie'],
    rounds: [{ index: 0, date: new Date().toISOString().slice(0, 10) }],
    entries, players, teams: [], flights, teeTimes: [],
    joinCode: Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, '7').slice(0, 6),
  };
  const info: DemoTournamentInfo = {
    id, format: input.format,
    name: { ru: input.name, en: input.name },
    status: tournament.status as 'live',
    players: entries.length, flights: input.flights, teams: 0, rounds: 1, startProgress: 0,
  };
  const rec: CustomTournamentRecord = { info, tournament };
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as CustomTournamentRecord[]) : [];
    list.push(rec);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-8)));
    // и сам турнир для DemoTransport-override
    localStorage.setItem(`csl.tournament.${id}`, JSON.stringify(tournament));
  } catch { /* quota */ }
  return rec;
}
