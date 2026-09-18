import { DatabaseSync } from 'node:sqlite';
import type { ScoreAction } from '@csl/core';

/**
 * Журнал действий на node:sqlite (ADR-0003).
 * Выбор: better-sqlite3 требует node-gyp/headers в CI-песочнице — недоступно;
 * node:sqlite (node ≥22) даёт тот же класс надёжности без нативной сборки.
 * Отклонено: JSONL-файл (нет атомарных индексов по action_id), Postgres (избыточен для клуба).
 */
export class ActionJournal {
  private db: DatabaseSync;

  constructor(path = process.env.CSL_DB ?? 'csl-server.db') {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS actions (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        server_ts INTEGER NOT NULL,
        UNIQUE (tournament_id, action_id)
      );
      CREATE INDEX IF NOT EXISTS idx_actions_tid ON actions (tournament_id, seq);
      CREATE TABLE IF NOT EXISTS snapshots (
        tournament_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  /** Атомарная вставка; дубликат actionId → ON CONFLICT игнор (идемпотентность, ARCHITECTURE §9). */
  append(tournamentId: string, action: ScoreAction, serverTs: number): { inserted: boolean; seq: number } {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO actions (tournament_id, action_id, payload, server_ts) VALUES (?, ?, ?, ?)',
    );
    const res = stmt.run(tournamentId, action.actionId, JSON.stringify(action), serverTs);
    if (Number(res.changes) === 0) {
      const row = this.db.prepare('SELECT seq FROM actions WHERE tournament_id = ? AND action_id = ?')
        .get(tournamentId, action.actionId) as { seq: number };
      return { inserted: false, seq: row.seq };
    }
    return { inserted: true, seq: Number(res.lastInsertRowid) };
  }

  all(tournamentId: string): { seq: number; action: ScoreAction; serverTs: number }[] {
    const rows = this.db.prepare(
      'SELECT seq, payload, server_ts FROM actions WHERE tournament_id = ? ORDER BY seq',
    ).all(tournamentId) as { seq: number; payload: string; server_ts: number }[];
    return rows.map((r) => ({ seq: r.seq, action: JSON.parse(r.payload) as ScoreAction, serverTs: r.server_ts }));
  }

  saveSnapshot(tournamentId: string, payload: string) {
    this.db.prepare(
      'INSERT INTO snapshots (tournament_id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(tournament_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
    ).run(tournamentId, payload, Date.now());
  }

  loadSnapshot(tournamentId: string): string | null {
    const row = this.db.prepare('SELECT payload FROM snapshots WHERE tournament_id = ?').get(tournamentId) as { payload: string } | undefined;
    return row?.payload ?? null;
  }

  close() { this.db.close(); }
}
