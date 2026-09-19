import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card } from '@csl/design-system';
import { courseParOf, holeOrderOf, playingHandicapOf, summarizeRound } from '@csl/scoring-engine';
import { useApp } from '../root';
import { useTourney, useTourneyStore, useConnInfo } from '../store-context';
import { Crumbs } from '../layouts';

/**
 * Лобби турнира (IA §6, USER_FLOWS F1/F1.2): статус, моё участие (KPI), tee time, флайт; CTA.
 * Гостю — маршрут «Присоединиться»; зарегистрированному — «Начать раунд».
 */
export function LobbyScreen() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { features } = useApp();
  const tournament = useTourney((s) => s.tournament);
  const scores = useTourney((s) => s.scores);
  const session = useTourney((s) => s.session);
  const conn = useConnInfo();
  const st = useTourneyStore();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const me = session?.playerId;
  const holes = useMemo(() => (tournament ? holeOrderOf(tournament, 0) : []), [tournament]);
  const summary = useMemo(() => {
    if (!tournament || !me) return null;
    const sum = summarizeRound(scores[0]?.[me] ?? {}, { holes, ph: playingHandicapOf(tournament, me, 0) });
    return { toPar: sum.toPar, thru: sum.thru, ph: playingHandicapOf(tournament, me, 0) };
  }, [tournament, scores, me, holes]);

  // F1: после /join сохраняем имя в sessionStorage — здесь создаём сессию
  useEffect(() => {
    if (!tournament || session || joining) return;
    let pend: string | null = null;
    let role: string | null = null;
    try {
      pend = localStorage.getItem(`csl.pendingName.${tournament.id}`);
      role = localStorage.getItem(`csl.pendingRole.${tournament.id}`);
    } catch { /* ignore */ }
    if (!pend) return;
    setJoining(true);
    const name = pend;
    const r = st.join({
      code: tournament.joinCode,
      name,
      hi: 18,
      teeSetKey: 'mens',
      asMarker: role === 'marker',
    });
    try { localStorage.removeItem(`csl.pendingName.${tournament.id}`); } catch { /* ignore */ }
    if (!r.ok) setJoinError(t('join.error'));
    setJoining(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id, session]);

  if (!tournament) {
    return (
      <div className="ds-sc" aria-busy="true">
        <Crumbs items={[{ to: '/', label: t('nav.home') }, { label: '…' }]} />
        <Card><div className="ds-skeleton" style={{ height: 120 }} /></Card>
        <Card><div className="ds-skeleton" style={{ height: 200 }} /></Card>
      </div>
    );
  }

  const myEntry = me ? tournament.entries.find((e) => e.playerId === me) : null;
  const flightOf = (flightId?: string) => tournament.flights.find((f) => f.id === flightId);
  const markersChoice = session?.role === 'marker';

  return (
    <div className="ds-sc">
      <Crumbs items={[{ to: '/', label: t('nav.home') }, { label: tournament.name }]} />
      <div className="ds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1 className="ds-h1" style={{ margin: 0 }}>{tournament.name}</h1>
        <Badge tone={tournament.status === 'live' ? 'good' : 'muted'} live={tournament.status === 'live'}>
          {t(`status.${tournament.status === 'live' ? 'live' : tournament.status === 'finished' ? 'finished' : 'registration'}`)}
        </Badge>
      </div>
      <p className="ds-muted">{t(`format.${tournament.format.id}`)} · {tournament.course.name} · {t('lobby.roundN', { n: tournament.rounds.length })}</p>

      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
        <Card><div className="ds-kpi"><span className="ds-kpi__v num">{tournament.entries.length}</span><span className="ds-kpi__l">{t('lobby.players')}</span></div></Card>
        {summary ? <Card><div className="ds-kpi"><span className="ds-kpi__v num">{summary.toPar === 0 ? 'E' : (summary.toPar > 0 ? '+' : '') + summary.toPar}</span><span className="ds-kpi__l">{t('board.topar')}</span></div></Card> : null}
        {summary ? <Card><div className="ds-kpi"><span className="ds-kpi__v num">{summary.thru}</span><span className="ds-kpi__l">{t('board.thru')}</span></div></Card> : null}
        {myEntry ? <Card><div className="ds-kpi"><span className="ds-kpi__v num">{summary?.ph}</span><span className="ds-kpi__l">{t('lobby.ph')}</span></div></Card> : null}
        {myEntry?.flightId ? <Card><div className="ds-kpi"><span className="ds-kpi__v">{flightOf(myEntry.flightId)?.name}</span><span className="ds-kpi__l">{t('lobby.flight')}</span></div></Card> : null}
      </div>

      <div className="ds-row" role="group" aria-label="actions" style={{ flexWrap: 'wrap' }}>
        {!session && !joining ? <Link to={`/join?code=${tournament.joinCode}`}><Button variant="accent" size="xl">{t('lobby.joinCta')}</Button></Link> : null}
        {session ? (
          markersChoice
            ? <Link to={`/t/${tournament.id}/play`}><Button variant="accent" size="xl">{t('lobby.markerCta')}</Button></Link>
            : <Link to={`/t/${tournament.id}/play`}><Button variant="accent" size="xl">{t('lobby.startRound')}</Button></Link>
        ) : null}
        <Link to={`/t/${tournament.id}/board`}><Button variant="primary" size="xl">{t('lobby.liveLink')}</Button></Link>
        {features.tvMode ? <Link to={`/t/${tournament.id}/board?tv=1`}><Button variant="ghost" size="lg">{t('board.tv')}</Button></Link> : null}
      </div>
      {joinError ? <p role="alert"><Badge tone="danger">{joinError}</Badge></p> : null}

      {features.matchPlay && tournament.format.id === 'match' ? (
        <Card><Link to={`/t/${tournament.id}/match/demo`}>{t('format.match')} →</Link></Card>
      ) : null}

      <Card>
        <h3 style={{ marginTop: 0 }}>{t('lobby.players')}</h3>
        <div className="ds-row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {tournament.entries.slice(0, 36).map((e) => (
            <Link key={e.playerId} to={`/p/${e.playerId}`} className="ds-chip">{tournament.players[e.playerId]?.name ?? e.playerId}</Link>
          ))}
          {tournament.entries.length > 36 ? <span className="ds-chip">+{tournament.entries.length - 36}</span> : null}
        </div>
      </Card>
      <p className="ds-muted num">{t(`sync.${conn.state}`)}{conn.queued ? ` · ${t('sync.queued', { n: conn.queued })}` : ''}</p>
    </div>
  );
}
