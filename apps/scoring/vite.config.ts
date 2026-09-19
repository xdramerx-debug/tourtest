import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// v2: единственное продуктовое приложение (PRODUCT.md §0). Относительный base —
// работает под любым префиксом GH Pages (D8), deep links — hash + 404.html (D9).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
  server: { host: '0.0.0.0', port: 5100, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 5200, allowedHosts: true },
});
