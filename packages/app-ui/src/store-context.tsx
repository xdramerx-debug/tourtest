import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { TourneyStore, TourneyState } from '@csl/sync';
import { createTournamentStore, DemoTransport, type ConnState } from '@csl/sync';
import { buildLeaderboard, type BoardMode } from '@csl/scoring-engine';
import type { Entry, FormatId } from '@csl/core';
import type { DemoTournamentInfo } from './config';

/** StoreContext: один активный турнир на приложение (IA: живой турнир клуба). */
const StoreContext = createContext<TourneyStore | null>(null);

export function TournamentProvider({ info, children }: { info: DemoTournamentInfo | null; children: React.ReactNode }) {
  const [store, setStore] = useState<TourneyStore | null>(null);

  useEffect(() => {
    if (!info) { setStore(null); return; }
    const transport = new DemoTransport({
      tournamentId: info.id,
      format: info.format as FormatId,
      players: info.players, flights: info.flights, teams: info.teams, rounds: info.rounds,
      startProgress: info.startProgress,
      simulate: info.status === 'live',
      tickMs: 5000,
    });
    const st = createTournamentStore({ transport, sessionStorageKey: `csl.session.${info.id}` });
    setStore(st);
    void st.connect();
    return () => { st.destroy(); transport.destroy(); };
  }, [info?.id]);

  if (!store) return <>{children}</>;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useTourneyStore(): TourneyStore {
  const st = useContext(StoreContext);
  if (!st) throw new Error('TournamentProvider отсутствует');
  return st;
}

/** Может быть null до подключения — экраны обязаны иметь skeleton-состояние. */
export function useTourney<T>(sel: (s: TourneyState) => T): T {
  const store = useTourneyStore();
  return useStore(store, sel);
}

/** Накладывает актуальные статусы (DQ/WD/DNS из журнала) на entry. */
function entriesWithStatus(entries: Entry[], statusByPlayer: Record<string, { status: Entry['status']; reason?: string }>): Entry[] {
  return entries.map((e) => {
    const st = statusByPlayer[e.playerId];
    return st ? { ...e, status: st.status, statusReason: st.reason } : e;
  });
}

export function useLeaderboard(mode: BoardMode, opts: { flight?: string | 'all'; round?: number | 'all'; search?: string } = {}) {
  const tournament = useTourney((s) => s.tournament);
  const scores = useTourney((s) => s.scores);
  const statusByPlayer = useTourney((s) => s.statusByPlayer);

  return useMemo(() => {
    if (!tournament) return null;
    const t = { ...tournament, entries: entriesWithStatus(tournament.entries, statusByPlayer) };
    const lb = buildLeaderboard({ tournament: t, scores, mode, roundIndex: opts.round ?? 'all' });
    let rows = lb.rows;
    let inactive = lb.inactive;
    if (opts.flight && opts.flight !== 'all') {
      rows = rows.filter((r) => r.flightId === opts.flight);
      inactive = inactive.filter((r) => r.flightId === opts.flight);
    }
    if (opts.search?.trim()) {
      const q = opts.search.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
      inactive = inactive.filter((r) => r.name.toLowerCase().includes(q));
    }
    return { rows, inactive, computedAt: lb.computedAt, tournament: t };
  }, [tournament, scores, statusByPlayer, mode, opts.flight, opts.round, opts.search]);
}

/** Дельта-подсветка: множество playerId, чей ключ изменился с прошлого рендера. */
export function useDeltaRows(signature: Map<string, string> | null): Set<string> {
  const prev = useRef<Map<string, string> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!signature) return;
    const next = new Set<string>();
    if (prev.current) {
      for (const [id, sig] of signature) {
        if (prev.current.get(id) !== sig) next.add(id);
      }
    }
    prev.current = signature;
    if (next.size) {
      setChanged(next);
      const t = setTimeout(() => setChanged(new Set()), 3200);
      return () => clearTimeout(t);
    }
  }, [signature]);
  return changed;
}

export function useConnInfo(): { state: ConnState; queued: number; at: number } {
  const state = useTourney((s) => s.status);
  const queued = useTourney((s) => s.queued);
  const at = useTourney((s) => s.lastServerTs);
  return { state, queued, at };
}

/** Бейдж связи для экранов БЕЗ провайдера турнира (главная/история) — пусто там. */
import { OfflineBar as DsOfflineBar } from '@csl/design-system';
import { useTranslation } from 'react-i18next';

export function OptionalConnBadge({ dataAt }: { dataAt?: string }) {
  const st = useContext(StoreContext);
  return st ? <ConnBadgeInner st={st} dataAt={dataAt} /> : null;
}
function ConnBadgeInner({ st, dataAt }: { st: TourneyStore; dataAt?: string }) {
  const { t } = useTranslation();
  const state = useStore(st, (s) => s.status);
  const queued = useStore(st, (s) => s.queued);
  return (
    <DsOfflineBar
      state={state} queued={queued} dataAt={dataAt}
      labels={{
        online: t('sync.online'), offline: t('sync.offline'),
        queued: t('sync.queued', { n: '__N__' }).replace('__N__', '{{n}}'),
        dataAt: t('sync.dataAt', { time: '__T__' }).replace('__T__', '{{time}}'),
      }}
    />
  );
}

/** Признак «внутри турнирного провайдера». */
export function useMaybeStore(): TourneyStore | null {
  return useContext(StoreContext);
}
