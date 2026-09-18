// @generated scripts/gen-apps.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // относительный base: сборка работает под любым префиксом GH Pages (D8)
  base: './',
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
  server: { host: '0.0.0.0', port: 5124, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 5224, allowedHosts: true },
});
