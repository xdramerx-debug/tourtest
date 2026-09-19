/**
 * Доменная модель ClubScore Live (ARCHITECTURE.md §4, RULES.md, FORMATS.md).
 * Единственная форма изменения счёта — ScoreAction (идемпотентно, аудируемо).
 */

export type Id = string;

export type Role = 'player' | 'marker' | 'captain' | 'referee' | 'spectator' | 'admin';

export const ROLE_RANK: Record<Role, number> = {
  spectator: 0, player: 1, captain: 2, marker: 3, referee: 4, admin: 5,
};

export type Locale = 'ru' | 'en';

export interface Club {
  id: Id;
  name: string;
  logo?: string;
  brand: { color?: string };
  locale: Locale;
  tz: string;            // IANA, напр. "Europe/Moscow"
  units: 'metric' | 'imperial';
}

// --- Поле -------------------------------------------------------------
export type TeeSetKey = 'championship' | 'mens' | 'womens' | 'senior' | 'junior' | 'custom';

export interface HoleSpec {
  n: number;             // 1..36
  par: 3 | 4 | 5;
  si: number;            // stroke index, уникален в пределах девятки
  lengths: Partial<Record<TeeSetKey, number>>; // метры (хранение; отображение по units клуба)
}

export interface TeeSet { key: TeeSetKey; label: string; cr: number; slope: number }

export interface CourseSpec {
  id: Id;
  name: string;
  holes: HoleSpec[];     // 9/18/27/36, упорядочены по n — порядок = порядок игры
  teeSets: TeeSet[];
  revision: number;
}

// --- Форматы (FORMATS.md) ---------------------------------------------
export type FormatId =
  | 'stroke' | 'stableford' | 'match' | 'fourball' | 'foursome'
  | 'scramble' | 'bestball' | 'betterball' | 'skins' | 'teamagg';

/** Таблица модифицированного стабилфорда: [альбатрос-, игл, бёрди, пар, боги, дабл+] */
export type StablefordTable = [number, number, number, number, number, number];
export const STABLEFORD_DEFAULT: StablefordTable = [5, 4, 3, 2, 1, 0];

export interface FormatConfig {
  id: FormatId;
  /** stroke: вести нетто-зачёт параллельно */
  netEnabled?: boolean;
  stablefordTable?: StablefordTable;
  /** match/fourball: политика ничьей после 18 */
  halvedPolicy?: 'halved' | 'sudden_death' | 'last_n';
  suddenDeathHoles?: number[];
  /** skins */
  skinsMode?: 'net' | 'gross';
  skinsPot?: number[];    // единицы pot по лункам (по умолчанию 1)
  skinsCarryover?: boolean;
  /** bestball: число лучших мячей (1|2); teamagg: N лучших нетто в раунде */
  bestN?: number;
  /** командные: минимум выбранных мячей игрока (scramble rule) */
  minDrivesPerPlayer?: number;
}

export type TieBreakRule = 'countback9' | 'countback6' | 'countback3' | 'countback1' | 'tie';
export const DEFAULT_TIEBREAK: TieBreakRule[] = ['countback9', 'countback6', 'countback3', 'countback1', 'tie'];

// --- Игроки и турнир ----------------------------------------------------
export interface Player {
  id: Id;
  name: string;
  hi: number;            // локальный handicap index (RULES §4.4)
  teePref?: TeeSetKey;
}

export type EntryStatus = 'active' | 'dq' | 'wd' | 'dns';

export interface Entry {
  playerId: Id;
  teeSetKey: TeeSetKey;
  flightId?: Id;
  teamId?: Id;
  status: EntryStatus;
  statusReason?: string;
}

export interface Team { id: Id; name: string; memberIds: Id[]; captainId?: Id }
export interface Flight { id: Id; name: string; hiFrom: number; hiTo: number }
export interface TeeTime { time: string; tee: number; playerIds: Id[] }

export interface RoundSpec { index: number; date?: string; holeOrder?: number[] }

export interface Tournament {
  id: Id;
  name: string;
  status: 'draft' | 'registration' | 'live' | 'finished' | 'archived';
  course: CourseSpec;
  format: FormatConfig;
  allowance: number;                    // 0.05..1.0 (RULES §4.2)
  tieBreak: TieBreakRule[];
  rounds: RoundSpec[];
  entries: Entry[];
  players: Record<Id, Player>;
  teams: Team[];
  flights: Flight[];
  teeTimes: TeeTime[];
  joinCode: string;
  commentaryFeed?: CommentaryEvent[];
}

// --- Счёт ---------------------------------------------------------------
export interface HoleScore {
  /** удары без штрафных; undefined = не введено */
  strokes?: number;
  /** штрафные удары (RULES §1.2) */
  penalties?: number;
  /** мяч подобран (RULES §7) */
  pickup?: boolean;
  /** лунка уступлена соперником (match, RULES §6.4) */
  conceded?: boolean;
  note?: string;
}

/** scores[roundIndex][playerId|teamId][hole] */
export type RoundScores = Record<Id, Record<number, HoleScore>>;

export interface CommentaryEvent {
  id: string; ts: number; kind: 'eagle' | 'lead' | 'skin' | 'match' | 'status' | 'info';
  text: { ru: string; en: string }; playerId?: Id;
}

// --- Действия счёта (sync-конверт; RULES-аудит) --------------------------
export type ActionType =
  | 'score.set' | 'score.pickup' | 'score.penalty' | 'score.concede'
  | 'score.clear' | 'entry.status' | 'match.result';

export interface ScoreAction {
  actionId: string;                    // uuid — идемпотентность (NFR §3)
  type: ActionType;
  tournamentId: Id;
  roundIndex: number;
  playerId?: Id;                       // для scramble — teamId вместо этого
  teamId?: Id;
  hole?: number;
  payload: {
    strokes?: number; penalties?: number; note?: string;
    status?: EntryStatus; reason?: string;
  };
  authorId: Id;
  authorRole: Role;
  deviceId: string;
  clientTs: number;                    // мс, клиентские часы (конфликт-резолвер)
  lamport: number;
  supersedesActionId?: string;
}
