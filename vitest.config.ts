import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx', 'apps/server/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['packages/scoring-engine/src/**', 'packages/sync/src/**'],
      thresholds: {
        'packages/scoring-engine/src/**': { lines: 0.9, functions: 0.9 },
      },
    },
    setupFiles: [],
  },
});
