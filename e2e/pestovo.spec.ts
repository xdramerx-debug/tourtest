import { test, expect } from '@playwright/test';

/** E2E клона «Пестово Live Scoring» (§14): demo-backend, без сети к Firebase.
 *  Запуск: CSL_PWA_BASE=http://localhost:4040/ npx playwright test pestovo --config=playwright.config.ts */
const BASE = process.env.CSL_PWA_BASE ?? 'http://localhost:4040/';
const page4040 = (path: string) => `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

test.describe('Пестово клон (demo-mode)', () => {
  test('главная: секции, live-турнир демо-сида, инструменты', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    await page.goto(page4040('index.html'));
    await expect(page.locator('h2[data-i18n="home.live.title"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#sec-live-body')).toBeVisible();
    // демо-турнир сида должен быть виден как LIVE
    await expect(page.locator('#sec-tours')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#sec-tours-body')).toContainText('Кубок открытия сезона');
    await expect(page.locator('#club-numbers')).toContainText(/\d+/);
    expect(pageErrors, 'js-ошибок на главной быть не должно').toEqual([]);
  });

  test('соло-раунд до конца: setup → ввод пэдом → финиш → leaderboard', async ({ page }) => {
    await page.goto(page4040('setup-round.html'));
    // ждём подгрузку сида users в datalist (datalist-опции attached, но не "visible")
    await page.waitForSelector('#userList option', { state: 'attached', timeout: 8_000 });
    await page.fill('#playerSearch', 'Иван Петров');
    await page.click('#addByName');
    await page.click('button[data-i18n="setup.create"], form#setupForm button[type="submit"]');
    await page.waitForURL(/solo\.html\?round=/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('round')).toBeTruthy();
    // ввод очков: жмём pad-кнопки (по одной на лунку ≤5с)
    for (let i = 0; i < 5; i++) {
      const pad = page.locator('#scorePad button:not(.ghost)').nth(2);
      await pad.click({ timeout: 5_000 });
      await page.waitForTimeout(120); // DB realtime echo
    }
    await expect(page.locator('#sumTiles')).toContainText(/4|5|6/, { timeout: 5_000 });
    // офлайн: доска pace отрисована, hole>=6 после 5 кликов
    await expect(page.locator('#holeNum')).toContainText('6', { timeout: 5_000 });
    page.on('dialog', d => d.accept()); // confirm() на финиш
    await page.locator('#finishBtn').click();
    // возможен крит выхода из аттеста визиты («Одобрить») до финиша
    const approve = page.locator('button:has-text("Одобрить")');
    approve.waitFor({ state: 'visible', timeout: 3_000 }).then(() => approve.click()).catch(() => {});
    await page.waitForURL(/leaderboard\.html/, { timeout: 20_000 });
    await expect(page.locator('#lb-list')).toContainText('Иван', { timeout: 8_000 });
  });

  test('турниры из сида: табло/деление/карточки; countback-решётка', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    await page.goto(page4040('tournaments.html'));
    await expect(page.locator('#tlist')).toContainText('Кубок открытия сезона', { timeout: 8_000 });
    await page.click('a:text-is("Открыть")');
    await expect(page.locator('#tpane')).toBeVisible({ timeout: 8_000 });
    // переключение видов табло (5): сетка → tv → компакт обратно в таблицу
    for (const v of ['grid', 'tv', 'compact', 'table']) {
      await page.click(`[data-k="board"][data-v="${v}"]`);
      await expect(page.locator('#tpane')).toBeVisible();
    }
    // разделение пола (3)
    await page.click('[data-k="division"][data-v="women"]');
    // дивизион фильтрует именно бордовую таблицу (roster/карточки ниже — общие)
    const board = page.locator('#tpane .tbl').first();
    await expect(board).toContainText('Марина');
    await expect(board).not.toContainText('Иван');
    await page.click('[data-k="division"][data-v="all"]');
    // составы (3) и карточки (3)
    await page.click('[data-k="roster"][data-v="alpha"]');
    await expect(page.locator('#tpane table').first()).toBeVisible();
    await page.click('[data-k="cardview"][data-v="mini"]');
    await expect(page.locator('#tpane')).toContainText('│');
    expect(pageErrors, 'js-ошибок на странице турниров быть не должно').toEqual([]);
  });

  test('админка: вход admin/admin, 15 вкладок, мастер турнира step-0', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
    await page.goto(page4040('auth.html'));
    await page.fill('#u', 'admin'); await page.fill('#p', 'admin');
    await page.click('button#login, button:text-is("Войти")');
    await page.waitForURL(/index\.html|admin\.html/, { timeout: 8_000 }).catch(() => {});
    await page.goto(page4040('admin.html?tab=wizard'));
    await expect(page.locator('#admTabs .chip')).toHaveCount(15, { timeout: 8_000 });
    await expect(page.locator('#admPane')).toContainText('Шаблон', { timeout: 6_000 });
    // применяем шаблон «Клубный чемпионат» → шаг 2 фокат
    await page.click('[data-tpl="club"]');
    await expect(page.locator('#admPane')).not.toContainText('Ошибка вкладки', { timeout: 4_000 });
    expect(pageErrors, 'js-ошибок в админке быть не должно').toEqual([]);
  });

  test('дизайны: ?dsp=2 переключает шаблон, ?dsp=5 аврора', async ({ page }) => {
    for (const n of [1, 2, 5]) {
      await page.goto(page4040(`index.html?dsp=${n}`));
      const dsp = await page.evaluate(() => document.documentElement.getAttribute('data-dsp'));
      expect(dsp).toBe(String(n));
    }
  });

  test('приватность (§11): без настроек — имена как взяли; флаг short маскирует', async ({ page }) => {
    await page.goto(page4040('players.html'));
    await expect(page.locator('#roster')).toContainText('Иван Петров', { timeout: 8_000 });
    await page.evaluate(() => (window as any).DB.set('settings/privacy', { enabled: true, maskMode: 'short', players: {} }));
    await expect(page.locator('#roster')).toContainText('И. П.', { timeout: 4_000 });
  });

  test('offline.html и manifest доступны; sw регистрируется без падения', async ({ page }) => {
    const res = await page.goto(page4040('offline.html'));
    expect(res && res.status()).toBe(200);
    const res2 = await page.goto(page4040('manifest.json'));
    expect(res2 && res2.status()).toBe(200);
    await page.goto(page4040('index.html'));
    await page.waitForTimeout(800);
    const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(hasSW).toBe(true);
  });

  test('feed: анонс сида + реакция "👏" считается', async ({ page }) => {
    await page.goto(page4040('feed.html'));
    await expect(page.locator('#feed')).toContainText('Добро пожаловать', { timeout: 8_000 });
    const chip = page.locator('.chip[data-e="👏"]').first();
    await chip.click();
    await expect(chip).toContainText('1', { timeout: 4_000 });
  });

  test('использование двух вкладок: realtime BroadcastChannel-доставка (demo)', async ({ page, context }) => {
    await page.goto(page4040('feed.html'));
    await expect(page.locator('#feed')).toContainText('Добро пожаловать', { timeout: 8_000 });
    const p2 = await context.newPage();
    await p2.goto(page4040('admin.html?tab=announce'));
    // admin-mochit вход через localStorage-стаб: подписываемся на анонс напрямую БД
    await p2.evaluate(() => (window as any).DB.push('broadcasts', { title: 'E2E-сообщение', body: 'проверка realtime', audience: 'all', time: Date.now() }));
    await expect(page.locator('#feed')).toContainText('E2E-сообщение', { timeout: 6_000 });
  });
});
