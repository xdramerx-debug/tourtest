import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  EntryStatus, HoleScore, Id, Role, RoundScores, ScoreAction, TeeSetKey, Tournament,
} from '@csl/core';
import { Projection, type AuditEntry, type ProjectionSnapshot } from './projection';
import { SyncQueue, Sender, type ActionStore, MemoryStore, DexieStore } from './queue';
import type { Transport } from './transport';

export type ConnState = 'connecting' | 'online' | 'offline';

export interface SessionInfo {
  token: string;
  role: Role;
  name: string;
  playerId?: Id;
  teeSetKey?: TeeSetKey;
  asMarker?: boolean;
}

export interface TourneyState {
  tournament: Tournament | null;
  scores: RoundScores[];
  statusByPlayer: ProjectionSnapshot['statusByPlayer'];
  audit: AuditEntry[];
  seq: number;
  lastServerTs: number;
  status: ConnState;
  queued: number;
  session: SessionInfo | null;
}

export interface CreateStoreOpts {
  transport: Transport;
  store?: ActionStore;
  sessionStorageKey?: string;
  /** колбэк для тестов/метрик: замеры свежести лидерборда */
  onDelta?: (latencyMs: number) => void;
}

export type TourneyStore = StoreApi<TourneyState> & {
  connect(): Promise<void>;
  setScore(playerId: Id, hole: number, strokes: number, note?: string): ScoreAction;
  setPickup(playerId: Id, hole: number): ScoreAction;
  setPenalty(playerId: Id, hole: number, penalties: number): ScoreAction;
  clearHole(playerId: Id, hole: number): ScoreAction;
  concede(playerId: Id, hole: number): ScoreAction;
  setStatus(playerId: Id, status: EntryStatus, reason: string): ScoreAction;
  join(input: { code: string; name: string; hi: number; teeSetKey: TeeSetKey; asMarker: boolean }): { ok: boolean; error?: string };
  /** Демо-вход судьи/админа (прод — server auth; NFR §6). */
  loginAs(role: Role, name: string): void;
  logout(): void;
  destroy(): void;
};

const uuid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function createTournamentStore(opts: CreateStoreOpts): TourneyStore {
  const hasIdb = typeof indexedDB !== 'undefined';
  const queue = new SyncQueue(opts.store ?? (hasIdb ? new DexieStore() : new MemoryStore()));
  const projection = new Projection();
  let lamport = 0;
  let destroyFns: Array<() => void> = [];
  const deviceId = (() => {
    try {
      const k = 'csl.device';
      const v = localStorage.getItem(k) ?? uuid();
      localStorage.setItem(k, v);
      return v;
    } catch { return uuid(); }
  })();

  const store = createStore<TourneyState>(() => ({
    tournament: null,
    scores: [],
    statusByPlayer: {},
    audit: [],
    seq: 0,
    lastServerTs: 0,
    status: 'connecting' as ConnState,
    queued: 0,
    session: readSession(opts.sessionStorageKey),
  })) as TourneyStore;

  const sender = new Sender(queue, (batch) => opts.transport.push(batch));

  function hydrate(snapshot: { tournament: Tournament; projection: ProjectionSnapshot; seq: number }) {
    const p = snapshot.projection;
    // восстановим проекцию из снапшота (winners важны для конфликтов)
    projection.scores = p.scores ?? [];
    projection.statusByPlayer = p.statusByPlayer ?? {};
    projection.audit = p.audit ?? [];
    for (const a of Object.values(p.winners ?? {})) {
      // скрытое восстановление seen/winners
      projection.apply(a as ScoreAction);
    }
    store.setState({
      tournament: snapshot.tournament,
      scores: projection.scores,
      statusByPlayer: projection.statusByPlayer,
      audit: projection.audit.slice(-100),
      seq: snapshot.seq,
      lastServerTs: Date.now(),
      status: 'online',
    });
  }

  function pushState() {
    store.setState({
      scores: [...projection.scores],
      statusByPlayer: { ...projection.statusByPlayer },
      audit: projection.audit.slice(-100),
      seq: projection.snapshot().seq,
      lastServerTs: Date.now(),
    });
  }

  async function emit(action: ScoreAction): Promise<ScoreAction> {
    projection.apply(action);         // оптимистично: UI ≤100 мс
    pushState();
    await queue.enqueue(action);      // персист до сети — RPO 0
    void sender.kick();
    return action;
  }

  function mkAction(partial: Omit<ScoreAction, 'actionId' | 'authorId' | 'authorRole' | 'deviceId' | 'clientTs' | 'lamport' | 'tournamentId'>): ScoreAction {
    const s = store.getState();
    const author: Role = s.session?.role ?? 'player';
    lamport += 1;
    return {
      ...partial,
      actionId: uuid(),
      tournamentId: opts.transport.tournamentId,
      authorId: s.session?.playerId ?? s.session?.name ?? 'anon',
      authorRole: author,
      deviceId,
      clientTs: Date.now(),
      lamport,
    } as ScoreAction;
  }

  store.connect = async () => {
    store.setState({ status: 'connecting' });
    try {
      const snap = await opts.transport.connect();
      enqueueSetup(snap);
    } catch {
      store.setState({ status: 'offline' });
      // демо/офлайн: если есть локальная копия — тихий показ; иначе повтор через backoff
      setTimeout(() => void store.connect(), 3000);
    }
  };

  function enqueueSetup(snap: { tournament: Tournament; projection: ProjectionSnapshot; seq: number }) {
    hydrate(snap);
    const unsubT = opts.transport.subscribe((frame) => {
      if (frame.kind === 'delta') {
        const t0 = Date.now();
        for (const a of frame.events) projection.apply(a, frame.serverTs);
        pushState();
        opts.onDelta?.(Date.now() - t0);
      } else if (frame.kind === 'ack') {
        void queue.ack(frame.actionIds);
      } else if (frame.kind === 'heartbeat') {
        store.setState({ lastServerTs: frame.serverTs });
      }
    });
    const unsubQ = queue.onChange((n) => store.setState({ queued: n }));
    sender.start();
    destroyFns.push(unsubT, unsubQ, () => sender.stop());
    if (typeof window !== 'undefined') {
      const on = () => { store.setState({ status: 'online' }); void sender.kick(); };
      const off = () => store.setState({ status: 'offline' });
      window.addEventListener('online', on);
      window.addEventListener('offline', off);
      destroyFns.push(() => {
        window.removeEventListener('online', on);
        window.removeEventListener('offline', off);
      });
    }
  }

  store.setScore = (playerId, hole, strokes, note) => {
    const a = mkAction({ type: 'score.set', roundIndex: 0, playerId, hole, payload: { strokes, note } });
    void emit(a);
    return a;
  };
  store.setPickup = (playerId, hole) => {
    const a = mkAction({ type: 'score.pickup', roundIndex: 0, playerId, hole, payload: {} });
    void emit(a);
    return a;
  };
  store.setPenalty = (playerId, hole, penalties) => {
    const a = mkAction({ type: 'score.penalty', roundIndex: 0, playerId, hole, payload: { penalties } });
    void emit(a);
    return a;
  };
  store.clearHole = (playerId, hole) => {
    const a = mkAction({ type: 'score.clear', roundIndex: 0, playerId, hole, payload: {} });
    void emit(a);
    return a;
  };
  store.concede = (playerId, hole) => {
    const a = mkAction({ type: 'score.concede', roundIndex: 0, playerId, hole, payload: {} });
    void emit(a);
    return a;
  };
  store.setStatus = (playerId, status, reason) => {
    const a = mkAction({ type: 'entry.status', roundIndex: 0, playerId, payload: { status, reason } });
    void emit(a);
    return a;
  };

  store.join = ({ code, name, hi, teeSetKey, asMarker }) => {
    const t = store.getState().tournament;
    if (!t) return { ok: false, error: 'no-tournament' };
    if (code.trim().toUpperCase() !== t.joinCode.toUpperCase()) return { ok: false, error: 'bad-code' };
    // демо-вход (решение D4): игрок добавляется локально; прод — серверная сессия
    const playerId: Id = `u-${name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').slice(0, 24)}-${Date.now().toString(36)}`;
    t.players[playerId] = { id: playerId, name, hi };
    t.entries.push({ playerId, teeSetKey, status: 'active' });
    const session: SessionInfo = {
      token: uuid(), role: asMarker ? 'marker' : 'player', name, playerId, teeSetKey, asMarker,
    };
    saveSession(opts.sessionStorageKey, session);
    store.setState({ tournament: { ...t }, session });
    return { ok: true };
  };
  store.loginAs = (role: Role, name: string) => {
    const session: SessionInfo = { token: uuid(), role, name };
    saveSession(opts.sessionStorageKey, session);
    store.setState({ session });
  };
  store.logout = () => {
    saveSession(opts.sessionStorageKey, null);
    store.setState({ session: null });
  };
  store.destroy = () => { destroyFns.forEach((f) => f()); destroyFns = []; };

  // восстановление размера очереди при старте
  void queue.size().then((n) => store.setState({ queued: n }));

  return store;
}

function readSession(key?: string): SessionInfo | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key ?? 'csl.session');
    return raw ? (JSON.parse(raw) as SessionInfo) : null;
  } catch { return null; }
}
function saveSession(key: string | undefined, s: SessionInfo | null) {
  try {
    if (typeof localStorage === 'undefined') return;
    const k = key ?? 'csl.session';
    if (s) localStorage.setItem(k, JSON.stringify(s));
    else localStorage.removeItem(k);
  } catch { /* ignore */ }
}
