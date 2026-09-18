/**
 * @csl/tokens — типизированный доступ к данным тем.
 * CSS генерируется scripts/build-themes.mjs в dist/ (импортируется приложениями как CSS).
 */
// @ts-ignore — данные тем на чистом JS (общий источник для Node-скриптов)
import { DESIGNS } from './themes.data.mjs';

export type DesignId = '1' | '2' | '3' | '4' | '5';
export type Mode = 'light' | 'dark' | 'sun';

export interface Palette {
  bg: string; surface: string; surface2: string;
  text: string; textMuted: string;
  primary: string; onPrimary: string;
  accent: string; accentText: string; onAccent: string;
  live: string; underPar: string; overPar: string;
  warning: string; danger: string; border: string; focus: string;
  sunBackdrop: string;
}

export interface DesignTheme {
  id: DesignId;
  slug: string;
  name: string;
  direction: string;
  defaultMode: Mode;
  fonts: {
    display: { css: string; source: string | null; weights: number[] };
    text: { css: string; source: string | null; weights: number[] };
    numeric: { css: string; source: string | null; feature?: string };
  };
  grid: { cols: number; max: number; gutter: number };
  density: { name: 'cozy' | 'compact' | 'regular' | 'ultra' | 'relaxed'; space: number[]; rowDesktop: number; rowTouch: number };
  radius: { sm: number; md: number; lg: number; pill: number };
  border: { w: number; style: string };
  shadow: { 1: string; 2: string; glow: string };
  icons: { stroke: number; caps: 'round' | 'butt' | 'square' };
  motion: { durFast: string; dur: string; durSlow: string; ease: string; spring: string; ticker: boolean };
  patterns: {
    scorecard: 'print-card' | 'scoreboard-brick' | 'chips' | 'grid-sheet' | 'float-keys';
    leaderboard: 'classic' | 'broadcast' | 'cards' | 'data' | 'glass';
    quickChips: boolean; ticker: boolean; glass: boolean;
    momentum: 'line' | 'arrow' | 'chip' | 'delta-num' | 'halo';
  };
  modes: Record<Mode, Palette>;
}

export const themes = DESIGNS as DesignTheme[];
export const themeById = Object.fromEntries(themes.map((t) => [t.id, t])) as Record<DesignId, DesignTheme>;
export const MODES: Mode[] = ['light', 'dark', 'sun'];

/** Применить тему к документу (data-атрибуты на <html>). */
export function applyTheme(designId: DesignId, mode: Mode) {
  const root = document.documentElement;
  root.dataset.design = designId;
  root.dataset.mode = mode;
}

/** Инициализация темы: предпочтение пользователя (localStorage) → defaultMode дизайна. */
export function initTheme(designId: DesignId): Mode {
  const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('csl.mode')) as Mode | null;
  const mode: Mode = saved && MODES.includes(saved) ? saved : themeById[designId].defaultMode;
  applyTheme(designId, mode);
  return mode;
}
