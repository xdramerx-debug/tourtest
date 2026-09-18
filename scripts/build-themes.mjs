#!/usr/bin/env node
/**
 * build-themes — генерирует packages/tokens/dist/:
 *   base.css           — сброс + семантические утилиты (var-основанные)
 *   theme-{id}.css     — @font-face + токены для [data-design][data-mode]
 *   fonts/*.woff2      — self-hosted начертания из @fontsource (cyrillic+latin)
 * Запуск: node scripts/build-themes.mjs
 */
import { mkdirSync, writeFileSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESIGNS } from '../packages/tokens/src/themes.data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'packages/tokens/dist');
const FONTS_OUT = join(OUT, 'fonts');
mkdirSync(FONTS_OUT, { recursive: true });

const NM = (pkg) => join(ROOT, 'node_modules', '@fontsource', pkg, 'files');

let copiedFonts = 0;
const fontFaceRules = [];
const seenFaces = new Set();
for (const d of DESIGNS) {
  for (const slot of ['display', 'text', 'numeric']) {
    const f = d.fonts[slot];
    if (!f?.source) continue;
    for (const w of f.weights) {
      const key = `${f.source}/${w}`;
      if (seenFaces.has(key)) continue;
      seenFaces.add(key);
      for (const subset of ['cyrillic', 'latin']) {
        const file = `${f.source}-${subset}-${w}-normal.woff2`;
        const src = join(NM(f.source), file);
        if (!existsSync(src)) {
          console.error(`✗ fontsource файл не найден: ${file}`);
          process.exitCode = 1;
          continue;
        }
        copyFileSync(src, join(FONTS_OUT, file));
        copiedFonts++;
        const family = f.css.split(',')[0].replaceAll('"', '');
        fontFaceRules.push(`@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url("./fonts/${file}") format("woff2");unicode-range:${subset === 'latin'
          ? 'U+0000-00FF,U+2000-206F,U+20AC,U+2122'
          : 'U+0400-04FF,U+0500-052F'};}`);
      }
    }
  }
}

const cssVar = (name, value) => `  --${name}:${value};`;

function themeCss(d) {
  const parts = [];
  for (const [mode, p] of Object.entries(d.modes)) {
    const sel = mode === d.defaultMode
      ? `:root[data-design="${d.id}"],:root[data-design="${d.id}"][data-mode="${mode}"]`
      : `:root[data-design="${d.id}"][data-mode="${mode}"]`;
    parts.push(`${sel}{`);
    const v = [];
    v.push(cssVar('c-bg', p.bg), cssVar('c-surface', p.surface), cssVar('c-surface2', p.surface2));
    v.push(cssVar('c-text', p.text), cssVar('c-text-muted', p.textMuted));
    v.push(cssVar('c-primary', p.primary), cssVar('c-on-primary', p.onPrimary));
    v.push(cssVar('c-accent', p.accent), cssVar('c-accent-text', p.accentText), cssVar('c-on-accent', p.onAccent));
    v.push(cssVar('c-live', p.live), cssVar('c-under-par', p.underPar), cssVar('c-over-par', p.overPar));
    v.push(cssVar('c-warning', p.warning), cssVar('c-danger', p.danger), cssVar('c-border', p.border), cssVar('c-focus', p.focus));
    v.push(cssVar('c-sun-backdrop', p.sunBackdrop));
    parts.push(v.join('\n'));
    parts.push('}');
  }
  const g = [];
  g.push(`:root[data-design="${d.id}"]{`);
  g.push(cssVar('f-display', d.fonts.display.css), cssVar('f-text', d.fonts.text.css), cssVar('f-numeric', d.fonts.numeric.css));
  if (d.fonts.numeric.feature) g.push(cssVar('f-numeric-feature', d.fonts.numeric.feature));
  g.push(cssVar('grid-max', `${d.grid.max}px`), cssVar('grid-gutter', `${d.grid.gutter}px`), cssVar('grid-cols', d.grid.cols));
  g.push(cssVar('row-desktop', `${d.density.rowDesktop}px`), cssVar('row-touch', `${d.density.rowTouch}px`));
  d.density.space.forEach((s, i) => g.push(cssVar(`s${i + 1}`, `${s}px`)));
  g.push(cssVar('r-sm', `${d.radius.sm}px`), cssVar('r-md', `${d.radius.md}px`), cssVar('r-lg', `${d.radius.lg}px`), cssVar('r-pill', `${d.radius.pill}px`));
  g.push(cssVar('bw', `${d.border.w}px`), cssVar('bs', d.border.style));
  g.push(cssVar('sh-1', d.shadow[1]), cssVar('sh-2', d.shadow[2]), cssVar('sh-glow', d.shadow.glow));
  g.push(cssVar('icon-stroke', d.icons.stroke), cssVar('icon-caps', d.icons.caps));
  g.push(cssVar('m-fast', d.motion.durFast), cssVar('m-dur', d.motion.dur), cssVar('m-slow', d.motion.durSlow));
  g.push(cssVar('m-ease', d.motion.ease), cssVar('m-spring', d.motion.spring));
  g.push(`  color-scheme:${d.defaultMode === 'dark' ? 'dark light' : 'light dark'};`);
  g.push('}');
  // Режим "солнце": запретить blur/прозрачности декором
  g.push(`:root[data-design="${d.id}"][data-mode="sun"] .ds-blur{backdrop-filter:none!important;}`);
  return parts.join('\n') + '\n' + g.join('\n') + '\n';
}

for (const d of DESIGNS) {
  writeFileSync(join(OUT, `theme-${d.id}.css`), fontFaceRules.join('\n') + '\n' + themeCss(d));
}

// base.css — сброс и общие основания (токено-агностично)
writeFileSync(join(OUT, 'base.css'), `/* ClubScore Live base — генерируется build-themes.mjs, не править вручную */
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;font-family:var(--f-text,system-ui);background:var(--c-bg,#fff);color:var(--c-text,#111);
  -webkit-font-smoothing:antialiased;font-size:16px;line-height:1.45;
  overscroll-behavior-y:none}
#root{min-height:100dvh;display:flex;flex-direction:column}
h1,h2,h3,h4{font-family:var(--f-display,var(--f-text));line-height:1.15;margin:0}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;touch-action:manipulation}
a{color:inherit;text-decoration:none}
input,select,textarea{font:inherit;color:inherit}
:focus{outline:none}
:focus-visible{outline:3px solid var(--c-focus,#005fcc);outline-offset:2px;border-radius:var(--r-sm,4px)}
img{max-width:100%;display:block}
[hidden]{display:none!important}
.num{font-family:var(--f-numeric,var(--f-text));font-variant-numeric:var(--f-numeric-feature,"tnum" 1)}
.visually-hidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
`);

const cssFiles = readdirSync(OUT).filter((f) => f.endsWith('.css'));
console.log(`✓ tokens: ${cssFiles.length} css, ${copiedFonts} woff2 → ${OUT}`);
