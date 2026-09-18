/**
 * Данные тем ClubScore Live — единый источник для:
 *  - scripts/build-themes.mjs (генерация dist/theme-*.css)
 *  - scripts/check-contrast.mjs (контраст-аудит)
 *  - @csl/tokens (TS-типизированный доступ из приложений)
 *
 * Редактирование = изменение дизайна → только через PR (DESIGNS.md freeze).
 * Контрасты валидируются scripts/check-contrast.mjs (см. NFR.md §5, §8).
 */

const stack = (primary, ...fallback) => [`"${primary}"`, ...fallback].join(',');

/** @typedef {Object} Palette */
const palette = (p) => p;

export const DESIGNS = [
  {
    id: '1',
    slug: 'heritage-green',
    name: 'Heritage Green',
    direction: 'Classic Country Club — традиция, печатная карточка, воздух',
    defaultMode: 'light',
    fonts: {
      display: { css: stack('Playfair Display', 'Georgia', 'Times New Roman', 'serif'), source: 'playfair-display', weights: [600, 700] },
      text: { css: stack('Manrope', 'Segoe UI', 'system-ui', 'sans-serif'), source: 'manrope', weights: [400, 500, 600] },
      numeric: { css: stack('Manrope', 'Segoe UI', 'system-ui', 'sans-serif'), source: null, feature: '"tnum" 1, "lnum" 1' },
    },
    grid: { cols: 12, max: 1120, gutter: 28 },
    density: { name: 'cozy', space: [6, 12, 18, 24, 36, 48], rowDesktop: 52, rowTouch: 56 },
    radius: { sm: 4, md: 6, lg: 8, pill: 999 },
    border: { w: 1, style: 'solid' },
    shadow: { 1: '0 1px 2px rgba(20,30,25,.06)', 2: '0 2px 8px rgba(20,30,25,.08)', glow: 'none' },
    icons: { stroke: 1.5, caps: 'round' },
    motion: { durFast: '150ms', dur: '250ms', durSlow: '350ms', ease: 'cubic-bezier(.22,.61,.36,1)', spring: 'none', ticker: false },
    patterns: { scorecard: 'print-card', leaderboard: 'classic', quickChips: false, ticker: false, glass: false, momentum: 'line' },
    modes: {
      light: palette({
        bg: '#F7F3E8', surface: '#FFFDF6', surface2: '#F0EADA',
        text: '#1A2A22', textMuted: '#565F52', primary: '#0B3D2E', onPrimary: '#F5F0E2',
        accent: '#8A6D1F', accentText: '#7A5E14', onAccent: '#FFFDF6',
        live: '#0B3D2E', underPar: '#7A2E2E', overPar: '#1A2A22',
        warning: '#8A5A00', danger: '#A63232', border: '#D8D0BC', focus: '#0B3D2E',
        sunBackdrop: '#FFFFFF',
      }),
      dark: palette({
        bg: '#122019', surface: '#1A2C22', surface2: '#22372B',
        text: '#F0EBDD', textMuted: '#B7AE97', primary: '#2E5C46', onPrimary: '#F0EBDD',
        accent: '#C9A227', accentText: '#E4C55B', onAccent: '#1A2A22',
        live: '#C9A227', underPar: '#E39A92', overPar: '#F0EBDD',
        warning: '#E4B45B', danger: '#E78B8B', border: '#3A5243', focus: '#E4C55B',
        sunBackdrop: '#FFFFFF',
      }),
      sun: palette({
        bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#F1EDDD',
        text: '#0E1A14', textMuted: '#31413A', primary: '#083325', onPrimary: '#FFFFFF',
        accent: '#8C6D1F', accentText: '#6B5413', onAccent: '#FFFFFF',
        live: '#083325', underPar: '#5E1F1F', overPar: '#0E1A14',
        warning: '#6B4500', danger: '#7C1F1F', border: '#6A6350', focus: '#083325',
        sunBackdrop: '#FFFFFF',
      }),
    },
  },
  {
    id: '2',
    slug: 'fairway-live',
    name: 'Fairway Live',
    direction: 'Broadcast/TV — графит, доска, тикер, как в эфире',
    defaultMode: 'dark',
    fonts: {
      display: { css: stack('Oswald', 'Arial Narrow', 'sans-serif'), source: 'oswald', weights: [500, 600, 700] },
      text: { css: stack('Roboto Condensed', 'Arial Narrow', 'sans-serif'), source: 'roboto-condensed', weights: [400, 700] },
      numeric: { css: stack('Oswald', 'Arial Narrow', 'sans-serif'), source: null, feature: '"tnum" 1' },
    },
    grid: { cols: 12, max: 1600, gutter: 16 },
    density: { name: 'compact', space: [3, 6, 10, 14, 20, 28], rowDesktop: 36, rowTouch: 48 },
    radius: { sm: 2, md: 2, lg: 2, pill: 2 },
    border: { w: 1, style: 'solid' },
    shadow: { 1: 'none', 2: 'none', glow: '0 0 0 2px rgba(225,6,0,.35)' },
    icons: { stroke: 0, caps: 'butt' }, // solid-глифы
    motion: { durFast: '120ms', dur: '160ms', durSlow: '200ms', ease: 'cubic-bezier(.2,.7,.3,1)', spring: 'none', ticker: true },
    patterns: { scorecard: 'scoreboard-brick', leaderboard: 'broadcast', quickChips: false, ticker: true, glass: false, momentum: 'arrow' },
    modes: {
      light: palette({
        bg: '#F4F6F8', surface: '#FFFFFF', surface2: '#E8ECF0',
        text: '#0E1216', textMuted: '#4A5561', primary: '#B30500', onPrimary: '#FFFFFF',
        accent: '#003DA5', accentText: '#003DA5', onAccent: '#FFFFFF',
        live: '#E10600', underPar: '#C62828', overPar: '#0E1216',
        warning: '#8A5A00', danger: '#B71C1C', border: '#BAC3CC', focus: '#003DA5',
        sunBackdrop: '#FFFFFF',
      }),
      dark: palette({
        bg: '#0E1216', surface: '#161C22', surface2: '#1E2630',
        text: '#FFFFFF', textMuted: '#9AA7B4', primary: '#E10600', onPrimary: '#FFFFFF',
        accent: '#1D63E0', accentText: '#7FB0FF', onAccent: '#FFFFFF',
        live: '#FF3B30', underPar: '#FF6B5E', overPar: '#FFFFFF',
        warning: '#FFB020', danger: '#FF5A52', border: '#33404E', focus: '#7FB0FF',
        sunBackdrop: '#FFFFFF',
      }),
      sun: palette({
        bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#ECEFF2',
        text: '#0A0D10', textMuted: '#39434D', primary: '#8F0400', onPrimary: '#FFFFFF',
        accent: '#002E7D', accentText: '#002E7D', onAccent: '#FFFFFF',
        live: '#B30500', underPar: '#9A1B1B', overPar: '#0A0D10',
        warning: '#6B4500', danger: '#8F1414', border: '#59636E', focus: '#002E7D',
        sunBackdrop: '#FFFFFF',
      }),
    },
  },
  {
    id: '3',
    slug: 'birdie-bolt',
    name: 'Birdie Bolt',
    direction: 'Modern Sport — бенто, вольт, энергия',
    defaultMode: 'light',
    fonts: {
      display: { css: stack('Exo 2', 'Trebuchet MS', 'sans-serif'), source: 'exo-2', weights: [600, 800] },
      text: { css: stack('Inter', 'system-ui', 'Segoe UI', 'sans-serif'), source: 'inter', weights: [400, 600] },
      numeric: { css: stack('Inter', 'system-ui', 'Segoe UI', 'sans-serif'), source: null, feature: '"tnum" 1, "lnum" 1' },
    },
    grid: { cols: 12, max: 1280, gutter: 20 },
    density: { name: 'regular', space: [4, 8, 12, 16, 24, 32], rowDesktop: 44, rowTouch: 52 },
    radius: { sm: 12, md: 16, lg: 24, pill: 999 },
    border: { w: 1.5, style: 'solid' },
    shadow: { 1: '4px 4px 0 rgba(11,11,12,.08)', 2: '8px 8px 0 rgba(11,11,12,.10)', glow: 'none' },
    icons: { stroke: 2.5, caps: 'round' },
    motion: { durFast: '120ms', dur: '220ms', durSlow: '300ms', ease: 'cubic-bezier(.3,.8,.4,1)', spring: 'cubic-bezier(.2,1.4,.4,1)', ticker: false },
    patterns: { scorecard: 'chips', leaderboard: 'cards', quickChips: true, ticker: false, glass: false, momentum: 'chip' },
    modes: {
      light: palette({
        bg: '#FFFFFF', surface: '#F3F4F6', surface2: '#E7E9EC',
        text: '#0B0B0C', textMuted: '#4E545C', primary: '#0B0B0C', onPrimary: '#FFFFFF',
        accent: '#C6F221', accentText: '#4F6400', onAccent: '#0B0B0C',
        live: '#4F6400', underPar: '#E5484D', overPar: '#0B0B0C',
        warning: '#8A5A00', danger: '#D92D20', border: '#0B0B0C', focus: '#4F6400',
        sunBackdrop: '#FFFFFF',
      }),
      dark: palette({
        bg: '#0B0B0C', surface: '#17181C', surface2: '#22242A',
        text: '#FAFAFA', textMuted: '#A6ACB4', primary: '#FAFAFA', onPrimary: '#0B0B0C',
        accent: '#C6F221', accentText: '#D9FF4D', onAccent: '#0B0B0C',
        live: '#D9FF4D', underPar: '#FF7A70', overPar: '#FAFAFA',
        warning: '#FFC46B', danger: '#FF8A80', border: '#FAFAFA', focus: '#D9FF4D',
        sunBackdrop: '#FFFFFF',
      }),
      sun: palette({
        bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#E9EBEF',
        text: '#000000', textMuted: '#3A4046', primary: '#000000', onPrimary: '#FFFFFF',
        accent: '#9DC400', accentText: '#3F5200', onAccent: '#000000',
        live: '#3F5200', underPar: '#B3261E', overPar: '#000000',
        warning: '#6B4500', danger: '#B3261E', border: '#000000', focus: '#3F5200',
        sunBackdrop: '#FFFFFF',
      }),
    },
  },
  {
    id: '4',
    slug: 'launch-deck',
    name: 'Launch Deck',
    direction: 'Precision/Trackman — прибор, моноширинные данные',
    defaultMode: 'light',
    fonts: {
      display: { css: stack('IBM Plex Sans', 'Segoe UI', 'sans-serif'), source: 'ibm-plex-sans', weights: [500, 600] },
      text: { css: stack('IBM Plex Sans', 'Segoe UI', 'sans-serif'), source: 'ibm-plex-sans', weights: [400, 500] },
      numeric: { css: stack('JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'), source: 'jetbrains-mono', weights: [400, 600] },
    },
    grid: { cols: 12, max: 1440, gutter: 16 },
    density: { name: 'ultra', space: [2, 4, 8, 12, 16, 24], rowDesktop: 32, rowTouch: 48 },
    radius: { sm: 0, md: 2, lg: 2, pill: 2 },
    border: { w: 1, style: 'solid' },
    shadow: { 1: 'none', 2: 'none', glow: 'none' },
    icons: { stroke: 1, caps: 'square' },
    motion: { durFast: '80ms', dur: '120ms', durSlow: '120ms', ease: 'linear', spring: 'none', ticker: false },
    patterns: { scorecard: 'grid-sheet', leaderboard: 'data', quickChips: false, ticker: false, glass: false, momentum: 'delta-num' },
    modes: {
      light: palette({
        bg: '#EEF0F3', surface: '#FFFFFF', surface2: '#E4E8ED',
        text: '#101418', textMuted: '#4E5965', primary: '#CC4A00', onPrimary: '#FFFFFF',
        accent: '#00776E', accentText: '#00776E', onAccent: '#FFFFFF',
        live: '#CC4A00', underPar: '#CC4A00', overPar: '#101418',
        warning: '#8A5A00', danger: '#B42318', border: '#C9D1DA', focus: '#CC4A00',
        sunBackdrop: '#FFFFFF',
      }),
      dark: palette({
        bg: '#0C0E11', surface: '#14171C', surface2: '#1D2128',
        text: '#E7EAEE', textMuted: '#98A2AD', primary: '#FF7A29', onPrimary: '#101418',
        accent: '#2FD8CB', accentText: '#2FD8CB', onAccent: '#101418',
        live: '#FF7A29', underPar: '#FF7A29', overPar: '#E7EAEE',
        warning: '#F2B84B', danger: '#F27066', border: '#343A44', focus: '#FF7A29',
        sunBackdrop: '#FFFFFF',
      }),
      sun: palette({
        bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#E8ECF0',
        text: '#000000', textMuted: '#39434D', primary: '#A33C00', onPrimary: '#FFFFFF',
        accent: '#00524D', accentText: '#00524D', onAccent: '#FFFFFF',
        live: '#A33C00', underPar: '#A33C00', overPar: '#000000',
        warning: '#6B4500', danger: '#8F1D14', border: '#59636E', focus: '#A33C00',
        sunBackdrop: '#FFFFFF',
      }),
    },
  },
  {
    id: '5',
    slug: 'after-dark',
    name: 'After Dark',
    direction: 'Night Round — глубокая ночь, мягкое свечение, тишина',
    defaultMode: 'dark',
    fonts: {
      display: { css: stack('Comfortaa', 'Trebuchet MS', 'sans-serif'), source: 'comfortaa', weights: [500, 700] },
      text: { css: stack('Nunito', 'Segoe UI', 'sans-serif'), source: 'nunito', weights: [400, 600, 800] },
      numeric: { css: stack('Nunito', 'Segoe UI', 'sans-serif'), source: null, feature: '"tnum" 1, "lnum" 1' },
    },
    grid: { cols: 12, max: 1160, gutter: 24 },
    density: { name: 'relaxed', space: [8, 14, 20, 26, 36, 48], rowDesktop: 56, rowTouch: 56 },
    radius: { sm: 12, md: 16, lg: 20, pill: 999 },
    border: { w: 1, style: 'solid' },
    shadow: {
      1: '0 2px 12px rgba(0,0,0,.35)',
      2: '0 8px 32px rgba(0,0,0,.45)',
      glow: '0 0 24px rgba(124,255,178,.22)',
    },
    icons: { stroke: 1.75, caps: 'round' },
    motion: { durFast: '200ms', dur: '350ms', durSlow: '600ms', ease: 'cubic-bezier(.25,.6,.3,1)', spring: 'none', ticker: false },
    patterns: { scorecard: 'float-keys', leaderboard: 'glass', quickChips: true, ticker: false, glass: true, momentum: 'halo' },
    modes: {
      light: palette({ // «сумеречный»
        bg: '#E9EDF6', surface: '#F6F8FD', surface2: '#DDE3F0',
        text: '#141B2E', textMuted: '#4A5470', primary: '#14663F', onPrimary: '#F6F8FD',
        accent: '#7A5C00', accentText: '#6B4F00', onAccent: '#F6F8FD',
        live: '#14663F', underPar: '#0E6B40', overPar: '#141B2E',
        warning: '#7A5C00', danger: '#B3261E', border: '#B9C2D8', focus: '#14663F',
        sunBackdrop: '#FFFFFF',
      }),
      dark: palette({
        bg: '#070C16', surface: '#0E1626', surface2: '#131E33',
        text: '#E8EEF9', textMuted: '#93A3BD', primary: '#27D98B', onPrimary: '#062015',
        accent: '#FFC46B', accentText: '#FFC46B', onAccent: '#1A1405',
        live: '#7CFFB2', underPar: '#7CFFB2', overPar: '#FFB4B4',
        warning: '#FFC46B', danger: '#FF8A8A', border: 'rgba(255,255,255,.10)', focus: '#7CFFB2',
        sunBackdrop: '#FFFFFF',
      }),
      sun: palette({
        bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#E9EDF6',
        text: '#0B1220', textMuted: '#39435C', primary: '#0E5231', onPrimary: '#FFFFFF',
        accent: '#6B4F00', accentText: '#544000', onAccent: '#FFFFFF',
        live: '#0E5231', underPar: '#0A4A2E', overPar: '#8A2020',
        warning: '#544000', danger: '#8A2020', border: '#5C6A8A',
        focus: '#0E5231', sunBackdrop: '#FFFFFF',
      }),
    },
  },
];

export const MODES = ['light', 'dark', 'sun'];
export const DESIGN_IDS = DESIGNS.map((d) => d.id);
