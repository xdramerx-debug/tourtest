import type { DesignId, Mode } from '@csl/tokens';

export type VariantId = 'a' | 'b' | 'c';

export interface AppConfig {
  variant: VariantId;
  design: DesignId;
  /** имя турнира/клуба по умолчанию для витрины-демо */
  clubName?: string;
}

/** Фича-матрица вариантов (VARIANTS.md): приложение выбирает состав роутов, а не if-флаги в пакетах. */
export const VARIANT_FEATURES = {
  a: {
    matchPlay: false, teamFormats: false, flightsAdmin: false, teeTimes: false,
    exportCsv: false, tvMode: false, spectatorFeed: false,
    pwaInstall: false, push: false, social: false, playerStats: false, heatmap: false,
    autoCommentary: false, branding: false, history: true,
    formats: ['stroke', 'stableford'] as const,
  },
  b: {
    matchPlay: true, teamFormats: true, flightsAdmin: true, teeTimes: true,
    exportCsv: true, tvMode: true, spectatorFeed: true,
    pwaInstall: false, push: false, social: false, playerStats: false, heatmap: false,
    autoCommentary: false, branding: false, history: true,
    formats: ['stroke', 'stableford', 'match', 'fourball', 'foursome', 'scramble', 'bestball', 'betterball', 'skins', 'teamagg'] as const,
  },
  c: {
    matchPlay: true, teamFormats: true, flightsAdmin: true, teeTimes: true,
    exportCsv: true, tvMode: true, spectatorFeed: true,
    pwaInstall: true, push: true, social: true, playerStats: true, heatmap: true,
    autoCommentary: true, branding: true, history: true,
    formats: ['stroke', 'stableford', 'match', 'fourball', 'foursome', 'scramble', 'bestball', 'betterball', 'skins', 'teamagg'] as const,
  },
} as const;

export type VariantFeatures = (typeof VARIANT_FEATURES)[VariantId];

/** Реестр демо-турниров (витрина; прод — список с сервера). */
export interface DemoTournamentInfo { id: string; format: string; name: { ru: string; en: string }; status: 'live' | 'registration' | 'finished'; players: number; flights: number; teams: number; rounds: number; startProgress: number; skins?: boolean }

export function demoTournamentList(variant: VariantId): DemoTournamentInfo[] {
  const base: DemoTournamentInfo[] = [
    {
      id: 't-open', format: variant === 'a' ? 'stableford' : 'stroke',
      name: { ru: 'Кубок клуба — открытый', en: 'Club Cup — Open' }, status: 'live',
      players: 144, flights: 4, teams: 0, rounds: 1, startProgress: 9,
    },
  ];
  if (variant === 'a') return base;
  base.push({
    id: 't-corp', format: 'scramble',
    name: { ru: 'Корпоративный кубок (скрембл)', en: 'Corporate Cup (scramble)' }, status: 'live',
    players: 96, flights: 2, teams: 4, rounds: 1, startProgress: 6,
  });
  base.push({
    id: 't-evening', format: 'skins',
    name: { ru: 'Вечерний скинс', en: 'Evening skins' }, status: 'live',
    players: 8, flights: 1, teams: 0, rounds: 1, startProgress: 12,
  });
  if (variant === 'c') {
    base.push({
      id: 't-champ', format: 'stroke',
      name: { ru: 'Чемпионат клуба · 3 раунда', en: 'Club Championship · 3 rounds' }, status: 'live',
      players: 144, flights: 4, teams: 0, rounds: 3, startProgress: 14,
    });
  }
  return base;
}

export const MODE_ORDER: Mode[] = ['light', 'dark', 'sun'];
