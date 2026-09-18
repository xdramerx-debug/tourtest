import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { Icon, IconButton } from '@csl/design-system';
import { themeById, MODES, type DesignId, type Mode } from '@csl/tokens';
import { OptionalConnBadge, useMaybeStore } from './store-context';
import { useApp } from './root';
import { demoTournamentList } from './config';
import { DESIGN_IDS } from './theme-switch';

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
        {config.themeSwitch ? <ThemePicker /> : null}
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

/** v2: пикер пяти премиум-шаблонов — переключение на лету (USER_FLOWS F0+v2). */
function ThemePicker() {
  const { t } = useTranslation();
  const { design, setDesign } = useApp();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="ds-theme" ref={boxRef}>
      <button
        type="button"
        className="ds-theme__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('themes.picker')}
        title={`${t('nav.themes')} · ${t('themes.hotkey')}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ds-theme__swatches" aria-hidden="true">
          {DESIGN_IDS.map((id) => (
            <span key={id} className={`ds-theme__dot ds-theme__dot--${id} ${id === design ? 'is-active' : ''}`} />
          ))}
        </span>
        <span className="ds-theme__label">{t(`themes.names.${design}`)}</span>
        <Icon name="settings" size={16} />
      </button>
      {open ? (
        <div className="ds-theme__menu" role="listbox" aria-label={t('themes.picker')}>
          {DESIGN_IDS.map((id: DesignId) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={id === design}
              className={`ds-theme__item ${id === design ? 'is-active' : ''}`}
              onClick={() => { setDesign(id); setOpen(false); }}
            >
              <span className={`ds-theme__dot ds-theme__dot--${id}`} aria-hidden="true" />
              <span className="ds-theme__itemname">{t(`themes.names.${id}`)}</span>
              <kbd className="ds-theme__kbd" aria-hidden="true">Alt+{id}</kbd>
            </button>
          ))}
          <div className="ds-theme__hint ds-muted">{t('themes.hotkey')}</div>
        </div>
      ) : null}
    </div>
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
