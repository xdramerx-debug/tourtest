#!/usr/bin/env node
/**
 * Контраст ключевых пар токенов (WCAG 2.2 AA, NFR §4): text/bg ≥ 4.5, large ≥ 3,
 * акцент/фон кнопки ≥ 4.5 для текста кнопки. Источник — packages/tokens/src/themes.data.mjs.
 */
import { DESIGNS } from '../packages/tokens/src/themes.data.mjs';

const lum = (hex) => {
  const c = hex.replace('#', '');
  const rgb = [0, 1, 2].map((i) => parseInt(c.slice(i * 2, i * 2 + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const fails = [];
for (const d of DESIGNS) {
  for (const [mode, p] of Object.entries(d.modes)) {
    const checks = [
      ['text/bg', p.text, p.bg, 4.5],
      ['textMuted/surface', p.textMuted, p.surface, 3],
      ['onPrimary/primary', p.onPrimary, p.primary, 4.5],
      ['onAccent/accent', p.onAccent, p.accent, 4.5],
      ['accentText/surface', p.accentText, p.surface, 4.5],
      ['live/surface2', p.live, p.surface2, 3],
      ['underPar/surface', p.underPar, p.surface, 3],
      ['overPar/surface', p.overPar, p.surface, 3],
    ];
    for (const [label, a, b, min] of checks) {
      const r = ratio(a, b);
      if (r < min) fails.push(`design-${d.id}/${mode} ${label}: ${r.toFixed(2)} < ${min} (${a} on ${b})`);
    }
  }
}
if (fails.length) { console.error('CONTRAST FAILURES:\n' + fails.map((f) => ' - ' + f).join('\n')); process.exit(1); }
console.log(`check-contrast: OK (${DESIGNS.length} designs × 3 modes)`);
