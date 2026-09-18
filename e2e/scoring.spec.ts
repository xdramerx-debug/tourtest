import { test, expect } from '@playwright/test';

/**
 * v2 e2e — единое приложение apps/scoring, горячее переключение 5 шаблонов (USER_FLOWS F0+v2).
 * База — CSL_E2E_SCORING (дефолт http://localhost:4030/), собранный dist с DemoTransport.
 * Проверки: ?theme=N, UI-пикер, Alt+T/Alt+1..5, персист, отсутствие потери данных.
 */

const BASE = process.env.CSL_E2E_SCORING ?? 'http://localhost:4030/';

const pageErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${String(e.stack ?? e).slice(0, 600)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text()) && /\/t\//.test(m.location().url)) return;
    if (/Failed to load resource.*404/.test(m.text())) return; // redirect-трюк D9
    pageErrors.push(`console: ${m.text().slice(0, 300)} @${m.location().url}`);
  });
});

async function designOf(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => document.documentElement.dataset.design ?? '');
}

test.describe('горячие шаблоны v2 (apps/scoring)', () => {
  test('?theme=N применяется с первого кадра и шарится ссылкой', async ({ page }) => {
    await page.goto(`${BASE}?theme=4`);
    await expect(page).toHaveTitle(/ClubScore Live/);
    await expect.poll(() => designOf(page)).toBe('4');
    await page.goto(`${BASE}?theme=5#/t/t-open/board`);
    await expect.poll(() => designOf(page)).toBe('5');
    await expect(page.getByText(/лидерборд/i).first()).toBeVisible();
  });

  test('UI-пикер: смена темы, запись в localStorage и URL, без перезагрузки', async ({ page }) => {
    await page.goto(BASE);
    const initial = await designOf(page);
    if (initial !== '1') await page.evaluate(() => { localStorage.removeItem('csl.theme'); });
    await page.getByRole('button', { name: /выбор шаблона|interface template picker/i }).click();
    await page.getByRole('option', { name: /broadcast/i }).click();
    await expect.poll(() => designOf(page)).toBe('2');
    expect(await page.evaluate(() => localStorage.getItem('csl.theme'))).toBe('2');
    expect(new URL(page.url()).searchParams.get('theme')).toBe('2');
  });

  test('Alt+T цикл и Alt+1..5 прямой выбор', async ({ page }) => {
    await page.goto(`${BASE}`);
    // диагностика: реальные keydown (app обработчики могут не сработать только если события не доходят)
    await page.evaluate(() => {
      (window as unknown as { __keys: string[] }).__keys = [];
      window.addEventListener('keydown', (e) => {
        (window as unknown as { __keys: string[] }).__keys.push(`${(e as KeyboardEvent).key}/${(e as KeyboardEvent).altKey}`);
      }, true);
    });
    await page.keyboard.down('Alt');
    await page.keyboard.press('3');
    await page.keyboard.up('Alt');
    const keys = await page.evaluate(() => (window as unknown as { __keys: string[] }).__keys.join(','));
    expect.soft(keys, 'ключи дошли до страницы').toContain('3/true');
    if (!keys.includes('3/true')) {
      // headless-бывает, что модификатор не ставится — проверяем сам обработчик синтетическим событием
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', altKey: true, bubbles: true })));
    }
    await expect.poll(() => designOf(page)).toBe('3');
    await page.keyboard.down('Alt');
    await page.keyboard.press('t');
    await page.keyboard.up('Alt');
    await expect.poll(() => designOf(page)).toBe('4'); // цикл → следующая
  });

  test('переключение на лету НЕ теряет введённый счёт', async ({ page }) => {
    // F1+F0+v2: join → счёт на первой лунке → 2× смена темы → счёт на месте
    await page.goto(`${BASE}#/join`);
    await page.getByLabel(/код турнира/i).fill('DUBRO6');
    await page.getByLabel(/имя и фамилия/i).fill('Темный Тестеров');
    await page.getByRole('switch').first().click();
    await page.getByRole('button', { name: /войти в турнир/i }).click();
    await expect(page).toHaveURL(/#\/t\//);
    await page.getByRole('link', { name: /начать раунд/i }).click();
    await expect(page).toHaveURL(/play/);
    // вводим счёт 5 на первой лунке — пад применяет и авто-переходит на h/2 (ожидаем)
    await page.getByRole('button', { name: /^5$/ }).first().click();
    await expect(page).toHaveURL(/\/play\/h\/2/, { timeout: 4000 });
    expect.soft(pageErrors, 'JS-ошибки на play').toEqual([]);
    // два переключения подряд (Alt+T цикл)
    const before = await designOf(page);
    await page.keyboard.down('Alt'); await page.keyboard.press('t'); await page.keyboard.up('Alt');
    await page.keyboard.down('Alt'); await page.keyboard.press('t'); await page.keyboard.up('Alt');
    const after2 = await designOf(page);
    expect(after2).not.toBe(before);
    // возвращаемся на h/1: введённое 5 не потерялось — ни в данных (offline-очередь!), ни в UI
    await page.goto(`${BASE}#/t/t-open/play/h/1`);
    const data = await page.evaluate(() => {
      const sKey = Object.keys(localStorage).find((k) => k.startsWith('csl.session.'));
      const dKey = Object.keys(localStorage).find((k) => k.startsWith('csl.demo.'));
      const s = sKey ? (JSON.parse(localStorage.getItem(sKey)!) as { playerId?: string }) : null;
      const actions = dKey ? (JSON.parse(localStorage.getItem(dKey)!) as { authorId: string; hole: number; type: string; payload?: { strokes?: number } }[]) : [];
      return { pid: s?.playerId ?? null, actions, bignum: document.querySelector('.ds-sc__bignum')?.textContent ?? null };
    });
    const mine = data.actions.find((a) => a.authorId === data.pid && a.type === 'score.set' && a.hole === 1);
    expect(mine?.payload?.strokes, 'наш score.set(h1,5) пережил перезагрузку страницы и смены темы').toBe(5);
    if (data.bignum !== null) expect(data.bignum).toBe('5'); // UI: на мобильных шаблонах bignum может быть свёрнут
    expect(data.pid, 'join-сессия сохранена при переключении тем').toBeTruthy();
  });
});
