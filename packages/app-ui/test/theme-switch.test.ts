import { describe, it, expect, beforeEach } from 'vitest';
import {
  DESIGN_IDS,
  THEME_STORAGE_KEY,
  hotkeyDesign,
  nextDesign,
  parseThemeParam,
  persistDesign,
  resolveInitialDesign,
} from '../src/theme-switch';

/** Мини-сторадж (изоляция от jsdom localStorage между тестами). */
const memStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('theme-switch (ARCHITECTURE §0 v2)', () => {
  it('перечень дизайнов ровно 5, валидны', () => {
    expect(DESIGN_IDS).toEqual(['1', '2', '3', '4', '5']);
  });

  it('parseThemeParam: только query, 1..5, hash не ловит', () => {
    expect(parseThemeParam('?theme=3')).toBe('3');
    expect(parseThemeParam('?club=golf&theme=5&x=1')).toBe('5');
    expect(parseThemeParam('?theme=0')).toBeNull();
    expect(parseThemeParam('?theme=9')).toBeNull();
    expect(parseThemeParam('?themes=3')).toBeNull();
    expect(parseThemeParam('#/board?theme=2')).toBeNull(); // hash-router: query живёт до '#'
    expect(parseThemeParam('')).toBeNull();
  });

  it('приоритет источников: URL > storage > system-dark > default', () => {
    const s = memStorage();
    const r1 = resolveInitialDesign({ search: '?theme=4', storage: s });
    expect(r1).toEqual({ design: '4', source: 'url' });
    s.setItem(THEME_STORAGE_KEY, '2');
    expect(resolveInitialDesign({ search: '?theme=5', storage: s }).design).toBe('5'); // URL побеждает storage
    expect(resolveInitialDesign({ search: '', storage: s })).toEqual({ design: '2', source: 'storage' });
    expect(resolveInitialDesign({ search: '', storage: null, systemDark: true })).toEqual({ design: '5', source: 'system' });
    expect(resolveInitialDesign({ search: '', storage: null, systemDark: false, defaultDesign: '3' })).toEqual({ design: '3', source: 'default' });
  });

  it('невалидный localStorage игнорируется без падения', () => {
    const s = memStorage();
    s.setItem(THEME_STORAGE_KEY, '42');
    expect(resolveInitialDesign({ search: '', storage: s }).source).toBe('default');
  });

  it('nextDesign: цикл 1→5→1', () => {
    let d = nextDesign('1');
    expect(d).toBe('2');
    d = nextDesign('5');
    expect(d).toBe('1');
  });

  it('горячие клавиши: только с Alt, цифры 1..5 и цикл T (обе раскладки)', () => {
    expect(hotkeyDesign('1', true)).toBe('1');
    expect(hotkeyDesign('5', true)).toBe('5');
    expect(hotkeyDesign('t', true)).toBe('cycle');
    expect(hotkeyDesign('е', true)).toBe('cycle'); // alt+T в русской раскладке
    expect(hotkeyDesign('t', false)).toBeNull();
    expect(hotkeyDesign('6', true)).toBeNull();
    expect(hotkeyDesign('q', true)).toBeNull();
  });

  it('RTL-smoke: переключение тем не зависит от направления документа (заготовка под i18n RTL)', async () => {
    // SSR: меню пикера и имена тем должны рендериться при dir=rtl без падения
    const { renderToStaticMarkup } = await import('react-dom/server');
    const React = await import('react');
    const { themeById } = await import('@csl/tokens');
    const html = renderToStaticMarkup(
      React.createElement(
        'div', { dir: 'rtl' },
        DESIGN_IDS.map((id) => React.createElement('span', { key: id }, themeById[id].name)),
      ),
    );
    expect(html).toContain('Classic');
    expect(DESIGN_IDS.every((id) => html.includes(themeById[id].name))).toBe(true);
  });

  describe('persistDesign', () => {
    let s: ReturnType<typeof memStorage>;
    beforeEach(() => { s = memStorage(); });

    it('пишет csl.theme и профиль клуба (csl.club.theme) не ломая остальные поля', () => {
      s.setItem('csl.club', JSON.stringify({ name: 'ГК', units: 'metric' }));
      persistDesign('3', s);
      expect(s.getItem(THEME_STORAGE_KEY)).toBe('3');
      expect(JSON.parse(s.getItem('csl.club')!)).toEqual({ name: 'ГК', units: 'metric', theme: '3' });
    });

    it('создаёт профиль, если его не было; битый JSON не роняет', () => {
      persistDesign('2', s);
      expect(JSON.parse(s.getItem('csl.club')!)).toEqual({ theme: '2' });
      s.setItem('csl.club', '{oops');
      persistDesign('4', s);
      expect(s.getItem(THEME_STORAGE_KEY)).toBe('4');
    });
  });
});
