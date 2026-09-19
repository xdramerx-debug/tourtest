import type { FormatId, ScoreAction, Tournament } from '@csl/core';
import { mulberry32, buildFixtureTournament, buildScoresForRound } from '@csl/testing';
import { Projection } from './projection';
import type { Snapshot, StreamFrame, Transport } from './transport';

export interface DemoOptions {
  tournamentId: string;
  format?: FormatId;
  players?: number;
  flights?: number;
  teams?: number;
  rounds?: number;
  seed?: number;
  /** сколько лунок сыграно к старту показа */
  startProgress?: number;
  /** авто-симуляция остальных игроков (live-демо) */
  simulate?: boolean;
  tickMs?: number;
  persistKey?: string;
}

/**
 * DemoTransport — «сервер в браузере» (ARCHITECTURE §12, решение D8):
 * та же Projection и резолвер, что у боевого сервера; источник правды — локальный журнал
 * событий (localStorage), боты двигают турнир, ввод игрока переживает перезагрузку.
 */
export class DemoTransport implements Transport {
  readonly mode = 'demo' as const;
  tournamentId: string;
  private opts: Required<Omit<DemoOptions, 'tournamentId' | 'persistKey'>> & Pick<DemoOptions, 'persistKey'>;
  private projection = new Projection();
  private tournament!: Tournament;
  private listeners = new Set<(f: StreamFrame) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private log: ScoreAction[] = [];

  constructor(o: DemoOptions) {
    this.tournamentId = o.tournamentId;
    this.opts = {
      format: o.format ?? 'stroke', players: o.players ?? 144, flights: o.flights ?? 4,
      teams: o.teams ?? 0, rounds: o.rounds ?? 1, seed: o.seed ?? 7,
      startProgress: o.startProgress ?? 9, simulate: o.simulate ?? true, tickMs: o.tickMs ?? 4000,
      persistKey: o.persistKey,
    };
  }

  private get key() { return this.opts.persistKey ?? `csl.demo.${this.tournamentId}`; }

  async connect(): Promise<Snapshot> {
    const o = this.opts;
    this.tournament = buildFixtureTournament({
      players: o.players, format: o.format, rounds: o.rounds,
      flights: o.flights, teams: o.teams, seed: o.seed,
    });
    this.tournament.id = this.tournamentId;

    // Пользовательские данные из админки-демо (USER_FLOWS F3/F6):
    // - переопределение поля (курс-редактор) — csl.course.override
    // - турнир, созданный мастером (импортированные игроки) — csl.tournament.<id>
    try {
      if (typeof localStorage !== 'undefined') {
        const custom = localStorage.getItem(`csl.tournament.${this.tournamentId}`);
        if (custom) {
          const parsed = JSON.parse(custom) as Partial<Tournament>;
          this.tournament = { ...this.tournament, ...parsed, course: this.tournament.course } as Tournament;
        }
        const courseOverride = localStorage.getItem('csl.course.override');
        if (courseOverride) {
          const c = JSON.parse(courseOverride) as Tournament['course'];
          this.tournament = { ...this.tournament, course: c };
        }
      }
    } catch { /* битые данные пользователя игнорируем */ }

    // 1) Восстановление журнала (переживает перезагрузку — F1, E7)
    const persisted = this.readLog();
    if (persisted.length) {
      this.log = persisted;
      for (const a of persisted) this.projection.apply(a);
    } else {
      // 2) Исходный прогресс: детерминированно засеваем счёт ботов
      const rng = mulberry32(o.seed * 131 + 1);
      const pre = buildScoresForRound(this.tournament, { roundIndex: 0, holesPlayed: o.startProgress, seed: o.seed * 17 });
      for (const e of this.tournament.entries) {
        const cells = pre[e.playerId];
        if (!cells) continue;
        if (rng() < 0.35) continue; // часть поля ещё не стартовала/играет позже
        for (const [holeStr, cell] of Object.entries(cells)) {
          const hole = Number(holeStr);
          this.applyLocal(this.mkBotAction(e.playerId, hole, cell.strokes, rng));
        }
      }
    }
    if (o.simulate) this.startSim();
    return this.snapshot();
  }

  private mkBotAction(playerId: string, hole: number, strokes: number, rng: () => number): ScoreAction {
    return {
      actionId: `bot-${playerId}-${hole}-${Math.floor(rng() * 1e9).toString(36)}`,
      type: 'score.set', tournamentId: this.tournamentId, roundIndex: 0, playerId, hole,
      payload: { strokes }, authorId: `bot`, authorRole: 'player',
      deviceId: 'sim', clientTs: Date.now(), lamport: 0,
    };
  }

  private applyLocal(a: ScoreAction) {
    const r = this.projection.apply(a);
    if (r.result !== 'duplicate' && r.result !== 'overridden') this.log.push(a);
    return r;
  }

  private startSim() {
    const o = this.opts;
    const rng = mulberry32(Date.now() % 2147483647);
    this.timer = setInterval(() => {
      const active = this.tournament.entries.filter((e) => e.status === 'active');
      if (!active.length) return;
      // выбираем игрока с наименьшим прогрессом (поле двигается равномерно)
      const cand = active[Math.floor(rng() * active.length)];
      const holes = this.tournament.course.holes;
      const cells = this.projection.scores[0]?.[cand.playerId] ?? {};
      let next = 0;
      for (const h of holes) {
        const c = cells[h.n];
        if (!c || (c.strokes == null && !c.pickup)) { next = h.n; break; }
      }
      if (!next) return; // раунд завершён
      const p = this.tournament.players[cand.playerId];
      const hSpec = holes.find((h) => h.n === next)!;
      const exp = hSpec.par + p.hi / 18;
      const strokes = Math.max(1, Math.round(exp + (rng() - 0.45) * 2.6));
      const action = this.mkBotAction(cand.playerId, next, strokes, rng);
      action.authorId = cand.playerId;
      const res = this.applyLocal(action);
      if (res.result !== 'duplicate') {
        this.emit({ kind: 'delta', events: [action], seq: this.projectionSeq(), serverTs: Date.now() });
        this.persist();
      }
    }, o.tickMs);
  }

  private projectionSeq() { return this.projection.snapshot().seq; }

  snapshot(): Snapshot {
    return {
      tournament: this.tournament,
      projection: this.projection.snapshot(),
      seq: this.projectionSeq(),
    };
  }



  async push(batch: ScoreAction[]) {
    const applied: string[] = [];
    for (const a of batch) {
      const r = this.applyLocal({ ...a });
      applied.push(a.actionId);
      void r;
    }
    this.emit({ kind: 'delta', events: batch, seq: this.projectionSeq(), serverTs: Date.now() });
    this.emit({ kind: 'ack', actionIds: applied, seq: this.projectionSeq(), serverTs: Date.now() });
    this.persist();
    return { ok: true, applied };
  }

  subscribe(cb: (frame: StreamFrame) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(frame: StreamFrame) {
    this.listeners.forEach((cb) => setTimeout(() => cb(frame), 5));
  }

  setCheckpoint() { /* seq ведётся projection */ }

  destroy() { if (this.timer) clearInterval(this.timer); }

  private readLog(): ScoreAction[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as ScoreAction[]) : [];
    } catch { return []; }
  }
  private persist() {
    try {
      if (typeof localStorage === 'undefined') return;
      // храним журнал (хвост — до 20k событий; турнир 144×18×3 ≈ 7.8k)
      localStorage.setItem(this.key, JSON.stringify(this.log.slice(-20000)));
    } catch { /* квота кончилась — живём в памяти, счёт всё равно в очереди */ }
  }
}


