import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Field, Input, Switch } from '@csl/design-system';
import { useApp } from '../../root';
import { demoTournamentList } from '../../config';
import { useTourney } from '../../store-context';
import { extraTournaments } from './wizard-store';

/** Список турниров клуба (F3): демо-реестр + созданные мастером. */
export function AdminTournaments() {
  const { t, i18n } = useTranslation();
  const { config } = useApp();
  const lang = (i18n.language.startsWith('en') ? 'en' : 'ru') as 'ru' | 'en';
  const list = [...demoTournamentList(config.variant), ...extraTournaments()];
  return (
    <Card>
      <div className="ds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t('admin.tournaments')}</h2>
        <Link to="/admin/tournaments/new"><Button variant="accent">{t('admin.newTournament')}</Button></Link>
      </div>
      <div className="ds-lb">
        {list.map((x) => (
          <div key={x.id} className="ds-lbrow" style={{ '--cols': '1fr 110px 80px' } as React.CSSProperties}>
            <div>
              <Link className="ds-linkname" to={`/t/${x.id}`}>{x.name[lang] ?? x.name.ru}</Link>
              <div className="ds-muted">{t(`format.${x.format}`)} · {x.players} {t('lobby.players').toLowerCase()}</div>
            </div>
            <Badge tone={x.status === 'live' ? 'good' : 'muted'} live={x.status === 'live'}>{t(`status.${x.status === 'live' ? 'live' : x.status === 'finished' ? 'finished' : 'registration'}`)}</Badge>
            <Link to={`/t/${x.id}/board`}>{t('lobby.liveLink')}</Link>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Игроки клуба: ростер + пауза ввода для конкретного игрока (демо — флаг в UI). */
export function AdminPlayers() {
  const { t } = useTranslation();
  const tournament = useTourney((s) => s.tournament);
  const [paused, setPaused] = useState(false);
  const [q, setQ] = useState('');
  if (!tournament) return <Card><div className="ds-skeleton" style={{ height: 160 }} /></Card>;
  const rows = tournament.entries
    .map((e) => ({ ...e, player: tournament.players[e.playerId] }))
    .filter((r) => !q || r.player.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <div className="ds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t('admin.players')}</h2>
        <Switch checked={paused} onChange={setPaused} label={t('paused.switch')} />
      </div>
      {paused ? <p><Badge tone="danger">{t('paused.banner')}</Badge></p> : null}
      <Field label={t('board.search')}><Input value={q} onChange={(e) => setQ(e.target.value)} /></Field>
      <table className="ds-lb" style={{ '--cols': '1fr 80px 90px 70px' } as React.CSSProperties}>
        <thead className="ds-lb__head"><tr><th>{t('board.player')}</th><th>HI</th><th>tee</th><th>flight</th></tr></thead>
        <tbody>
          {rows.slice(0, 40).map((r) => (
            <tr key={r.playerId} className="ds-lbrow">
              <td><Link className="ds-linkname" to={`/p/${r.playerId}`}>{r.player.name}</Link></td>
              <td className="num">{r.player.hi.toFixed(1)}</td>
              <td>{r.teeSetKey}</td>
              <td>{r.flightId ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Настройки клуба (C): название/акцент. Branding — фича варианта C (VARIANTS.md). */
export function AdminClub() {
  const { t } = useTranslation();
  const { config } = useApp();
  const [club, setClub] = useState(() => {
    try { return (JSON.parse(localStorage.getItem('csl.club') ?? '{}') as { name?: string }).name ?? ''; } catch { return ''; }
  });
  const [acc, setAcc] = useState('#14532d');
  const [saved, setSaved] = useState(false);
  const apply = () => {
    try { localStorage.setItem('csl.club', JSON.stringify({ name: club, brand: { color: acc } })); } catch { /* quota */ }
    if (config.variant === 'c') document.documentElement.style.setProperty('--ds-acc', acc);
    setSaved(true);
  };
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{t('admin.club')}</h2>
      <Field label={t('admin.clubName')}><Input value={club} onChange={(e) => setClub(e.target.value)} placeholder="ГК «Дубровка»" /></Field>
      {config.variant === 'c' ? (
        <Field label={t('admin.accent')} hint="WCAG: контраст проверяется CI-чеком (NFR §4)">
          <Input type="color" value={acc} onChange={(e) => setAcc(e.target.value)} style={{ height: 48, padding: 4, maxWidth: 120 }} />
        </Field>
      ) : (
        <p className="ds-muted">{t('admin.cVariantOnly')}</p>
      )}
      <div className="ds-row">
        <Button variant="primary" onClick={apply}>{t('courses.save')}</Button>
        {saved ? <Badge tone="good">{t('courses.saved')}</Badge> : null}
      </div>
    </Card>
  );
}

/** Аудит действий (RULES §10, NFR §6): хвост журнала + экспорт. */
export function AdminAudit() {
  const { t } = useTranslation();
  const audit = useTourney((s) => s.audit);
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'audit.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Card>
      <div className="ds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t('admin.audit')}</h2>
        <Button variant="ghost" onClick={exportJson}>⤓ JSON</Button>
      </div>
      <p className="ds-muted">{t('audit.hint')}</p>
      {audit.length === 0 ? <p className="ds-muted">{t('feed.empty')}</p> : (
        <ul className="ds-feed">
          {audit.slice(-30).reverse().map((a) => (
            <li key={a.actionId}>
              <div><code className="num">#{a.seq}</code> {a.summary}</div>
              <div className="ds-feed__meta">
                {a.authorRole} · <code>{a.actionId.slice(0, 10)}</code> · {a.result}
                {a.superseded ? <> → <code>{a.superseded.slice(0, 10)}</code></> : null} · <time>{new Date(a.serverTs).toLocaleTimeString()}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
