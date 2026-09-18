import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Chip } from '@csl/design-system';
import {
  courseHandicap, holeOrderOf, matchState, playingHandicap, stablefordPoints, strokesReceived, summarizeRound,
} from '@csl/scoring-engine';
import { useTourney } from '../store-context';
import { Crumbs } from '../layouts';

/**
 * Матч (формат match / fourball, FORMATS §3): статус «N up / dormie / N&M»,
 * лунки A/B/H, concede-подсветка. Пара — первые двое из флайта A (демо).
 */
export function MatchScreen() {
  const { t } = useTranslation();
  const { tid } = useParams();
  const tournament = useTourney((s) => s.tournament);
  const scores = useTourney((s) => s.scores);

  const pair = useMemo(() => (tournament ? tournament.entries.slice(0, 2).map((e) => e.playerId) : []), [tournament]);

  const state = useMemo(() => {
    if (!tournament || pair.length < 2) return null;
    const holes = holeOrderOf(tournament, 0);
    const par = holes.reduce((s, h) => s + h.par, 0);
    const phRaw = pair.map((pid) => {
      const entry = tournament.entries.find((e) => e.playerId === pid)!;
      const tee = tournament.course.teeSets.find((x) => x.key === entry.teeSetKey) ?? tournament.course.teeSets[0];
      // match: 100% + back-low от нижнего гандикапа (RULES §6.6)
      return playingHandicap(courseHandicap(tournament.players[pid].hi, tee, par), 1);
    });
    const low = Math.min(...phRaw);
    const d = phRaw.map((p) => p - low);
    const nets = pair.map((pid, i) => holes.map((h) => {
      const cells = scores[0]?.[pid] ?? {};
      const s = summarizeRound({ [h.n]: cells[h.n] }, { holes: [h], ph: d[i] });
      return s.byHole[0]?.net;
    }));
    const concedes = pair.map((pid) => holes.map((h) => scores[0]?.[pid]?.[h.n]?.conceded === true));
    const m = matchState(nets[0], nets[1], { concedesByA: concedes[1], concedesByB: concedes[0] });
    return { m, d, pairNames: pair.map((p) => tournament.players[p]?.name ?? p), holes };
  }, [tournament, scores, pair]);

  if (!tournament || !state) {
    return (
      <div className="ds-sc">
        <Crumbs items={[{ to: '/', label: t('nav.home') }, { label: t('format.match') }]} />
        <Card><div className="ds-skeleton" style={{ height: 140 }} /></Card>
      </div>
    );
  }
  const { m, pairNames, holes } = state;

  const statusLabel = m.code === 'AS' ? t('match.as')
    : m.code === 'DORMIE' ? `${t('match.dormie')} · ${pairNames[m.leader === 'A' ? 0 : 1]} ${t('match.up', { n: m.n })}`
    : m.code === 'CLOSED' ? t('match.wins', { text: `${m.n}&${m.m}` }) + ` — ${pairNames[m.leader === 'A' ? 0 : 1]}`
    : `${pairNames[m.leader === 'A' ? 0 : 1]} ${t('match.up', { n: m.n })}`;

  return (
    <div className="ds-sc">
      <Crumbs items={[{ to: '/', label: t('nav.home') }, { to: `/t/${tid}`, label: tournament.name }, { label: t('format.match') }]} />
      <div className="ds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1 className="ds-h1" style={{ margin: 0 }}>{t('format.match')}</h1>
        <Badge tone={m.finished ? 'accent' : 'primary'} live={!m.finished}>{statusLabel}</Badge>
      </div>

      <div className="ds-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {pairNames.map((n, i) => (
          <Card key={i} style={{ textAlign: 'center' }}>
            <strong>{n}</strong>
            <div className="ds-kpi"><span className="ds-kpi__v num">{state.d[i]}</span><span className="ds-kpi__l">{t('match.strokesDiff')}</span></div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="ds-holes" role="table" aria-label={t('match.status')}>
          {m.outcomes.map((o, i) => {
            const h = holes[i];
            const srA = strokesReceived(state.d[0], h.si);
            const conceded = o != null && ((o === 'A' && scores[0]?.[pair[1]]?.[h.n]?.conceded) || (o === 'B' && scores[0]?.[pair[0]]?.[h.n]?.conceded));
            return (
              <div key={h.n} className={`ds-holes__cell ${o === 'A' ? 'is-birdie' : o === 'B' ? 'is-bogey' : ''} ${o == null ? 'is-empty' : ''}`}
                title={conceded ? t('match.conceded') : undefined} aria-label={`${t('play.hole')} ${h.n}`}>
                <div style={{ fontSize: 10, opacity: 0.72 }}>{h.n}{srA ? ' ★' : ''}</div>
                <div className="num">{o ?? '·'}</div>
              </div>
            );
          })}
        </div>
        <div className="ds-muted">{t('board.thru')} {m.thru} / {holes.length} · {t('match.legend')}</div>
      </Card>

      <Card>
        <strong>{t('match.protect')}</strong>
        <div className="ds-row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          <Chip>{t('match.as')}</Chip>
          <Chip>{t('match.up', { n: 1 })}</Chip>
          <Chip>{t('match.dormie')}</Chip>
          <Chip>2&1</Chip>
        </div>
      </Card>
    </div>
  );
}
