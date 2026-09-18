import { beforeAll, describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { initI18n } from '@csl/core';
import { createTournamentStore, DemoTransport } from '@csl/sync';
import { TourneyStoreContext } from '../src/store-context';
import { AppContext } from '../src/root';
import { VARIANT_FEATURES } from '../src/config';
import { BoardScreen } from '../src/screens/Board';
import { LobbyScreen } from '../src/screens/Lobby';
import { PlayScreen } from '../src/screens/Play';
import { ProfileScreen } from '../src/screens/Profile';
import { MatchScreen } from '../src/screens/Match';
import { AdminLayout } from '../src/screens/admin/AdminLayout';

/**
 * Headless-локализация e2e-падений: в CI маршруты с TournamentProvider давали
 * пустой экран. SSR-рендер на подключённом DemoTransport ловит рантайм-крэши
 * рендера каждого экрана на ЖИВЫХ данных (48 игроков, 9 лунок прогресса).
 */

let store: ReturnType<typeof createTournamentStore>;
const i18n = initI18n('ru');

beforeAll(async () => {
  const transport = new DemoTransport({
    tournamentId: 't-open', players: 48, flights: 2, rounds: 1, startProgress: 9,
    simulate: false, tickMs: 60000,
  });
  const base = createTournamentStore({ transport });
  await base.connect();
  // сессия игрока до заморозки snapshot: SSR читает getInitialState (zustand v5)
  const { joinCode } = base.getState().tournament!;
  const joined = base.join({ code: joinCode, name: 'SSR Тестер', hi: 18, teeSetKey: 'mens', asMarker: false });
  if (!joined.ok) throw new Error(`join failed: ${joined.error}`);
  // zustand v5 на SSR читает getInitialState (пустое) — оборачиваем store,
  // чтобы SSR видел то же, что браузер после гидрации (getState == getInitialState).
  const state = base.getState();
  store = {
    ...base,
    getState: base.getState.bind(base),
    subscribe: base.subscribe.bind(base),
    getInitialState: () => state,
  } as unknown as typeof base;
}, 20000);

function renderWithStore(node: React.ReactNode) {
  const ctx = {
    mode: 'light' as const,
    setMode: () => {},
    config: { variant: 'b' as const, design: '1' as const },
    features: VARIANT_FEATURES.b,
  };
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <AppContext.Provider value={ctx}>
        <TourneyStoreContext.Provider value={store}>
          <MemoryRouter initialEntries={['/t/t-open/board?x=1']}>{node}</MemoryRouter>
        </TourneyStoreContext.Provider>
      </AppContext.Provider>
    </I18nextProvider>,
  );
}

describe('экраны на живом demo-store (диагностика)', () => {
  it('данные подключились', () => {
    // 48 ботов + SSR-игрок из join (beforeAll)
    expect(store.getState().tournament?.entries.length).toBeGreaterThanOrEqual(48);
    expect(Object.keys(store.getState().scores[0] ?? {}).length).toBeGreaterThan(0);
  });
  it('Board рендерится', () => {
    const html = renderWithStore(<BoardScreen />);
    expect(html.length).toBeGreaterThan(200);
  });
  it('Lobby рендерится', () => {
    expect(renderWithStore(<LobbyScreen />).length).toBeGreaterThan(200);
  });
  it('Play рендерится', () => {
    // без сессии Play — редирект на /join (SSR <Navigate> пуст); сессия создана в beforeAll
    expect(store.getState().session?.playerId).toBeTruthy();
    expect(renderWithStore(<PlayScreen />).length).toBeGreaterThan(200);
  });
  it('Profile рендерится', () => {
    expect(renderWithStore(<ProfileScreen />).length).toBeGreaterThan(50);
  });
  it('Match рендерится', () => {
    expect(renderWithStore(<MatchScreen />).length).toBeGreaterThan(50);
  });
  it('AdminLayout рендерится', () => {
    expect(renderWithStore(<AdminLayout />).length).toBeGreaterThan(50);
  });
});
