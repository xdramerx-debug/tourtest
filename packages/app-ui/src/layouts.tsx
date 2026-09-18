import React from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { Icon, IconButton } from '@csl/design-system';
import { themeById, MODES, type Mode } from '@csl/tokens';
import { OptionalConnBadge, useMaybeStore } from './store-context';
import { useApp } from './root';
import { demoTournamentList } from './config';

export function AppLayout() {
  const { t } = useTranslation();
  const { config, mode, setMode, features } = useApp();
  const theme = themeById[config.design];
  const loc = useLocation();
  const store = useMaybeStore();
  const firstLive = demoTournamentList(config.variant).find((x) => x.status === 'live')!;
  const session = store?.getState().session;

  const clubName = (() => {
    try {
      const raw = localStorage.getItem('csl.club');
      if (raw) return (JSON.parse(raw) as { name?: string }).name ?? 'ГК «Дубровка»';
    } catch { /* ignore */ }
    return 'ГК «Дубровка»';
  })();

  const nextMode: Mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  const modeIcon = mode === 'sun' ? 'sun' : mode === 'dark' ? 'moon' : 'sun';

  return (
    <div className="ds-app">
      <header className="ds-top">
        <Link to="/" className="ds-top__brand" aria-label={t('app.title')}>
          <Icon name="flag" size={22} />
          <span>{clubName}</span>
          <span className="ds-muted" style={{ fontSize: 12, fontWeight: 500 }}>{theme.name}</span>
        </Link>
        <nav className="ds-topnav" aria-label="main">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'is-active' : ''}>{t('nav.home')}</NavLink>
          <NavLink to={`/t/${firstLive.id}/board`} className={({ isActive }) => isActive ? 'is-active' : ''}>{t('nav.live')}</NavLink>
          {session?.playerId ? <NavLink to={`/t/${firstLive.id}/play`} className={({ isActive }) => isActive ? 'is-active' : ''}>{t('nav.myCard')}</NavLink> : null}
          {features.history ? <NavLink to="/history" className={({ isActive }) => isActive ? 'is-active' : ''}>{t('nav.history')}</NavLink> : null}
          <NavLink to="/admin" className={({ isActive }) => isActive ? 'is-active' : ''}>{t('nav.admin')}</NavLink>
        </nav>
        <div className="ds-top__spacer" />
        <OptionalConnBadge />
        <IconButton aria-label={`mode: ${nextMode}`} title={`${t('mode.sun')}/${t('mode.dark')}`} onClick={() => setMode(nextMode)}>
          <Icon name={modeIcon} />
        </IconButton>
        <IconButton
          aria-label="language"
          onClick={() => void i18next.changeLanguage(i18next.language === 'ru' ? 'en' : 'ru')}
          title="RU/EN"
        >
          <span style={{ fontWeight: 800, fontSize: 13 }}>{(i18next.language || 'ru').toUpperCase().slice(0, 2)}</span>
        </IconButton>
      </header>

      <main className="ds-main">
        <Outlet />
      </main>

      {!loc.pathname.endsWith('/board') ? (
        <Link className="ds-floatlive" to={`/t/${firstLive.id}/board`} aria-label={t('nav.backToLive')}>
          <span className="ds-chip is-active" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="ds-livedot" /> Live
          </span>
        </Link>
      ) : null}

      <nav className="ds-tabbar" aria-label="mobile">
        <TabItem to="/" icon="home" label={t('nav.home')} active={loc.pathname === '/'} />
        <TabItem to={`/t/${firstLive.id}/board`} icon="live" label={t('nav.live')} active={loc.pathname.includes('/board')} />
        <TabItem to={`/t/${firstLive.id}/play`} icon="card" label={t('nav.myCard')} active={loc.pathname.includes('/play')} />
        <TabItem to="/history" icon="clock" label={t('nav.history')} active={loc.pathname.startsWith('/history')} />
      </nav>
    </div>
  );
}

function TabItem({ to, icon, label, active }: { to: string; icon: 'home' | 'live' | 'card' | 'clock'; label: string; active: boolean }) {
  return (
    <Link to={to} className={`ds-tabbar__item ${active ? 'is-active' : ''}`}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </Link>
  );
}

export function Crumbs({ items }: { items: { to?: string; label: React.ReactNode }[] }) {
  return (
    <nav className="ds-crumbs" aria-label="breadcrumbs">
      {items.map((it, i) => (
        <span key={i} className="ds-row" style={{ gap: 8 }}>
          {i > 0 ? <span aria-hidden="true">/</span> : null}
          {it.to && i < items.length - 1 ? <Link to={it.to}>{it.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
