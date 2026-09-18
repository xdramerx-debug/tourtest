import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Chip } from '@csl/design-system';
import { buildLeaderboard } from '@csl/scoring-engine';
import { useApp } from '../root';
import { TournamentProvider, useTourney } from '../store-context';
import { demoTournamentList } from '../config';
import { Crumbs } from '../layouts';

/** История/рекорды клуба (IA §9): прошедшие турниры, итоги, краткая статистика победителей. */
export function HistoryScreen() {
  const { t } = useTranslation();
  const { config } = useApp();
  const done = demoTournamentList(config.variant).filter((x) => x.status === 'finished');
  return (
    <div className="ds-sc">
      <Crumbs items={[{ to: '/', label: t('nav.home') }, { label: t('history.title') }]} />
      <h1 className="ds-h1">{t('history.title')}</h1>
      {done.length === 0 ? <Card>{t('history.empty')}</Card> : done.map((x) => (
        <TournamentProvider key={x.id} info={x}>
          <FinishedCard id={x.id} label={x.name.ru} format={x.format} rounds={x.rounds} />
        </TournamentProvider>
      ))}
    </div>
  );
}

function FinishedCard({ id, label, format, rounds }: { id: string; label: string; format: string; rounds: number }) {
  const { t } = useTranslation();
  const tournament = useTourney((s) => s.tournament);
  const scores = useTourney((s) => s.scores);

  const lb = useMemo(() => (tournament && scores[0] ? buildLeaderboard({ tournament, scores, mode: 'gross', roundIndex: 'all' }) : null), [tournament, scores]);
  if (!lb || lb.rows.length === 0) return <Card><div className="ds-skeleton" style={{ height: 90 }} /></Card>;
  const top = lb.rows.slice(0, 3);
  const winner = lb.rows[0];
  return (
    <Card style={{ margin: '10px 0' }}>
      <div className="ds-lbrow">
        <div style={{ flex: 1 }}>
          <strong>{label}</strong>
          <div className="ds-muted">{t(`format.${format}`)} · {t('lobby.roundN', { n: rounds })}</div>
        </div>
        <Badge tone="muted">{t('status.finished')}</Badge>
      </div>
      <div className="ds-lb" aria-label={t('history.winners')}>
        {top.map((r) => (
          <div key={r.playerId} className="ds-lbrow" style={{ '--cols': '40px 1fr 56px' } as React.CSSProperties}>
            <span className="num">{r.pos}{r.tied ? 'T' : ''}</span>
            <Link to={`/p/${r.playerId}`} className="ds-linkname">{r.name}</Link>
            <span className="num">{r.totalGross}</span>
          </div>
        ))}
      </div>
      <p className="ds-muted num">
        {t('history.winner')}: {winner.name} · {winner.totalGross} ({winner.totalToPar > 0 ? '+' : ''}{winner.totalToPar}) · {winner.playedHoles} {t('profile.holes')}
      </p>
      <Link to={`/t/${id}/board`}><Chip>{t('history.openBoard')}</Chip></Link>
    </Card>
  );
}
