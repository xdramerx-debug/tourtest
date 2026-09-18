#!/usr/bin/env node
/**
 * Полнота локализации (NFR §4, IA): каждый литеральный ключ t('…')/t(`…`)
 * в app-ui/apps существует в ru и en словарях @csl/core.
 * Динамические ключи (t(`format.${id}`)) покрыты расширением списков домена.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(readFileSync(join(root, 'packages/core/src/i18n/ru.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(root, 'packages/core/src/i18n/en.json'), 'utf8'));

function* walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(n)) yield p;
  }
}

const staticKey = /\bt\(\s*['`]([a-z0-9]+(?:\.[a-zA-Z0-9_]+)+)['`]/g;
const tplKey = /\bt\(\s*`([a-z0-9]+)\.\$\{[^}]+\}`/g;

const used = new Set();
const dynPrefixes = new Set();
for (const dir of [join(root, 'packages/app-ui/src'), join(root, 'apps')]) {
  for (const f of walk(dir)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(staticKey)) used.add(m[1]);
    for (const m of src.matchAll(tplKey)) dynPrefixes.add(m[1]);
  }
}

const DYN_VALUES = {
  format: ['stroke', 'stableford', 'match', 'fourball', 'foursome', 'scramble', 'bestball', 'betterball', 'skins', 'teamagg'],
  status: ['live', 'registration', 'finished', 'dns', 'dq', 'wd'],
  sync: ['online', 'offline', 'reconnecting', 'demo', 'connecting'],
  role: ['player', 'marker', 'referee', 'admin', 'spectator', 'captain'],
};

const missing = [];
for (const k of used) {
  if (!(k in ru)) missing.push(`ru: ${k}`);
  if (!(k in en)) missing.push(`en: ${k}`);
}
for (const p of dynPrefixes) {
  for (const v of DYN_VALUES[p] ?? []) {
    const k = `${p}.${v}`;
    if (!(k in ru)) missing.push(`ru: ${k} (динамический)`);
    if (!(k in en)) missing.push(`en: ${k} (динамический)`);
  }
}
if (missing.length) {
  console.error('I18N MISSING KEYS:\n' + missing.map((m) => ' - ' + m).join('\n'));
  process.exit(1);
}
console.log(`check-i18n: OK (${used.size} статических + ${dynPrefixes.size} динамических семейств)`);
