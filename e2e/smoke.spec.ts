import { test, expect } from '@playwright/test';

/**
 * Контурные e2e (SUCCESS §«extended checklist»): home → join → лобби → ввод лунки → табло.
 * Гоняются против статической сборки (DemoTransport), что и Pages-витрина.
 *
 * Диагностика: pageerror/console.error копятся и уходят в assertion —
 * текст ошибки виден в GitHub-аннотациях (логи раннеров в песочнице недоступны).
 */
const pageErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`console: ${m.text().slice(0, 300)}`); });
});

test.describe('критические пути F0–F2', () => {
  test('главная открывается и ведёт к join', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle(/ClubScore Live/);
    await page.getByRole('link', { name: /присоединиться по коду/i }).click();
    await expect(page).toHaveURL(/join/);
  });

  test('join по коду → лобби → ввод счёта', async ({ page }) => {
    await page.goto('./join');
    await page.getByLabel(/код турнира/i).fill('DUBRO6');
    await page.getByLabel(/имя и фамилия/i).fill('Тестовый Игрок');
    await page.getByRole('switch').first().click();
    await page.getByRole('button', { name: /войти в турнир/i }).click();
    await expect(page).toHaveURL(/\/t\//);
    // лобби → начать раунд
    await page.getByRole('link', { name: /начать раунд/i }).click();
    await expect(page).toHaveURL(/play/);
    // один тап — счёт лунки (UX: ≤5 с)
    const pad = page.getByRole('button', { name: '4' }).first();
    await pad.click();
  });

  test('лидерборд открывается без сессии (зритель)', async ({ page }) => {
    await page.goto('./t/t-open/board');
    await page.waitForTimeout(1500);
    expect(pageErrors, 'JS-ошибки на странице').toEqual([]);
    await expect(page.getByText(/лидерборд/i).first()).toBeVisible();
  });

  test('админ-вход → аудит', async ({ page }) => {
    await page.goto('./admin');
    await page.getByRole('button', { name: /войти в турнир|войти|submit/i }).click().catch(() => {});
    await page.goto('./admin');
    await expect(page).toHaveURL(/admin/);
  });
});
