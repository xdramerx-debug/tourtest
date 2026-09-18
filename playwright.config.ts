import { defineConfig } from '@playwright/test';

/** E2E-конфиг (NFR §2: прогон в CI; локальный запуск — npx playwright test). */
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.CSL_E2E_BASE ?? 'http://localhost:4020/',
    viewport: { width: 390, height: 844 }, // мобильный контур по умолчанию (PRODUCT: поле, одна рука)
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1366, height: 800 } } },
    { name: 'narrow', use: { viewport: { width: 320, height: 640 } } },
  ],
});
