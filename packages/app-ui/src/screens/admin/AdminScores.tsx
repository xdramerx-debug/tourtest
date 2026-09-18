import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Input } from '@csl/design-system';
import { holeOrderOf } from '@csl/scoring-engine';
import { useTourney, useTourneyStore } from '../../store-context';

/**
 * Матрица правок счёта (F3.2, ERG §2): выбор игрока → 18 ячеек, commit на Enter/blur.
 * Правки идут тем же ScoreAction (authorRole referee/admin выигрывает по timestamp, RULES §10).
 */
export function AdminScores() {
  const { t } = useTranslation();
  const tournament = useTourney((s) => s.tournament);
  const scores = useTourney((s) => s.scores);
  const st = useTourneyStore();
  const [pid, setPid] = useState<string | null>(null);

  if (!tournament) return <Card><div className="ds-skeleton" style={{ height: 160 }} /></Card>;
  const holes = holeOrderOf(tournament, 0);
  const cur = pid ?? tournament.entries[0]?.playerId ?? '';
  const cells = scores[0]?.[cur] ?? {};

  const commit = (hole: number, raw: string) => {
    const prev = cells[hole];
    const v = raw.trim() === '' ? undefined : Number(raw);
    const prevV = prev?.pickup ? undefined : prev?.strokes;
    if ((v == null && prev == null) || v === prevV) return;
    if (v == null) st.clearHole(cur, hole);
    else st.setScore(cur, hole, v);
  };

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{t('admin.editTitle')}</h2>
      <div className="ds-row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {tournament.entries.slice(0, 16).map((e) => (
          <button key={e.playerId} className={`ds-chip ${cur === e.playerId ? 'is-active' : ''}`} onClick={() => setPid(e.playerId)}>
            {tournament.players[e.playerId]?.name ?? e.playerId}
          </button>
        ))}
      </div>
      <div className="ds-table-wrap">
        <table className="ds-lb" style={{ '--cols': '48px 64px 64px 1fr' } as React.CSSProperties}>
          <thead className="ds-lb__head"><tr><th>#</th><th>par/si</th><th>{t('play.strokes')}</th><th>{t('board.topar')}</th></tr></thead>
          <tbody>
            {holes.map((h) => {
              const c = cells[h.n];
              return (
                <tr key={h.n} className="ds-lbrow" style={{ height: 56 }}>
                  <td className="num">{h.n}</td>
                  <td className="num">{h.par} / {h.si}</td>
                  <td>
                    <Input
                      key={`${cur}-${h.n}-${c?.strokes ?? (c?.pickup ? 'x' : '')}`}
                      type="number" inputMode="numeric" min={1} max={15}
                      defaultValue={c?.pickup ? '' : c?.strokes ?? ''}
                      placeholder={c?.pickup ? 'X' : '—'}
                      aria-label={`${t('play.hole')} ${h.n}, ${tournament.players[cur]?.name}`}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      onBlur={(e) => commit(h.n, e.currentTarget.value)}
                      style={{ width: 64, textAlign: 'center' }}
                    />
                  </td>
                  <td className="num">{c?.pickup ? 'X' : c?.strokes != null ? (c.strokes - h.par > 0 ? '+' : '') + (c.strokes - h.par) : '·'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ds-muted">{t('audit.hint')}</p>
      <Link to={`/t/${tournament.id}/board`} className="ds-muted">{t('nav.backToLive')}</Link>
    </Card>
  );
}
