#!/usr/bin/env node
/**
 * Проверка границ пакетов (ARCHITECTURE §6.1):
 *  - design-system / app-ui не импортируют доменные расчёты напрямую мимо @csl/scoring-engine;
 *  - packages/* не импортируют apps/*;
 *  - app-ui — единственный потребитель react-router; design-system не знает про роутер;
 *  - вариантные фичи живут в apps/* и config app-ui (нет if(variant) глубоко в пакетах).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|mjs)$/.test(name)) yield p;
  }
}

const rules = [
  { scope: /packages\//, ban: /from ['"]\.\.\/\.\.\/\.\.\/apps|from ['"]@csl\/app-/, msg: 'packages не импортируют apps' },
  { scope: /packages\/design-system\//, ban: /react-router/, msg: 'design-system не зависит от роутера' },
  { scope: /packages\/(core|scoring-engine|sync|testing)\//, ban: /from ['"]react(-dom)?['"]/, msg: 'доменные пакеты не зависят от react' },
  { scope: /packages\/design-system\/src\/(?!patterns)/, ban: /@csl\/scoring-engine/, msg: 'примитивы DS не тянут домен (только patterns/)' },
  { scope: /packages\/(core|sync|design-system)\//, ban: /variant === ['"]|config\.variant/, msg: 'вариантная логика только в app-ui/apps' },
];

for (const dir of readdirSync(join(root, 'packages'))) {
  const pdir = join(root, 'packages', dir);
  if (!statSync(pdir).isDirectory()) continue;
  for (const file of walk(pdir)) {
    if (file.includes('/test/')) continue;
    const rel = file.slice(root.length + 1);
    const src = readFileSync(file, 'utf8');
    for (const r of rules) {
      if (r.scope.test(rel) && r.ban.test(src)) {
        errors.push(`${rel}: ${r.msg}`);
      }
    }
  }
}

if (errors.length) {
  console.error('BOUNDARY VIOLATIONS:\n' + errors.map((e) => ' - ' + e).join('\n'));
  process.exit(1);
}
console.log('check-boundaries: OK');
