import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createHashRouter, RouterProvider, Outlet, Navigate, useParams,
} from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { initI18n } from '@csl/core';
import { applyTheme, initTheme, type DesignId, type Mode } from '@csl/tokens';
import {
  hotkeyDesign, nextDesign, persistDesign, resolveInitialDesign, syncUrlDesign,
} from './theme-switch';
import { TournamentProvider } from './store-context';
import { demoTournamentList, MODE_ORDER, VARIANT_FEATURES, type AppConfig, type DemoTournamentInfo, type VariantFeatures } from './config';
import { extraTournaments } from './screens/admin/wizard-store';
import { AppLayout } from './layouts';
import { HomeScreen } from './screens/Home';
import { JoinScreen } from './screens/Join';
import { LobbyScreen } from './screens/Lobby';
import { BoardScreen } from './screens/Board';
import { PlayScreen } from './screens/Play';
import { ProfileScreen } from './screens/Profile';
import { HistoryScreen } from './screens/History';
import { MatchScreen } from './screens/Match';
import { AdminLayout } from './screens/admin/AdminLayout';
import { AdminDashboard } from './screens/admin/AdminDashboard';
import { WizardScreen as TournamentWizard } from './screens/admin/Wizard';
import { AdminScores } from './screens/admin/AdminScores';
import { AdminCourses } from './screens/admin/AdminCourses';
import { AdminPlayers, AdminClub, AdminAudit, AdminTournaments } from './screens/admin/AdminMisc';
import { registerSW } from './sw';

interface ThemeCtx {
  mode: Mode; setMode: (m: Mode) => void;
  config: AppConfig; features: VariantFeatures;
  /** v2: текущий дизайн-шаблон (реактивен!) и смена на лету */
  design: DesignId; setDesign: (d: DesignId) => void;
}
const Ctx = createContext<ThemeCtx>(null as unknown as ThemeCtx);
export const AppContext = Ctx;
export const useApp = () => useContext(Ctx);

function findInfo(variant: AppConfig['variant'], tid: string | undefined): DemoTournamentInfo {
  const list = [...demoTournamentList(variant), ...extraTournaments()];
  return list.find((x) => x.id === tid) ?? { ...list[0], id: tid ?? list[0].id };
}

function WithTournament({ children }: { children: React.ReactNode }) {
  const { config } = useApp();
  const { tid } = useParams();
  const info = useMemo(() => {
    const base = findInfo(config.variant, tid);
    // пользовательский турнир из мастера имеет свои players/flights — читаем флаг
    return base;
  }, [config.variant, tid]);
  return <TournamentProvider info={info} key={info.id}>{children}</TournamentProvider>;
}

export function AppRoot({ config }: { config: AppConfig }) {
  // v2: дизайн — реактивное состояние (горячее переключение без перезагрузки);
  // ?theme=N → localStorage → системная тёмная тема → config.design (см. theme-switch.ts)
  const [design, setDesignState] = useState<DesignId>(() => {
    if (!config.themeSwitch || typeof window === 'undefined') return config.design;
    const res = resolveInitialDesign({
      search: window.location.search,
      storage: localStorage,
      systemDark: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
      defaultDesign: config.design,
    });
    if (res.source === 'url') persistDesign(res.design); // пришли по ссылке — зафиксировать как предпочтение
    return res.design;
  });
  const [mode, setModeState] = useState<Mode>(() => initTheme(design));
  const [i18n] = useState(() => initI18n('ru'));
  const features = VARIANT_FEATURES[config.variant];

  useEffect(() => { registerSW(); }, []);
  useEffect(() => { applyBranding(config); }, [config]);

  const designRef = useRef(design);
  designRef.current = design;

  const setDesign = (d: DesignId) => {
    if (d === designRef.current) return;
    setDesignState(d);
    persistDesign(d);
    syncUrlDesign(d);
    applyTheme(d, modeRef.current);
  };

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const setMode = (m: Mode) => {
    setModeState(m);
    applyTheme(designRef.current, m);
    try { localStorage.setItem('csl.mode', m); } catch { /* ignore */ }
  };

  // v2: горячие клавиши Alt+T (цикл) и Alt+1..5 (прямой выбор); не перехватываем в полях ввода
  useEffect(() => {
    if (!config.themeSwitch) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      const r = hotkeyDesign(e.key, e.altKey);
      if (!r) return;
      e.preventDefault();
      setDesign(r === 'cycle' ? nextDesign(designRef.current) : r);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [config.themeSwitch]);

  const ctx = useMemo<ThemeCtx>(() => ({
    mode, setMode, features, design, setDesign,
    // потребители читают themeById[config.design] — подменяем реактивной версией (экраны не правим)
    config: { ...config, design },
  }), [mode, features, design, config]);

  // SSR (тесты/рендер-статистика): контекст должен быть доступен и вне RouterProvider
  void i18n;

  // HashRouter (D9): статический хостинг с произвольным префиксом — относительный
  // base './' не ломает загрузку модулей; deep-link на чистый путь переводится в hash из 404.html.
  const router = useMemo(() => createHashRouter([
    {
      path: '/',
      element: <Ctx.Provider value={ctx}><AppLayout /></Ctx.Provider>,
      children: [
        { index: true, element: <HomeScreen /> },
        { path: 'join', element: <JoinScreen /> },
        { path: 'join/:code', element: <JoinScreen /> },
        { path: 't/:tid', element: <WithTournament><LobbyScreen /></WithTournament> },
        { path: 't/:tid/board', element: <WithTournament><BoardScreen /></WithTournament> },
        { path: 't/:tid/play', element: <WithTournament><PlayScreen /></WithTournament> },
        { path: 't/:tid/play/h/:n', element: <WithTournament><PlayScreen /></WithTournament> },
        ...(features.matchPlay ? [{ path: 't/:tid/match/:mid', element: <WithTournament><MatchScreen /></WithTournament> }] : []),
        { path: 'p/:pid', element: <WithTournament><ProfileScreen /></WithTournament> },
        { path: 'history', element: <HistoryScreen /> },
        {
          path: 'admin',
          element: <WithTournament><AdminLayout /></WithTournament>,
          children: [
            { index: true, element: <AdminDashboard /> },
            { path: 'tournaments', element: <AdminTournaments /> },
            { path: 'tournaments/new', element: <TournamentWizard /> },
            { path: 'scores', element: <AdminScores /> },
            { path: 'courses', element: <AdminCourses /> },
            { path: 'players', element: <AdminPlayers /> },
            { path: 'club', element: <AdminClub /> },
            { path: 'audit', element: <AdminAudit /> },
          ],
        },
        { path: 'offline', element: <OfflineStub /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ]), [ctx, features]);

  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>
  );
}



function OfflineStub() {
  return (
    <div className="ds-empty">
      <h2>Нет сети и нет сохранённой копии</h2>
      <p>Когда приложение откроется хотя бы раз онлайн, всё будет доступно офлайн.</p>
    </div>
  );
}

/** Клубный брендинг (C): переопределение primary/акцента из localStorage-настроек клуба. */
function applyBranding(config: AppConfig) {
  if (!VARIANT_FEATURES[config.variant].branding) return;
  try {
    const raw = localStorage.getItem('csl.club');
    if (!raw) return;
    const club = JSON.parse(raw) as { brand?: { color?: string }; name?: string };
    if (club.brand?.color) {
      document.documentElement.style.setProperty('--c-primary', club.brand.color);
    }
  } catch { /* ignore */ }
}

export { MODE_ORDER };
export type { DemoTournamentInfo };
export { findInfo };
