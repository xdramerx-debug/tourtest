/* Контракт клона (§14): все pwa/*.html существуют, локальные ассеты на месте,
   инлайн-скрипты парсятся, i18n-ключи присутствуют в словаре. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pwa = join(root, 'pwa');
let fail = 0;
const i18nSrc = readFileSync(join(pwa, 'js/i18n.js'), 'utf8');

const pages = readdirSync(pwa).filter(f => f.endsWith('.html'));
const expected = ['index', 'setup-round', 'solo', 'leaderboard', 'guide', 'handicap', 'auth', 'offline',
  'tournaments', 'oom', 'predictor', 'stats', 'players', 'feed', 'tv', 'qr-start', 'assistant', 'admin', 'design-preview'];
for (const e of expected) {
  if (!pages.includes(e + '.html')) { console.log('✗ страница отсутствует:', e + '.html'); fail++; }
}

for (const f of pages) {
  const s = readFileSync(join(pwa, f), 'utf8');
  for (const m of s.matchAll(/(?:src|href)="(?!https?:|#|mailto:|tel:)([^"?]+)/g)) {
    const p = m[1];
    if (!existsSync(join(pwa, p))) { console.log('✗', f, 'нет ассета', p); fail++; }
  }
  for (const m of s.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    try { new Script(m[1]); } catch (e) { console.log('✗', f, 'инлайн-скрипт:', e.message); fail++; }
  }
  for (const m of s.matchAll(/data-i18n(?:-ph)?="([a-z0-9.]+)"/g)) {
    if (!i18nSrc.includes("'" + m[1] + "'")) { console.log('✗', f, 'нет i18n-ключа', m[1]); fail++; }
  }
}
// SW precache: все CORE-файлы существуют
const sw = readFileSync(join(pwa, 'sw.js'), 'utf8');
const core = sw.match(/var CORE = \[([\s\S]*?)\];/);
if (core) {
  for (const m of core[1].matchAll(/'([^']+)'/g)) {
    if (!existsSync(join(pwa, m[1]))) { console.log('✗ sw precache нет файла', m[1]); fail++; }
  }
}
console.log(fail ? `PWA-контракт: ${fail} проблем` : `PWA-контракт: OK (${pages.length} страниц)`);
process.exitCode = fail ? 1 : 0;
