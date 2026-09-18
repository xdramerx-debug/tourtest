#!/usr/bin/env node
/**
 * Собирает все 15 сборок (variant×design) в apps/…/dist.
 * CI-режим: последовательно, с таймингом каждой сборки.
 * Фильтр: node scripts/build-all-apps.mjs variant-a/design-1
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv[2] ?? null;
const variants = readdirSync(join(root, 'apps')).filter((d) => d.startsWith('variant-'));
const jobs = [];
for (const v of variants) {
  for (const d of readdirSync(join(root, 'apps', v)).filter((x) => x.startsWith('design-'))) {
    if (!only || `${v}/${d}` === only || `${v.replace('variant-', '').split('-')[0]}/${d}` === only) jobs.push([v, d]);
  }
}
if (!jobs.length) { console.error('no apps matched'); process.exit(1); }

const report = [];
let fail = 0;
for (const [v, d] of jobs) {
  const name = `@csl/app-${v.replace('variant-', '').split('-')[0]}-${d.replace('design-', 'd')}`;
  const t0 = Date.now();
  const r = spawnSync('npm', ['run', 'build', '--workspace', name], { cwd: root, stdio: 'inherit' });
  const ms = Date.now() - t0;
  const ok = r.status === 0;
  if (!ok) fail += 1;
  report.push({ app: `${v}/${d}`, ok, ms });
  console.log(`\n=== ${v}/${d}: ${ok ? 'OK' : 'FAIL'} (${(ms / 1000).toFixed(1)}s) ===\n`);
}
const outDir = join(root, 'artifacts');
if (process.env.CI) { mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, 'build-report.json'), JSON.stringify(report, null, 2)); }
console.log(`\nBUILD SUMMARY: ${jobs.length - fail}/${jobs.length} ok`);
process.exit(fail ? 1 : 0);
