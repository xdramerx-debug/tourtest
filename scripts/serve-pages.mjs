#!/usr/bin/env node
/**
 * Статический превью-сервер GH Pages-артефактов: dist-pages/<variant>-<design>/.
 * Использование: node scripts/serve-pages.mjs [appDir] [port]
 *   node scripts/serve-pages.mjs apps/variant-a-core/design-1/dist 4020
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, process.argv[2] ?? 'dist-pages');
const port = Number(process.argv[3] ?? 4020);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.map': 'application/json',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let p = join(dir, decodeURIComponent(url.pathname));
  if (!p.startsWith(dir)) { res.writeHead(403); return res.end(); }
  if (url.pathname === '/' && !existsSync(join(dir, 'index.html'))) {
    // листинг сборок
    const links = [];
    const scan = (base, rel = '') => {
      for (const f of readdirSync(base)) {
        const fp = join(base, f);
        if (f === 'index.html' && rel) links.push(`<li><a href="${rel}/">${rel}</a></li>`);
        else if (statSync(fp).isDirectory()) scan(fp, rel ? `${rel}/${f}` : f);
      }
    };
    scan(dir);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<meta charset="utf-8"><h1>ClubScore Live builds</h1><ul>${links.join('')}</ul>`);
  }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) {
    // SPA fallback как на GH Pages: 404.html реализует redirect-трюк (D9),
    // локально базой приложения считаем корень превью
    const nf = join(dir, '404.html');
    if (existsSync(nf)) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(nf, 'utf8').replace(/__APP_BASE__/g, '/'));
    }
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(port, '0.0.0.0', () => console.log(`[pages] ${dir} → http://0.0.0.0:${port}`));
