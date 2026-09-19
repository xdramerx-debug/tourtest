import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, NumberPad, Select, Icon } from '@csl/design-system';
import { fmt, toParLabel } from '@csl/core';
import { strokesReceived, summarizeRound } from '@csl/scoring-engine';
import { themeById } from '@csl/tokens';
import { useApp } from '../root';
import { useLeaderboard, useTourney, useTourneyStore } from '../store-context';
import { Crumbs } from '../layouts';

export function PlayScreen() {
  const { t, i18n } = useTranslation();
  const { tid, n } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const { config } = useApp();
  const theme = themeById[config.design];

  const tournament = useTourney((s) => s.tournament);
  const session = useTourney((s) => s.session);
  const scores = useTourney((s) => s.scores);
  const st = useTourneyStore();
  const lb = useLeaderboard('gross');

  const [markerFor, setMarkerFor] = useState<string>('');
  const [units] = useState<'metric' | 'imperial'>(() => {
    try { return (JSON.parse(localStorage.getItem('csl.club') ?? '{}') as { units?: 'metric' | 'imperial' }).units ?? 'metric'; } catch { return 'metric'; }
  });

  // Маркер ведёт счёт выбранного партнёра; игрок — свой
  const me = useMemo(() => {
    if (session?.asMarker) return markerFor || null;
    return session?.playerId ?? null;
  }, [session, markerFor]);

  const holes = tournament?.course.holes;
  const total = holes?.length ?? 18;

  // Текущая лунка: из URL или авто (первая незавершённая)
  const myCells = me ? scores[0]?.[me] : undefined;
  const autoHole = useMemo(() => {
    if (!holes) return 1;
    for (const h of holes) {
      const c = myCells?.[h.n];
      if (!c || (c.strokes == null && !c.pickup && !c.conceded)) return h.n;
    }
    return holes[holes.length - 1].n;
  }, [holes, myCells]);
  const holeN = Math.min(total, Math.max(1, Number(n) || autoHole));

  const entry = tournament?.entries.find((e) => e.playerId === me);
  const spec = holes?.find((h) => h.n === holeN);
  const ph = lb?.rows.find((r) => r.playerId === me)?.ph ?? 0;
  const sr = spec ? strokesReceived(ph, spec.si) : 0;
  const cell = me && spec ? scores[0]?.[me]?.[spec.n] : undefined;

  const summary = useMemo(() => {
    if (!holes) return null;
    return summarizeRound(myCells, { holes, ph, capNDB: true });
  }, [holes, myCells, ph]);

  // guard: нет сессии — на join с возвратом (IA)
  if (!session) return <Navigate to={`/join?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (session.asMarker && !me) {
    return (
      <div className="ds-sc" style={{ maxWidth: 560, margin: '0 auto' }}>
        <Crumbs items={[{ to: '/', label: t('nav.home') }, { to: `/t/${tid}`, label: tournament?.name ?? '' }, { label: t('nav.myCard') }]} />
        <h1 className="ds-h1">{t('play.markerFor')}</h1>
        <Select value={markerFor} onChange={(e) => setMarkerFor(e.target.value)} aria-label={t('play.markerFor')}>
          <option value="">…</option>
          {tournament?.entries.map((e) => (
            <option key={e.playerId} value={e.playerId}>{tournament.players[e.playerId]?.name}</option>
          ))}
        </Select>
      </div>
    );
  }
  if (!tournament || !spec || !me) return null;

  const go = (h: number) => {
    const next = Math.min(total, Math.max(1, h));
    nav(`/t/${tid}/play/h/${next}`, { replace: true });
  };
  const afterScore = () => {
    // авто-переход на следующую лунку (ADAPTIVE §2, отключается настройкой — по умолчанию вкл)
    if (holeN < total) window.setTimeout(() => go(holeN + 1), 450);
  };

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(holeN + (dx < 0 ? 1 : -1));
  };

  const len = spec.lengths[session.teeSetKey ?? entry?.teeSetKey ?? 'mens'];
  const gross = cell?.pickup ? undefined : cell?.strokes != null ? cell.strokes + (cell.penalties ?? 0) : undefined;

  return (
    <div className="ds-sc ds-sc--card" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div>
        <Crumbs items={[{ to: '/', label: t('nav.home') }, { to: `/t/${tid}`, label: tournament.name }, { label: t('nav.myCard') }]} />

        <div className="ds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {session.asMarker ? (
            <Select value={me ?? ''} onChange={(e) => setMarkerFor(e.target.value)} aria-label={t('play.markerFor')} style={{ maxWidth: 260 }}>
              {tournament.entries.map((e) => (
                <option key={e.playerId} value={e.playerId}>{tournament.players[e.playerId]?.name}</option>
              ))}
            </Select>
          ) : (
            <Badge tone="accent">{tournament.players[me]?.name}</Badge>
          )}
          {summary ? (
            <Badge tone="muted">
              <span className="num" style={{ fontWeight: 800 }}>{toParLabel(summary.toPar)}</span>
              &nbsp;· {t('board.thru')} <span className="num">{summary.thru}</span>
            </Badge>
          ) : null}
        </div>

        <Card className="ds-sc-sticky" style={{ marginTop: 12 }}>
          <div className="ds-sc__hole">
            <div>
              <div className="ds-sc__holenum">{t('play.hole', { n: holeN })}</div>
              {sr > 0 ? <div className="ds-sc__stars" title={t('play.strokesReceived', { n: sr })}>{'★'.repeat(Math.min(3, sr))} {t('play.strokesReceived', { n: sr })}</div> : null}
            </div>
            <div className="ds-sc__holemeta">
              <div>{t('play.par', { n: spec.par })} · {t('play.si', { n: spec.si })}</div>
              {len ? <div>{fmt.dist(len, units)} {t(units === 'metric' ? 'units.m' : 'units.yd')}</div> : null}
            </div>
          </div>

          <div className="ds-sc__value" aria-live="polite">
            <span className="ds-sc__bignum num">
              {cell?.pickup ? 'X' : cell?.conceded ? 'C' : gross ?? '·'}
            </span>
            <span className="ds-sc__eq">
              {gross != null && spec ? relLabel(gross - spec.par, i18n.language) : '\u00A0'}
              {(cell?.penalties ?? 0) > 0 ? <><br />{`${t('play.penalties')} +${cell!.penalties}`}</> : null}
            </span>
          </div>

          <div className="ds-sc__nav">
            <Button variant="quiet" onClick={() => go(holeN - 1)} disabled={holeN <= 1}>
              <Icon name="left" size={18} /> {t('play.prev')}
            </Button>
            <Button variant="quiet" onClick={() => go(holeN + 1)} disabled={holeN >= total}>
              {t('play.next')} <Icon name="right" size={18} />
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <NumberPad
          par={spec.par}
          value={cell && !cell.pickup ? cell.strokes : undefined}
          pickup={cell?.pickup}
          penalties={cell?.penalties ?? 0}
          quickChips={theme.patterns.quickChips}
          labels={{
            pickup: t('play.pickup'), penalty: t('play.penalties'),
            more: '10–15', back: '1–9', clear: t('play.clear'),
            quickMin1: toParLabel(-1), quickPar: t('play.quickPar'), quickPlus1: toParLabel(1),
          }}
          onScore={(v) => { st.setScore(me, holeN, v); if (!cell?.pickup) afterScore(); }}
          onPickup={() => { st.setPickup(me, holeN); afterScore(); }}
          onPenalty={(v) => st.setPenalty(me, holeN, v)}
          onClear={() => st.clearHole(me, holeN)}
        />
      </div>
    </div>
  );
}

function relLabel(diff: number, locale: string): string {
  const names: Record<string, Record<number, string>> = {
    ru: { [-3]: 'Альбатрос', [-2]: 'Орёл', [-1]: 'Бёрди', 0: 'Пар', 1: 'Боги', 2: 'Дабл', 3: 'Трипл' },
    en: { [-3]: 'Albatross', [-2]: 'Eagle', [-1]: 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double', 3: 'Triple' },
  };
  const dict = names[locale] ?? names.ru;
  return dict[diff] ?? (diff > 0 ? `+${diff}` : `${diff}`);
}
