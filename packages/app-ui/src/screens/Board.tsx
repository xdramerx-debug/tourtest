import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge, Button, Card, Chip, Input, Segmented, Select, Skeleton, Ticker, Icon,
} from '@csl/design-system';
import { toParLabel, fmt } from '@csl/core';
import { allocateSkins, type LeaderboardRow } from '@csl/scoring-engine';
import { themeById } from '@csl/tokens';
import { useApp } from '../root';
import { useDeltaRows, useLeaderboard, useTourney } from '../store-context';
import { Crumbs } from '../layouts';

type Mode = 'gross' | 'net' | 'points';

export function BoardScreen() {
  const { t, i18n } = useTranslation();
  const { tid } = useParams();
  const { features, config } = useApp();
  const patterns = themeById[config.design].patterns;
  const [sp] = useSearchParams();
  const tv = features.tvMode && sp.get('tv') === '1';

  const tournament = useTourney((s) => s.tournament);
  const status = useTourney((s) => s.status);
  const lastServerTs = useTourney((s) => s.lastServerTs);
  const audit = useTourney((s) => s.audit);
  const isStableford = tournament?.format.id === 'stableford';
  const isSkins = tournament?.format.id === 'skins';

  const [mode, setMode] = useState<Mode>(isStableford ? 'points' : 'gross');
  const [flight, setFlight] = useState<string>('all');
  const [round, setRound] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [tvPage, setTvPage] = useState(0);

  const lb = useLeaderboard(mode, { flight, round, search });

  const signature = useMemo(() => {
    if (!lb) return null;
    return new Map(lb.rows.map((r) => [r.playerId, `${r.pos}|${r.totalToPar}|${r.totalPoints}|${r.thru}`]));
  }, [lb]);
  const delta = useDeltaRows(signature);

  // TV-ротация страниц (B): 14 строк/стр, 8 с
  useEffect(() => {
    if (!tv || !lb) return;
    const pages = Math.max(1, Math.ceil(lb.rows.length / 14));
    const id = setInterval(() => setTvPage((p) => (p + 1) % pages), 8000);
    return () => clearInterval(id);
  }, [tv, lb?.rows.length]);

  const rows = useMemo(() => {
    if (!lb) return [];
    if (!tv) return lb.rows;
    return lb.rows.slice(tvPage * 14, tvPage * 14 + 14);
  }, [lb, tv, tvPage]);

  if (!tournament || !lb) {
    return <div className="ds-sc"><Skeleton h={40} w="60%" /><Skeleton h={400} w="100%" /></div>;
  }

  const tickerItems = patterns.ticker && features.spectatorFeed
    ? audit.slice(-10).reverse().map((a) => <span key={a.actionId}>{a.summary}</span>)
    : [];

  return (
    <div className="ds-sc" style={tv ? { maxWidth: '100%' } : undefined}>
      {!tv && <Crumbs items={[{ to: '/', label: t('nav.home') }, { to: `/t/${tid}`, label: tournament.name }, { label: t('board.title') }]} />}

      <div className="ds-lb__head">
        <div className="ds-row">
          {!tv && null}
          <h1 className="ds-h1" style={{ margin: 0, fontSize: tv ? 30 : undefined }}>{tv ? tournament.name : t('board.title')}</h1>
          <Badge tone="primary" live>LIVE</Badge>
          {status !== 'online' ? <Badge tone="danger">{t(`sync.${status}`)}</Badge> : null}
          <span className="ds-muted" style={{ fontSize: 13 }}>
            {t('board.updatedAgo', { ago: ago(lastServerTs, i18n.language) })}
          </span>
        </div>
        {!tv && (
          <div className="ds-row ds-row--wrap">
            {features.exportCsv ? (
              <Button variant="ghost" onClick={() => downloadCsv(lb.rows, mode)} aria-label={t('admin.export')}>
                <Icon name="download" size={18} /> CSV
              </Button>
            ) : null}
            {features.tvMode ? (
              <Link to={`/t/${tid}/board?tv=1`}><Button variant="ghost"><Icon name="live" size={18} /> {t('board.tv')}</Button></Link>
            ) : null}
          </div>
        )}
      </div>

      {!tv && (
        <div className="ds-row ds-row--wrap" style={{ gap: 10 }}>
          <Segmented
            ariaLabel={t('board.gross')}
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[
              ...(isStableford
                ? [{ value: 'points' as const, label: t('board.points') }]
                : [
                  { value: 'gross' as const, label: t('board.gross') },
                  { value: 'net' as const, label: t('board.net') },
                  { value: 'points' as const, label: t('board.points') },
                ]),
            ]}
          />
          {tournament.flights.length > 0 ? (
            <Select value={flight} onChange={(e) => setFlight(e.target.value)} aria-label={t('board.flight')} style={{ minWidth: 130 }}>
              <option value="all">{t('board.all')}</option>
              {tournament.flights.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          ) : null}
          {tournament.rounds.length > 1 && features.flightsAdmin ? (
            <Select value={String(round)} onChange={(e) => setRound(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label={t('board.round')}>
              <option value="all">{t('board.total')}</option>
              {tournament.rounds.map((r) => <option key={r.index} value={r.index}>R{r.index + 1}</option>)}
            </Select>
          ) : null}
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('board.search')} aria-label={t('board.search')} style={{ maxWidth: 220 }} />
        </div>
      )}

      <div className="ds-lb" role="table" aria-label={t('board.title')} aria-live="off">
        <div className="ds-lbrow ds-lbrow--head" role="row">
          <span role="columnheader">{t('board.pos')}</span>
          <span role="columnheader">{t('board.player')}</span>
          <span role="columnheader" style={{ textAlign: 'right' }}>{mode === 'points' ? t('board.points') : t('board.topar')}</span>
          <span role="columnheader" style={{ textAlign: 'right' }}>{t('board.thru')}</span>
          <span role="columnheader" className="ds-lb__today" style={{ textAlign: 'right' }}>{t('board.today')}</span>
        </div>
        {rows.map((r) => (
          <Row
            key={r.playerId}
            row={r} mode={mode}
            delta={delta.has(r.playerId)}
            open={open === r.playerId}
            onToggle={() => setOpen(open === r.playerId ? null : r.playerId)}
          />
        ))}
        {lb.inactive.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            {lb.inactive.map((r) => (
              <div className="ds-lbrow" key={r.playerId} style={{ opacity: 0.75 }}>
                <span className="ds-lb__pos">—</span>
                <span className="ds-lb__name">
                  {r.name}{' '}
                  <span className="ds-status-pill">{r.status.toUpperCase()}</span>
                  <span className="ds-lb__sub">{r.statusReason}</span>
                </span>
                <span className="ds-lb__topar">{toParLabel(r.totalToPar)}</span>
                <span className="ds-lb__thru num">{r.thru}</span>
                <span className="ds-lb__today" />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {isSkins && features.teamFormats ? <SkinsPanel rows={lb.rows} /> : null}
      {features.heatmap ? <HeatmapPanel rows={lb.rows} /> : null}
      {features.social || features.autoCommentary ? <FeedPanel audit={audit} rows={lb.rows} /> : null}
      {tickerItems.length > 0 ? <Ticker items={tickerItems} ariaLabel="ticker" /> : null}
    </div>
  );
}

function ago(ts: number, locale: string): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return locale === 'ru' ? 'только что' : 'just now';
  return `${s} ${locale === 'ru' ? 'с назад' : 's ago'}`;
}

function Row({ row: r, mode, delta, open, onToggle }: { row: LeaderboardRow; mode: Mode; delta: boolean; open: boolean; onToggle: () => void }) {
  const main = mode === 'points' ? String(r.totalPoints) : toParLabel(mode === 'net' ? r.totalNetToPar : r.totalToPar);
  const under = mode !== 'points' && (mode === 'net' ? r.totalNetToPar : r.totalToPar) < 0;
  const over = mode !== 'points' && (mode === 'net' ? r.totalNetToPar : r.totalToPar) > 0;
  return (
    <>
      <button
        className={`ds-lbrow ${delta ? 'is-delta' : ''} ${r.pos === 1 ? 'is-lead' : ''}`}
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: '100%', textAlign: 'left' }}
      >
        <span className="ds-lb__pos num">{r.pos}{r.tied ? 'T' : ''}</span>
        <span className="ds-lb__name">
          {r.name}
          <span className="ds-lb__sub">HI {r.hi.toFixed(1)} · PH {r.ph}{r.flightId ? ` · ${r.flightId}` : ''}</span>
        </span>
        <span className={`ds-lb__topar ${under ? 'is-under' : ''} ${over ? 'is-over' : ''}`}>{main}</span>
        <span className="ds-lb__thru num">{r.thru}</span>
        <span className="ds-lb__today num">{toParLabel(r.todayToPar)}</span>
      </button>
      {open ? (
        <div className="ds-lbdetail">
          <HoleGrid row={r} />
        </div>
      ) : null}
    </>
  );
}

function HoleGrid({ row }: { row: LeaderboardRow }) {
  const { t } = useTranslation();
  const cur = row.rounds.filter(Boolean).reverse()[0];
  if (!cur) return <div className="ds-muted">{t('board.thru')} 0</div>;
  return (
    <div className="ds-holes">
      {cur.byHole.map((h) => {
        const cls = !h.played ? 'is-empty'
          : h.gross != null && h.gross < h.par ? 'is-birdie'
          : h.gross != null && h.gross > h.par ? 'is-bogey' : '';
        return (
          <div key={h.hole} className={`ds-holes__cell ${cls}`} title={`#${h.hole} par ${h.par} SI ${h.si}`}>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{h.hole}{h.strokesReceived > 0 ? ' ★'.repeat(Math.min(3, h.strokesReceived)) : ''}</div>
            <div>{h.pickup ? 'X' : h.gross ?? '·'}</div>
          </div>
        );
      })}
    </div>
  );
}

function SkinsPanel({ rows }: { rows: LeaderboardRow[] }) {
  const { t } = useTranslation();
  const res = useMemo(() => {
    const values = rows.slice(0, 12).map((r) => ({
      id: r.playerId,
      values: (r.rounds[0]?.byHole ?? []).map((h) => (h.played ? h.net ?? h.gross : undefined)),
    }));
    return allocateSkins(values, { carryover: true });
  }, [rows]);
  const nameOf = (id: string) => rows.find((r) => r.playerId === id)?.name ?? id;
  return (
    <Card>
      <h2 className="ds-h2" style={{ marginTop: 0 }}>{t('format.skins')}</h2>
      <table className="ds-table">
        <thead><tr><th>{t('board.player')}</th><th className="num">skins</th><th className="num">{t('skins.pot')}</th></tr></thead>
        <tbody>
          {Object.entries(res.totals).sort((a, b) => b[1].skins - a[1].skins).map(([pid, v]) => (
            <tr key={pid}><td>{nameOf(pid)}</td><td className="num">{v.skins}</td><td className="num">{v.units}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="ds-row ds-row--wrap" style={{ marginTop: 10 }}>
        {res.holeResults.map((h) => (
          <Badge key={h.hole} tone={h.winner ? 'accent' : 'muted'}>
            {h.hole}: {h.winner ? `${nameOf(h.winner).split(' ')[0]} ${h.pot}` : h.carry ? '↻' : '—'}
          </Badge>
        ))}
      </div>
      {res.unallocated > 0 ? <p className="ds-muted">carryover: {res.unallocated} ({t('skins.carry')})</p> : null}
    </Card>
  );
}

function HeatmapPanel({ rows }: { rows: LeaderboardRow[] }) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    const acc = new Map<number, { sum: number; n: number; par: number }>();
    for (const r of rows) {
      for (const h of r.rounds[0]?.byHole ?? []) {
        if (!h.played || h.gross == null) continue;
        const a = acc.get(h.hole) ?? { sum: 0, n: 0, par: h.par };
        a.sum += h.gross - h.par; a.n += 1;
        acc.set(h.hole, a);
      }
    }
    return [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([hole, a]) => ({ hole, avg: a.sum / a.n }));
  }, [rows]);
  return (
    <Card>
      <h2 className="ds-h2" style={{ marginTop: 0 }}>{t('profile.trend')} · holes</h2>
      <div className="ds-row ds-row--wrap">
        {data.map((d) => (
          <span key={d.hole} className="ds-chip" style={{
            background: d.avg > 0.5 ? 'color-mix(in srgb, var(--c-danger) 18%, var(--c-surface))'
              : d.avg < -0.2 ? 'color-mix(in srgb, var(--c-live) 22%, var(--c-surface))' : undefined,
          }}>
            {d.hole} <span className="num" style={{ marginLeft: 6 }}>{d.avg > 0 ? '+' : ''}{d.avg.toFixed(1)}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

function FeedPanel({ audit, rows }: { audit: { actionId: string; summary: string; serverTs: number }[]; rows: LeaderboardRow[] }) {
  const { t, i18n } = useTranslation();
  void rows;
  const [comments, setComments] = useState<{ id: string; text: string; ts: number }[]>(() => {
    try { return JSON.parse(localStorage.getItem('csl.comments') ?? '[]'); } catch { return []; }
  });
  const [text, setText] = useState('');
  const post = () => {
    if (!text.trim()) return;
    const next = [{ id: `c${Date.now()}`, text: text.trim(), ts: Date.now() }, ...comments].slice(0, 50);
    setComments(next);
    setText('');
    try { localStorage.setItem('csl.comments', JSON.stringify(next)); } catch { /* ignore */ }
  };
  return (
    <Card>
      <h2 className="ds-h2" style={{ marginTop: 0 }}>{t('comments.title')}</h2>
      <div className="ds-sc" style={{ gap: 6 }}>
        {audit.slice(-6).reverse().map((a) => (
          <div key={a.actionId} className="ds-row" style={{ fontSize: 14 }}>
            <span className="ds-livedot" aria-hidden="true" />
            <span>{a.summary}</span>
            <span className="ds-muted" style={{ fontSize: 12 }}>{fmt.time(a.serverTs, i18n.language)}</span>
          </div>
        ))}
        {comments.map((c) => <div key={c.id} style={{ fontSize: 15 }}>{c.text}</div>)}
      </div>
      <div className="ds-row" style={{ marginTop: 10 }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('comments.placeholder')}
          onKeyDown={(e) => e.key === 'Enter' && post()} />
        <Button variant="primary" onClick={post}>OK</Button>
      </div>
    </Card>
  );
}

function downloadCsv(rows: LeaderboardRow[], mode: Mode) {
  const head = 'pos;player;hi;ph;topar;nettopar;points;thru;gross\n';
  const body = rows.map((r) => [
    `${r.pos}${r.tied ? 'T' : ''}`, `"${r.name}"`, r.hi.toFixed(1), r.ph,
    mode === 'points' ? r.totalPoints : r.totalToPar, r.totalNetToPar, r.totalPoints, r.thru, r.totalGross,
  ].join(';')).join('\n');
  const blob = new Blob(['﻿' + head + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `leaderboard-${mode}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
