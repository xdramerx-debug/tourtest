/** Регистрация сервис-воркера (прод-сборка; dev/preview без SW для живости). */
export function registerSW() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const env = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
  if (env?.DEV) return;
  const meta = document.querySelector('meta[name="csl-basename"]')?.getAttribute('content') ?? '/';
  const swUrl = `${meta.replace(/\/$/, '')}/sw.js`;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { scope: meta }).catch(() => { /* SW опционален */ });
  });
}
