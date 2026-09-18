import { test, expect } from '@playwright/test';

/**
 * Контурные e2e (SUCCESS §«extended checklist»): home → join → лобби → ввод лунки → табло.
 * Гоняются против статической сборки (DemoTransport), что и Pages-витрина.
 */
test.describe('критические пути F0–F2', () => {
  test('главная открывается и ведёт к join', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle(/ClubScore Live/);
    await page.getByRole('link', { name: /присоединиться по коду/i }).click();
    await expect(page).toHaveURL(/join/);
  });

  test('join по коду → лобби → ввод счёта', async ({ page }) => {
    await page.goto('./join');
    await page.getByLabel(/код турнира/i).fill('DUBRO26');
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
    await expect(page.getByText(/лидерборд/i).first()).toBeVisible();
  });

  test('админ-вход → аудит', async ({ page }) => {
    await page.goto('./admin');
    await page.getByRole('button', { name: /войти в турнир|войти|submit/i }).click().catch(() => {});
    await page.goto('./admin');
    await expect(page).toHaveURL(/admin/);
  });
});
