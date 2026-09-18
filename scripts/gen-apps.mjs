#!/usr/bin/env node
/**
 * Генератор 15 сборок вариант×дизайн (MATRIX: apps/variant-{a,b,c}/design-{1..5}).
 * Идемпотентен: перезаписывает только шаблонные файлы (помечены @generated).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VARIANTS = ['a', 'b', 'c'];
const VARIANT_DIR = { a: 'variant-a-core', b: 'variant-b-tournament', c: 'variant-c-experimental' };
const DESIGNS = ['1', '2', '3', '4', '5'];
const VARIANT_TITLE = { a: 'Core', b: 'Tournament', c: 'Experimental' };
const DESIGN_TITLE = { 1: 'Mastercard Classic', 2: 'Broadcast Pro', 3: 'Members Club', 4: 'Data Sheet', 5: 'Links Air' };

const pkg = (v, d) => JSON.stringify({
  name: `@csl/app-${v}-d${d}`,
  version: '0.1.0',
  private: true,
  type: 'module',
  scripts: {
    dev: 'vite',
    build: 'vite build',
    preview: 'vite preview --host 0.0.0.0',
  },
  dependencies: {
    '@csl/app-ui': '0.1.0',
    '@csl/core': '0.1.0',
    '@csl/design-system': '0.1.0',
    '@csl/scoring-engine': '0.1.0',
    '@csl/sync': '0.1.0',
    '@csl/tokens': '0.1.0',
    react: '^18.3.1',
    'react-dom': '^18.3.1',
    'react-router-dom': '^6.28.0',
    'react-i18next': '^15.1.1',
    i18next: '^24.2.0',
    zustand: '^5.0.2',
  },
}, null, 2) + '\n';

const viteConfig = (port) => `// @generated scripts/gen-apps.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // относительный base: сборка работает под любым префиксом GH Pages (D8)
  base: './',
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
  server: { host: '0.0.0.0', port: ${port}, allowedHosts: true },
  preview: { host: '0.0.0.0', port: ${port + 100}, allowedHosts: true },
});
`;

const indexHtml = (v, d) => `<!doctype html>
<!-- @generated scripts/gen-apps.mjs -->
<html lang="ru" data-design="${d}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="csl-basename" content="./" />
  <meta name="theme-color" content="#14532d" />
  <meta name="description" content="ClubScore Live — живой счёт гольф-клуба. Вариант ${VARIANT_TITLE[v]}, дизайн ${DESIGN_TITLE[d]}." />
  <link rel="manifest" href="./manifest.webmanifest" />
  <link rel="icon" href="./icon.svg" type="image/svg+xml" />
  <title>ClubScore Live · ${VARIANT_TITLE[v]} · ${DESIGN_TITLE[d]}</title>
</head>
<body>
  <div id="root"></div>
  <noscript>ClubScore Live требует включённый JavaScript.</noscript>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`;

const mainTsx = (v, d) => `// @generated scripts/gen-apps.mjs
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@csl/tokens/dist/base.css';
import '@csl/tokens/dist/theme-${d}.css';
import '@csl/design-system/ds.css';
import { AppRoot, registerSW } from '@csl/app-ui';

${v === 'c' ? 'registerSW();' : ''}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot config={{ variant: '${v}', design: '${d}' }} />
  </React.StrictMode>,
);
`;

const manifest = (v, d) => JSON.stringify({
  name: `ClubScore Live ${VARIANT_TITLE[v]}`,
  short_name: `CSL ${VARIANT_TITLE[v]}`,
  description: 'Живой счёт гольф-клуба: ввод ≤5 сек, лидерборд ≤2 сек, offline-first.',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  background_color: '#0b1f14',
  theme_color: '#14532d',
  icons: [
    { src: './icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: './icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ],
}, null, 2) + '\n';

const icon = (fill, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${fill}"/>
  ${extra}<circle cx="256" cy="330" r="120" fill="#ffffff"/>
  <g fill="${fill}"><circle cx="220" cy="300" r="14"/><circle cx="290" cy="310" r="14"/><circle cx="248" cy="356" r="14"/><circle cx="300" cy="360" r="14"/></g>
  <rect x="326" y="60" width="10" height="180" fill="#ffffff"/>
  <path d="M336 64l96 30-96 30z" fill="#fbbf24"/>
</svg>
`;

const swJs = `// @generated scripts/gen-apps.mjs — offline shell (ARCHITECTURE §6.3)
const VERSION = 'csl-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => {
      const cp = r.clone(); caches.open(VERSION).then((c) => c.put('./index.html', cp)); return r;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request).then((r) => {
    if (r.ok && url.origin === location.origin) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); }
    return r;
  })));
});
`;

let count = 0;
for (const v of VARIANTS) {
  for (const d of DESIGNS) {
    const dir = join(root, 'apps', VARIANT_DIR[v], `design-${d}`);
    const w = (rel, content) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), content); count += 1; };
    const port = 5100 + VARIANTS.indexOf(v) * 10 + Number(d);
    w('package.json', pkg(v, d));
    w('vite.config.ts', viteConfig(port));
    w('index.html', indexHtml(v, d));
    w('src/main.tsx', mainTsx(v, d));
    w('public/manifest.webmanifest', manifest(v, d));
    w('public/icon.svg', icon('#14532d'));
    w('public/icon-maskable.svg', icon('#0b1f14', '<rect width="512" height="512" rx="256" fill="#14532d"/>'));
    w('public/sw.js', swJs);
  }
}
console.log(`apps generated: ${count} files`);
