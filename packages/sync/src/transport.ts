import type { Id, ScoreAction, Tournament } from '@csl/core';
import type { ProjectionSnapshot } from './projection';

/** Кадры потока сервер→клиент (ARCHITECTURE §6.4). */
export type StreamFrame =
  | { kind: 'snapshot'; tournament: Tournament; projection: ProjectionSnapshot; seq: number; serverTs: number }
  | { kind: 'delta'; events: ScoreAction[]; seq: number; serverTs: number }
  | { kind: 'ack'; actionIds: string[]; seq: number; serverTs: number }
  | { kind: 'heartbeat'; seq: number; serverTs: number };

export interface Snapshot {
  tournament: Tournament;
  projection: ProjectionSnapshot;
  seq: number;
}

/**
 * Транспорт синхронизации. Две реализации:
 *  - RemoteTransport (SSE + REST) — прод;
 *  - DemoTransport (src/demo.ts) — клиентская симуляция для GH Pages (D8).
 */
export interface Transport {
  tournamentId: Id;
  connect(): Promise<Snapshot>;
  push(batch: ScoreAction[]): Promise<{ ok: boolean; applied: string[] }>;
  subscribe(cb: (frame: StreamFrame) => void): () => void;
  setCheckpoint(seq: number): void;
  readonly mode: 'remote' | 'demo';
}

/** SSE + REST транспорт (прод). Резюм — Last-Event-ID (контроль seq на клиенте). */
export class RemoteTransport implements Transport {
  readonly mode = 'remote' as const;
  private es: EventSource | null = null;
  private lastSeq = 0;
  private listeners = new Set<(f: StreamFrame) => void>();

  constructor(public tournamentId: Id, private baseUrl: string) {}

  async connect(): Promise<Snapshot> {
    const res = await fetch(`${this.baseUrl}/api/t/${this.tournamentId}/snapshot`, { credentials: 'include' });
    if (!res.ok) throw new Error(`snapshot ${res.status}`);
    const snap = (await res.json()) as Snapshot;
    this.lastSeq = snap.seq;
    this.openStream();
    return snap;
  }

  private openStream() {
    this.es?.close();
    const url = `${this.baseUrl}/api/t/${this.tournamentId}/stream?lastEventId=${this.lastSeq}`;
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data) as StreamFrame;
        if ('seq' in frame) this.lastSeq = Math.max(this.lastSeq, frame.seq);
        this.listeners.forEach((cb) => cb(frame));
      } catch { /* пропуск битого кадра: следующий snapshot-докач */ }
    };
    es.onerror = () => { /* браузер сам ретраит EventSource; наше lastEventId сохраняется */ };
    this.es = es;
  }

  async push(batch: ScoreAction[]) {
    try {
      const res = await fetch(`${this.baseUrl}/api/t/${this.tournamentId}/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(batch),
      });
      if (!res.ok) return { ok: false, applied: [] };
      const data = (await res.json()) as { applied: string[] };
      return { ok: true, applied: data.applied ?? batch.map((b) => b.actionId) };
    } catch {
      return { ok: false, applied: [] };
    }
  }

  subscribe(cb: (frame: StreamFrame) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  setCheckpoint(seq: number) { this.lastSeq = seq; }
}
