/**
 * Механика горячего переключения дизайн-шаблонов (ARCHITECTURE.md §0 v2).
 * Чистые функции (DOM опционален) — юнит-покрытие packages/app-ui/test/theme-switch.test.ts.
 *
 * Контракт:
 * - источники по приоритету: ?theme=N (query до hash) → localStorage csl.theme → системная
 *   тёмная тема → дефолт;
 * - запись: localStorage csl.theme + профиль клуба (csl.club.theme) + URL ?theme=N (replaceState,
 *   без перезагрузки); сама смена визуала — только data-атрибуты <html> (applyTheme из @csl/tokens).
 */
import { themeById, type DesignId } from '@csl/tokens';

export const DESIGN_IDS: readonly DesignId[] = ['1', '2', '3', '4', '5'];
export const THEME_STORAGE_KEY = 'csl.theme';

export type ThemeSource = 'url' | 'storage' | 'system' | 'default';

/** theme=N из query строки (hash-router D9: query живёт до '#'; hash-часть игнорируется). */
export function parseThemeParam(search: string): DesignId | null {
  const q = search.split('#')[0]; // защита от ошибочной передачи всего location.href
  const m = /(?:^|[?&])theme=([1-5])\b/.exec(q);
  return (m?.[1] as DesignId | undefined) ?? null;
}

export function resolveInitialDesign(opts: {
  search: string;
  storage?: { getItem(k: string): string | null } | null;
  systemDark?: boolean;
  defaultDesign?: DesignId;
}): { design: DesignId; source: ThemeSource } {
  const fromUrl = parseThemeParam(opts.search);
  if (fromUrl) return { design: fromUrl, source: 'url' };
  try {
    const saved = opts.storage?.getItem(THEME_STORAGE_KEY);
    if (saved && (DESIGN_IDS as readonly string[]).includes(saved)) {
      return { design: saved as DesignId, source: 'storage' };
    }
  } catch { /* storage может быть недоступен */ }
  if (opts.systemDark) return { design: '5', source: 'system' }; // Night Round как тёмный дефолт
  return { design: opts.defaultDesign ?? '1', source: 'default' };
}

export function nextDesign(cur: DesignId): DesignId {
  const i = DESIGN_IDS.indexOf(cur);
  return DESIGN_IDS[(i + 1) % DESIGN_IDS.length];
}

/** Alt+T — цикл, Alt+1..5 — прямой выбор (учтена русская раскладка: 'т'/'е'). */
export function hotkeyDesign(key: string, altKey: boolean): DesignId | 'cycle' | null {
  if (!altKey) return null;
  const k = key.toLowerCase();
  if (k === 't' || k === 'е' || k === 'т') return 'cycle'; // 'е' — Alt+T в русской раскладке
  const d = Number(k);
  if (d >= 1 && d <= 5) return String(d) as DesignId;
  return null;
}

/** Персист: localStorage + профиль клуба (csl.club.theme — «в профиле игрока», USER_FLOWS F0+v2). */
export function persistDesign(design: DesignId, storage?: Pick<Storage, 'getItem' | 'setItem'>): void {
  const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!s) return;
  try { s.setItem(THEME_STORAGE_KEY, design); } catch { /* ignore */ }
  try {
    const raw = s.getItem('csl.club');
    const club = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    if (club.theme !== design) {
      club.theme = design;
      s.setItem('csl.club', JSON.stringify(club));
    }
  } catch { /* ignore */ }
}

/** Обновляет ?theme=N в адресной строке через replaceState (без перезагрузки, ссылка шарится). */
export function syncUrlDesign(design: DesignId): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('theme', design);
    window.history.replaceState(null, '', url.toString());
  } catch { /* ignore */ }
}

export function designName(design: DesignId): string {
  return themeById[design]?.name ?? design;
}
