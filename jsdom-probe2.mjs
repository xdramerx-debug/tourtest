import { JSDOM } from 'jsdom';
import fs from 'node:fs';
const pwa = process.cwd() + '/pwa';
function loadPage(full) {
  const file = full.split('?')[0];
  const html = fs.readFileSync(pwa + '/' + file, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost:4040/' + full, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.fetch = () => new Promise(() => {});
  window.BroadcastChannel = class { postMessage() {} close() {} };
  window.addEventListener('error', e => console.log('WINDOW-ERROR:', e.message));
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1].replace(/\?.*$/, '').replace(/^\.\//, ''));
  for (const src of srcs) {
    const code = fs.readFileSync(pwa + '/' + src, 'utf8');
    try { window.eval(code); } catch (e) { console.log('SCRIPT-THROW', src, '→', String(e).split('\n')[0]); }
  }
  return dom;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { window } = loadPage('admin.html?tab=wizard');
await window.Auth.signIn('admin', 'admin').catch(e => console.log('signin', String(e)));
await sleep(700);
const { document: doc } = window;
console.log('[admin] user:', JSON.stringify(window.Auth.currentUser()));
console.log('[admin] chips:', doc.querySelectorAll('#admTabs .chip').length);
console.log('[admin] pane:', JSON.stringify((doc.getElementById('admPane').textContent || '').slice(0, 250)));
console.log('[admin] admBody display:', doc.getElementById('admBody').style.display || '(unset)');
console.log('[admin] gate:', JSON.stringify((doc.getElementById('gate').textContent || '').slice(0, 120)));
