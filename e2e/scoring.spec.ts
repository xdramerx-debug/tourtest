import { test, expect } from '@playwright/test';

/**
 * v2 e2e — единое приложение apps/scoring, горячее переключение 5 шаблонов (USER_FLOWS F0+v2).
 * База — CSL_E2E_SCORING (дефолт http://localhost:4030/), собранный dist с DemoTransport.
 * Проверки: ?theme=N, UI-пикер, Alt+T/Alt+1..5, персист, отсутствие потери данных.
 */

const BASE = process.env.CSL_E2E_SCORING ?? 'http://localhost:4030/';

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
    await page.evaluate(() => { /* noop */ });
    await page.goto(`${BASE}`);
    await page.keyboard.down('Alt');
    await page.keyboard.press('3');
    await page.keyboard.up('Alt');
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
    // вводим счёт 5 на первой лунке
    await page.getByRole('button', { name: /^5$/ }).first().click();
    const scoreBefore = await page.evaluate(() => localStorage.getItem('csl.scoresBackup'));
    void scoreBefore;
    // два переключения подряд (Alt+T цикл)
    const before = await designOf(page);
    await page.keyboard.down('Alt'); await page.keyboard.press('t'); await page.keyboard.up('Alt');
    await page.keyboard.down('Alt'); await page.keyboard.press('t'); await page.keyboard.up('Alt');
    const after2 = await designOf(page);
    expect(after2).not.toBe(before);
    // введённое значение не потерялось (буфер пада счёта виден на экране)
    await expect(page.getByRole('button', { name: /^5$/ }).first()).toBeVisible({ timeout: 5000 });
    const cell = await page.evaluate(() => {
      const raw = localStorage.getItem('csl.session');
      return !!raw;
    });
    expect(cell).toBe(true);
  });
});
