import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createBrowserRouter, RouterProvider, Outlet, Navigate, useParams,
} from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { initI18n } from '@csl/core';
import { applyTheme, initTheme, type DesignId, type Mode } from '@csl/tokens';
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

interface ThemeCtx { mode: Mode; setMode: (m: Mode) => void; config: AppConfig; features: VariantFeatures }
const Ctx = createContext<ThemeCtx>(null as unknown as ThemeCtx);
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
  const [mode, setModeState] = useState<Mode>(() => initTheme(config.design));
  const [i18n] = useState(() => initI18n('ru'));
  const features = VARIANT_FEATURES[config.variant];

  useEffect(() => { registerSW(); }, []);
  useEffect(() => { applyBranding(config); }, [config]);

  const setMode = (m: Mode) => {
    setModeState(m);
    applyTheme(config.design, m);
    try { localStorage.setItem('csl.mode', m); } catch { /* ignore */ }
  };

  const ctx = useMemo<ThemeCtx>(() => ({ mode, setMode, config, features }), [mode, config, features]);

  const router = useMemo(() => createBrowserRouter([
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
  ], { basename: basename() }), [ctx, features]);

  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>
  );
}

function basename(): string {
  // Vite base './': SPA живёт в директории страницы (GH Pages /<v>-<d>/), basename = её каталог
  try {
    const dir = new URL(document.baseURI).pathname.replace(/[^/]*$/, '');
    return dir.endsWith('/') ? dir.slice(0, -1) || '/' : dir;
  } catch { return '/'; }
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
