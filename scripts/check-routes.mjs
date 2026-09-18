#!/usr/bin/env node
/**
 * Контракт маршрутов (IA §5, FROZEN): app-ui root.tsx содержит все обязательные пути;
 * вариантные маршруты закрыты фича-флагами VARIANT_FEATURES (matrix из VARIANTS.md).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootTsx = readFileSync(join(root, 'packages/app-ui/src/root.tsx'), 'utf8');
const configTs = readFileSync(join(root, 'packages/app-ui/src/config.ts'), 'utf8');

const REQUIRED = [
  "path: '/'", "path: 'join'", "'t/:tid'", "'t/:tid/board'", "'t/:tid/play'",
  "'p/:pid'", "'history'", "path: 'admin'",
];
const GATED = [
  { path: 't/:tid/match/:mid', feature: 'matchPlay', absentIn: 'a' },
  { flag: 'tvMode', feature: 'tvMode', absentIn: 'a' },
  { flag: 'pwaInstall', feature: 'pwaInstall', presentIn: 'c' },
  { flag: 'heatmap', feature: 'heatmap', presentIn: 'c' },
];

const errors = [];
for (const p of REQUIRED) if (!rootTsx.includes(p)) errors.push(`root.tsx: нет маршрута ${p}`);
for (const g of GATED) {
  const m = configTs.match(/a: \{[\s\S]*?\}/);
  if (g.absentIn === 'a' && m && !new RegExp(`${g.feature}: false`).test(m[0])) {
    errors.push(`config.ts: фича ${g.feature} должна быть выключена в A (A⊂B⊂C)`);
  }
  if (g.presentIn === 'c' && !new RegExp(`${g.feature}: true`).test(configTs)) {
    errors.push(`config.ts: фича ${g.feature} должна быть включена в C`);
  }
}
if (!rootTsx.includes("path: 'offline'")) errors.push("root.tsx: нет офлайн-заглушки /offline");
if (!rootTsx.includes("path: '*'")) errors.push("root.tsx: нет catch-all *");

if (errors.length) { console.error('ROUTE CHECK FAILURES:\n' + errors.map((e) => ' - ' + e).join('\n')); process.exit(1); }
console.log('check-routes: OK');
