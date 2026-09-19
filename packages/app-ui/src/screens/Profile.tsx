import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Card } from '@csl/design-system';
import { holeOrderOf, playingHandicapOf, summarizeRound } from '@csl/scoring-engine';
import { useApp } from '../root';
import { useTourney } from '../store-context';
import { Crumbs } from '../layouts';

/** Профиль игрока (IA §8): сезонные KPI, распределение, OUT/IN, топ-лунки (C — расширенная статистика). */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { features } = useApp();
  const { pid } = useParams();
  const tournament = useTourney((s) => s.tournament);
  const scores = useTourney((s) => s.scores);

  const data = useMemo(() => {
    if (!tournament || !pid) return null;
    const player = tournament.players[pid];
    if (!player) return null;
    const holes = holeOrderOf(tournament, 0);
    const ph = playingHandicapOf(tournament, pid, 0);
    const sum = summarizeRound(scores[0]?.[pid] ?? {}, { holes, ph });
    const played = sum.byHole.filter((h) => h.played);
    const dist = { eagleBetter: 0, birdie: 0, par: 0, bogey: 0, doublePlus: 0 };
    for (const h of played) {
      const d = (h.gross ?? 0) - h.par;
      if (h.pickup) dist.doublePlus++;
      else if (d <= -2) dist.eagleBetter++;
      else if (d === -1) dist.birdie++;
      else if (d === 0) dist.par++;
      else if (d === 1) dist.bogey++;
      else dist.doublePlus++;
    }
    const out = played.filter((h) => h.hole <= 9).reduce((s, h) => s + (h.gross ?? 0) - h.par, 0);
    const inn = played.filter((h) => h.hole > 9).reduce((s, h) => s + (h.gross ?? 0) - h.par, 0);
    const sorted = [...played].sort((a, b) => ((a.gross ?? 9) - a.par) - ((b.gross ?? 9) - b.par));
    return { player, playerT: tournament, sum, dist, out, inn, best3: sorted.slice(0, 3), worst: sorted.slice(-1)[0] };
  }, [tournament, scores, pid]);

  if (!data) {
    return (
      <div className="ds-sc">
        <Crumbs items={[{ to: '/', label: t('nav.home') }, { label: t('profile.title') }]} />
        <Card>{t('profile.notFound')}</Card>
      </div>
    );
  }
  const sign = (n: number) => (n === 0 ? 'E' : (n > 0 ? '+' : '') + n);

  return (
    <div className="ds-sc">
      <Crumbs items={[{ to: '/', label: t('nav.home') }, { to: `/t/${data.playerT.id}`, label: data.playerT.name }, { label: data.player.name }]} />
      <h1 className="ds-h1">{data.player.name}</h1>
      <p className="ds-muted num">HI {data.player.hi.toFixed(1)} · PH {playingHandicapOf(data.playerT, pid!, 0)}</p>

      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
        <Card><div className="ds-kpi"><span className="ds-kpi__v num">{sign(data.sum.toPar)}</span><span className="ds-kpi__l">{t('board.topar')}</span></div></Card>
        <Card><div className="ds-kpi"><span className="ds-kpi__v num">{data.sum.thru}</span><span className="ds-kpi__l">{t('board.thru')}</span></div></Card>
        <Card><div className="ds-kpi"><span className="ds-kpi__v num">{data.sum.points}</span><span className="ds-kpi__l">{t('stableford.points')}</span></div></Card>
      </div>

      <Card>
        <h3 style={{ marginTop: 0 }}>{t('profile.distribution')}</h3>
        <div className="ds-lb" role="table" aria-label={t('profile.distribution')}>
          {(['eagleBetter', 'birdie', 'par', 'bogey', 'doublePlus'] as const).map((k) => (
            <div key={k} className="ds-lbrow" style={{ '--cols': '1fr 48px' } as React.CSSProperties}>
              <span>{t(`profile.dist.${k}`)}</span><span className="num">{data.dist[k]}</span>
            </div>
          ))}
        </div>
      </Card>

      {features.playerStats ? (
        <Card>
          <h3 style={{ marginTop: 0 }}>{t('profile.insights')}</h3>
          <p className="num">OUT {sign(data.out)} · IN {sign(data.inn)}</p>
          <p className="ds-muted">
            {t('profile.bestHoles')}: {data.best3.map((h) => h.hole).join(', ') || '—'}
            {data.worst ? <> · {t('profile.hardest')}: {data.worst.hole}</> : null}
          </p>
        </Card>
      ) : (
        <p className="ds-muted">{t('profile.deepStatsC')}</p>
      )}

      <Link to={`/t/${data.playerT.id}/board`} className="ds-muted">{t('nav.backToLive')}</Link>
    </div>
  );
}
