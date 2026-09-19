/* SW Пестово Live Scoring (§10): precache, runtime offline, офлайн-очередь очков
   (SYNC_SCORES), update-banner, push-уведомления. */
'use strict';
var VERSION = '3.0.0';
var PRECACHE = 'pc-precache-' + VERSION;
var RUNTIME = 'pc-runtime-' + VERSION;
var CORE = [
  'index.html', 'setup-round.html', 'solo.html', 'leaderboard.html', 'guide.html',
  'handicap.html', 'auth.html', 'offline.html', 'design-preview.html', 'manifest.json',
  'css/base.css',
  'js/config.js', 'js/i18n.js', 'js/db.js', 'js/auth.js', 'js/util.js', 'js/ui.js',
  'js/engine/whs.js', 'js/home.js', 'js/setup.js', 'js/solo.js', 'js/leaderboard.js',
  'js/sw-register.js'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(PRECACHE).then(function (c) {
    return Promise.allSettled(CORE.map(function (u) { return c.add(u + '?v=' + VERSION); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== PRECACHE && k !== RUNTIME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
      .then(function () {
        return self.clients.matchAll().then(function (cls) {
          cls.forEach(function (c) { c.postMessage({ type: 'SW_ACTIVATED', version: VERSION }); });
        });
      })
  );
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return; // API (погода, RTDB) — прямо в сеть
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(function (r) {
      var cp = r.clone(); caches.open(PRECACHE).then(function (c) { c.put(e.request, cp); });
      return r;
    }).catch(function () {
      return caches.match(e.request).then(function (r) { return r || caches.match('offline.html?v=' + VERSION); });
    }));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: false }).then(function (r) {
      if (r) return r;
      return caches.match(e.request, { ignoreSearch: true }).then(function (r2) {
        if (r2) return r2;
        return fetch(e.request).then(function (res) {
          if (res && res.status === 200) { var cp = res.clone(); caches.open(RUNTIME).then(function (c) { c.put(e.request, cp); }); }
          return res;
        });
      });
    })
  );
});
/* Офлайн-очередь очков: клиент сообщает SYNC_SCORES → SW шлёт в Firebase (rest-эндпоинт) */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'SYNC_SCORES' && Array.isArray(d.queue) && d.dbUrl) {
    e.waitUntil(Promise.allSettled(d.queue.map(function (q) {
      return fetch(d.dbUrl.replace(/\/$/, '') + '/' + q.path + '.json', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q.value)
      });
    })).then(function () {
      return self.clients.matchAll().then(function (cls) {
        cls.forEach(function (c) { c.postMessage({ type: 'SYNCED' }); });
      });
    }));
  }
});
self.addEventListener('sync', function (e) {
  if (e.tag === 'SYNC_SCORES') {
    e.waitUntil(self.clients.matchAll().then(function (cls) {
      cls.forEach(function (c) { c.postMessage({ type: 'SYNC_FLUSH' }); });
    }));
  }
});
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Пестово Live', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || 'pc-push', data: d.data || {}
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(clients.openWindow('/pwa/'));
});
