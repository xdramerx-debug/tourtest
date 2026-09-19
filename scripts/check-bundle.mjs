#!/usr/bin/env node
/**
 * Бюджет бандла (NFR §1): первый экран ≤ 350 КБ gzip JS, ≤ 60 КБ gzip CSS.
 * Проверяет собранные apps (dist; после npm run build). Приоритет сборки — A×1, A×3, B×2, C×5.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_BUDGET = 350 * 1024;
const CSS_BUDGET = 60 * 1024;
const rows = [];
let fail = 0;

for (const v of readdirSync(join(root, 'apps')).filter((d) => d.startsWith('variant-') || d === 'scoring')) {
  const subs = v === 'scoring' ? ['.'] : readdirSync(join(root, 'apps', v)).filter((x) => x.startsWith('design-'));
  for (const d of subs) {
    const dist = join(root, "apps", v, d, "dist", "assets");
    const name = d === '.' ? v : `${v}/${d}`;
    if (!existsSync(dist)) { rows.push({ app: name, err: 'no dist — run build' }); fail += 1; continue; }
    let js = 0, css = 0;
    for (const f of readdirSync(dist)) {
      if (/\.js$/.test(f) && !f.includes('import-wrapper')) js += gzipSync(readFileSync(join(dist, f))).length;
      if (/\.css$/.test(f)) css += gzipSync(readFileSync(join(dist, f))).length;
    }
    const ok = js <= JS_BUDGET && css <= CSS_BUDGET;
    if (!ok) fail += 1;
    rows.push({ app: name, jsGzipKB: Math.round(js / 1024), cssGzipKB: Math.round(css / 1024), ok });
  }
}
console.table(rows);
if (fail) { console.error(`BUNDLE BUDGET: ${fail} over limit (JS≤350КБ gz, CSS≤60КБ gz)`); process.exit(1); }
console.log('check-bundle: OK');
