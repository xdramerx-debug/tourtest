import type { Entry, EntryStatus, HoleScore, Id, RoundScores, ScoreAction } from '@csl/core';
import { compareActions, cellKeyOf } from './resolver';

export interface AuditEntry {
  seq: number;
  serverTs: number;
  actionId: string;
  authorId: Id;
  authorRole: ScoreAction['authorRole'];
  result: 'applied' | 'duplicate' | 'overridden';
  summary: string;
  cellKey: string;
  superseded?: string;
}

export interface ProjectionSnapshot {
  scores: RoundScores[];
  statusByPlayer: Record<Id, { status: EntryStatus; reason?: string }>;
  winners: Record<string, ScoreAction>;
  seq: number;
  audit: AuditEntry[]; // храним хвост (последние N) — полный аудит у сервера
}

const AUDIT_TAIL = 500;

/**
 * Материализованная проекция турнира: журнал действий → ScoreBook + статусы + аудит.
 * Чистый TS (без I/O) — одинаково работает в браузере и на сервере.
 * Идемпотентность: повтор actionId → 'duplicate'. Конфликт — по compareActions per-cell.
 */
export class Projection {
  scores: RoundScores[] = [];
  statusByPlayer: ProjectionSnapshot['statusByPlayer'] = {};
  private winners = new Map<string, ScoreAction>();
  private seen = new Set<string>();
  private seq = 0;
  audit: AuditEntry[] = [];

  /** Применить действие. Возврат — результат для мониторинга/тестов. */
  apply(action: ScoreAction, serverTs = action.clientTs): AuditEntry {
    this.seq += 1;
    const cellKey = cellKeyOf(action);
    let result: AuditEntry['result'] = 'applied';
    let superseded: string | undefined;

    if (this.seen.has(action.actionId)) {
      result = 'duplicate';
      this.seq -= 1; // дубликат не продвигает seq — поток не портится
      const entry = this.mkAudit(action, result, cellKey, serverTs, superseded);
      // дубликаты в аудит не пишем (шум), но возвращаем результат
      return entry;
    }
    this.seen.add(action.actionId);

    const current = this.winners.get(cellKey);
    if (current && compareActions(action, current) <= 0) {
      result = 'overridden';
      superseded = action.actionId;
    } else {
      if (current) {
        result = 'applied';
        superseded = current.actionId;
      }
      this.winners.set(cellKey, action);
      this.materialize(action);
    }

    const entry = this.mkAudit(action, result, cellKey, serverTs, superseded);
    this.audit.push(entry);
    if (this.audit.length > AUDIT_TAIL) this.audit.splice(0, this.audit.length - AUDIT_TAIL);
    return entry;
  }

  private materialize(a: ScoreAction) {
    if (a.type === 'entry.status') {
      if (!a.playerId) return;
      this.statusByPlayer[a.playerId] = {
        status: a.payload.status ?? 'active',
        reason: a.payload.reason,
      };
      if (a.payload.status === 'active') delete this.statusByPlayer[a.playerId];
      return;
    }
    const who = a.playerId ?? a.teamId;
    if (who == null || a.hole == null) return;
    const round = (this.scores[a.roundIndex] ??= {});
    const cells = (round[who] ??= {});
    switch (a.type) {
      case 'score.set': {
        const prev = cells[a.hole] ?? {};
        const next: HoleScore = {
          ...prev,
          strokes: a.payload.strokes,
          note: a.payload.note ?? prev.note,
        };
        delete next.pickup;
        delete next.conceded;
        cells[a.hole] = next;
        break;
      }
      case 'score.penalty': {
        const prev = cells[a.hole] ?? {};
        cells[a.hole] = { ...prev, penalties: a.payload.penalties ?? 0 };
        break;
      }
      case 'score.pickup':
        cells[a.hole] = { pickup: true, note: a.payload.note };
        break;
      case 'score.concede':
        cells[a.hole] = { conceded: true };
        break;
      case 'score.clear':
        delete cells[a.hole];
        break;
      case 'match.result':
        break; // результат матча вычисляется из лунок; тип — для фиксации судьёй (аудит)
    }
  }

  private mkAudit(a: ScoreAction, result: AuditEntry['result'], cellKey: string, ts: number, superseded?: string): AuditEntry {
    const who = a.playerId ?? a.teamId ?? '?';
    const target = a.type === 'entry.status' ? `${who} → ${a.payload.status}` : `${who} · лунка ${a.hole ?? '-'}`;
    return {
      seq: this.seq, serverTs: ts, actionId: a.actionId,
      authorId: a.authorId, authorRole: a.authorRole,
      result, cellKey, superseded,
      summary: `${a.type} · ${target}`,
    };
  }

  snapshot(): ProjectionSnapshot {
    return {
      scores: this.scores,
      statusByPlayer: this.statusByPlayer,
      winners: Object.fromEntries(this.winners),
      seq: this.seq,
      audit: this.audit.slice(),
    };
  }

  static restore(tournamentActions: ScoreAction[], serverTs?: number): Projection {
    const p = new Projection();
    for (const a of tournamentActions) p.apply(a, serverTs);
    return p;
  }
}

/** Слить статусы проекции в entries (для передачи в scoring-engine). */
export function entriesWithStatus(entries: Entry[], statusByPlayer: ProjectionSnapshot['statusByPlayer']): Entry[] {
  return entries.map((e) => {
    const s = e.playerId ? statusByPlayer[e.playerId] : undefined;
    return s ? { ...e, status: s.status, statusReason: s.reason } : e;
  });
}
