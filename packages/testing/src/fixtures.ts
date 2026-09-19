import type {
  CourseSpec, Entry, FormatConfig, HoleSpec, Player, Team, Tournament,
} from '@csl/core';

/** Детерминированный seeded RNG (mulberry32) — воспроизводимые фикстуры и симуляции. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Александр', 'Дмитрий', 'Сергей', 'Андрей', 'Михаил', 'Иван', 'Павел', 'Николай', 'Ольга', 'Елена', 'Анна', 'Мария', 'Татьяна', 'Наталья', 'Виктор', 'Олег', 'Константин', 'Владимир', 'Ирина', 'Светлана', 'Юрий', 'Максим', 'Екатерина', 'Роман'];
const LAST = ['Соколов', 'Лебедев', 'Волков', 'Морозов', 'Павлов', 'Семенов', 'Голубев', 'Виноградов', 'Богданов', 'Воробьев', 'Федоров', 'Михайлов', 'Беляев', 'Тарасов', 'Белов', 'Комаров', 'Орлов', 'Киселев', 'Макаров', 'Захаров', 'Романов', 'Ершов', 'Никитин', 'Смирнов'];

export function playerName(i: number): string {
  return `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + 3) % LAST.length]}`;
}

/** Тестовое 18-луночное поле с покрытием паров 3/4/5 и SI 1..18. */
export function buildCourse(id = 'course-1', name = 'Дубровка Парк'): CourseSpec {
  const pars: Array<3 | 4 | 5> = [4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4];
  const siOrder = [7, 3, 15, 9, 1, 17, 5, 11, 13, 8, 16, 4, 2, 12, 18, 10, 6, 14];
  const holes: HoleSpec[] = pars.map((par, i) => ({
    n: i + 1,
    par,
    si: siOrder[i],
    lengths: {
      championship: par === 3 ? 172 : par === 4 ? 396 : 512,
      mens: par === 3 ? 158 : par === 4 ? 364 : 472,
      womens: par === 3 ? 128 : par === 4 ? 312 : 402,
      senior: par === 3 ? 138 : par === 4 ? 330 : 428,
      junior: par === 3 ? 96 : par === 4 ? 240 : 330,
    },
  }));
  return {
    id, name, holes, revision: 1,
    teeSets: [
      { key: 'championship', label: 'Чемпионские', cr: 73.8, slope: 134 },
      { key: 'mens', label: 'Мужские', cr: 71.2, slope: 126 },
      { key: 'womens', label: 'Женские', cr: 72.6, slope: 128 },
      { key: 'senior', label: 'Сеньорные', cr: 70.4, slope: 121 },
      { key: 'junior', label: 'Юниорские', cr: 68.9, slope: 112 },
    ],
  };
}

export interface FixtureOpts {
  players?: number;
  format?: FormatConfig['id'];
  rounds?: number;
  flights?: number;
  teams?: number;           // размер команды 0 = без команд
  withScores?: number;      // доля игроков со счётом (0..1)
  holesPlayed?: number;     // лунок сыграно (для live-фикстур)
  seed?: number;
}

export function buildFixtureTournament(opts: FixtureOpts = {}): Tournament {
  const {
    players: playerCount = 144, format = 'stroke', rounds = 1,
    flights = 4, teams: teamSize = 0, seed = 7,
  } = opts;
  const rng = mulberry32(seed);
  const course = buildCourse();

  const players: Record<string, Player> = {};
  const entries: Entry[] = [];
  const hiList: { playerId: string; hi: number }[] = [];
  for (let i = 0; i < playerCount; i++) {
    const id = `p${i + 1}`;
    const hi = Math.round((0.4 + rng() * 35) * 10) / 10;
    players[id] = { id, name: playerName(i), hi };
    hiList.push({ playerId: id, hi });
  }
  hiList.sort((a, b) => a.hi - b.hi);

  // флайты — тем же алгоритмом, что в engine (границы по разрывам HI)
  const flightsCount = Math.min(flights, Math.max(1, playerCount));
  const flightList: Tournament['flights'] = flightsCount > 1
    ? (() => {
      const per = Math.ceil(hiList.length / flightsCount);
      const out: Tournament['flights'] = [];
      for (let f = 0; f < flightsCount; f++) {
        const chunk = hiList.slice(f * per, (f + 1) * per);
        if (!chunk.length) continue;
        out.push({ id: 'ABCDEF'[f], name: `Флайт ${'ABCDEF'[f]}`, hiFrom: chunk[0].hi, hiTo: chunk[chunk.length - 1].hi });
      }
      return out;
    })()
    : [];

  const teamList: Team[] = [];
  if (teamSize >= 2) {
    const perTeam = teamSize;
    for (let t = 0; t * perTeam < hiList.length; t++) {
      const members = hiList.slice(t * perTeam, (t + 1) * perTeam).map((x) => x.playerId);
      if (members.length < 2) break;
      teamList.push({
        id: `team-${t + 1}`,
        name: `Команда ${t + 1}`,
        memberIds: members,
        captainId: members[0],
      });
    }
  }

  const teeKeys = ['championship', 'mens', 'mens', 'womens', 'senior'] as const;
  hiList.forEach((x, i) => {
    const team = teamList.find((t) => t.memberIds.includes(x.playerId));
    entries.push({
      playerId: x.playerId,
      teeSetKey: teeKeys[i % teeKeys.length],
      flightId: flightList.find((f) => x.hi >= f.hiFrom && x.hi <= f.hiTo)?.id,
      teamId: team?.id,
      status: 'active',
    });
  });

  const out: Tournament = {
    id: 't-open',
    name: format === 'scramble' ? 'Корпоративный кубок' : format === 'skins' ? 'Вечерний скинс' : 'Кубок клуба',
    status: 'live',
    course,
    format: {
      id: format,
      netEnabled: format === 'stroke',
      skinsMode: 'net', skinsCarryover: true,
      bestN: format === 'teamagg' ? 2 : 1,
    },
    allowance: format === 'stableford' ? 1 : 0.95,
    tieBreak: ['countback9', 'countback6', 'countback3', 'countback1', 'tie'],
    rounds: Array.from({ length: rounds }, (_, i) => ({ index: i, date: `2026-09-${19 + i}` })),
    entries,
    players,
    teams: teamList,
    flights: flightList,
    teeTimes: [],
    joinCode: 'OPEN26',
  };

  return out;
}

/** Правдоподобный счёт раунда: матожидание par + hi/18, плюс шум. */
export function buildScoresForRound(t: Tournament, opts: { roundIndex?: number; holesPlayed?: number; seed?: number; onlyActive?: boolean } = {}) {
  const { roundIndex = 0, holesPlayed = 18, seed = 42 } = opts;
  const rng = mulberry32(seed);
  const scores: Record<string, Record<number, { strokes: number }>> = {};
  const order = t.course.holes.slice(0, holesPlayed);
  for (const e of t.entries) {
    if (e.status !== 'active') continue;
    const p = t.players[e.playerId];
    const perHole = p.hi / 18;
    const m: Record<number, { strokes: number }> = {};
    for (const h of order) {
      const base = h.par + perHole;
      const noise = rng();
      const strokes = Math.max(1, Math.round(base + (noise - 0.5) * 2.4));
      m[h.n] = { strokes };
    }
    scores[e.playerId] = m;
  }
  return scores;
}
