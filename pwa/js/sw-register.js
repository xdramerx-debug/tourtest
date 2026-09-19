/* Регистрация SW + update-banner + приём SYNCED (§10). */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(reg);
        });
      });
      if (reg.waiting) showUpdate(reg);
    }).catch(function () {});
  });
  function showUpdate(reg) {
    if (document.getElementById('upd-Bar')) return;
    var d = document.createElement('div');
    d.id = 'upd-Bar'; d.className = 'updatebar';
    var msg = (window.I18N && window.I18N.get() === 'en') ? 'New version available' : 'Доступно обновление';
    var btn = (window.I18N && window.I18N.get() === 'en') ? 'Refresh' : 'Обновить';
    d.innerHTML = '<span>' + msg + '</span><button class="btn btn--accent">' + btn + '</button>' +
      '<button class="btn btn--ghost">✕</button>';
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));' +
      'background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 12px;' +
      'display:flex;gap:10px;align-items:center;z-index:999;box-shadow:0 8px 24px rgba(0,0,0,.25);';
    document.body.appendChild(d);
    d.querySelector('.btn--accent').addEventListener('click', function () {
      if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }
      else { location.reload(); }
    });
    d.querySelector('.btn--ghost').addEventListener('click', function () { d.remove(); });
    navigator.serviceWorker.addEventListener('controllerchange', function () { location.reload(); }, { once: true });
  }
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'SYNCED' && window.Util) window.Util.toast('Счёт синхронизирован');
    });
  }
})();
