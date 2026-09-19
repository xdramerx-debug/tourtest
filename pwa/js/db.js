/* Единый источник истины (§2.1): Firebase RTDB в проде; в демо — встроенный бэкенд
   на том же API-контракте (compat: on(value)/set/update/push/remove + offline-очередь).
   Вставьте pwa/js/firebase-config.js с window.FIREBASE_CONFIG → включается реальный Firebase. */
(function () {
  'use strict';

  var hasFirebase = typeof firebase !== 'undefined' && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey;
  var db = null, useLocal = !hasFirebase;

  /* ---------------- Встроенный демо-бэкенд (persist + realtime эппарентно) -------------- */
  var NS = 'pc-rtdb';
  var BC = 'BroadcastChannel' in window ? new BroadcastChannel(NS) : null;
  var listeners = new Map(); // path -> Set<fn>
  var memory = null;

  function now() { return Date.now(); }
  function clone(x) { return x == null ? null : JSON.parse(JSON.stringify(x)); }

  function load() {
    if (memory) return memory;
    try { memory = JSON.parse(localStorage.getItem(NS) || 'null') || {}; } catch (e) { memory = {}; }
    if (!memory.settings) seed();
    return memory;
  }
  function persist() { try { localStorage.setItem(NS, JSON.stringify(memory)); } catch (e) {} }
  function seed() {
    var C = window.APP_CONFIG || {};
    memory = memory || {};
    memory.settings = memory.settings || {};
    if (!memory.settings.course) memory.settings.course = C.course;
    if (!memory.settings.design) memory.settings.design = { mode: 'single', global: 0, pages: {}, blocks: {}, updatedAt: now() };
    if (!memory.settings.privacy) memory.settings.privacy = { enabled: false, maskMode: 'all', players: {} };
    if (memory.settings.stableford_display_default == null) memory.settings.stableford_display_default = true;
    if (!memory.settings.tools_menu_enabled) memory.settings.tools_menu_enabled = true;
    if (!memory.settings.my_preferences_enabled) memory.settings.my_preferences_enabled = true;
    if (!memory.settings.tournament_leaderboard_variant) memory.settings.tournament_leaderboard_variant = 0;
    if (!memory.settings.tn_gender_split) memory.settings.tn_gender_split = 0;
    if (!memory.settings.tn_roster_variant) memory.settings.tn_roster_variant = 0;
    if (!memory.settings.tn_scorecard_variant) memory.settings.tn_scorecard_variant = 0;
    if (!memory.settings.hcp_badge_variant) memory.settings.hcp_badge_variant = 0;
    if (memory.settings.sessions_reset_ts == null) memory.settings.sessions_reset_ts = 0;
    memory.users = memory.users || {};
    memory.rounds = memory.rounds || {};
    memory.markers = memory.markers || {};
    memory.tournaments = memory.tournaments || {};
    memory.protocols = memory.protocols || {};
    memory.broadcasts = memory.broadcasts || {};
    memory.alerts = memory.alerts || {};
    memory.reactions = memory.reactions || {};
    memory.push_subscriptions = memory.push_subscriptions || {};
    memory.feed = memory.feed || {};
    // демо-пользователи для автопоиска в «Начать раунд» (§5.2) — не «реальные игроки»
    if (!memory.__seededUsers) {
      var demo = [
        ['Иван Петров', 'men', 12.4, 'wh'], ['Сергей Ихнов', 'men', 8.1, 'bk'],
        ['Ольга Ильина', 'women', 20.3, 'rd'], ['Марина Енина', 'women', 15.6, 'wh'],
        ['Алексей Дудин', 'men', 26.8, 'bl'], ['Катерина Пронина', 'women', 9.9, 'wh'],
        ['Никита Фёдоров', 'men', 3.2, 'bk'], ['Лела Фролова', 'women', 24.4, 'rd'],
        ['Max Bernart', 'men', 18.2, 'wh'], ['Екатерина Смирнова', 'women', 11.7, 'wh']
      ];
      demo.forEach(function (d, i) {
        var uid = 'demo-' + (i + 1);
        memory.users[uid] = { name: d[0], gender: d[1], handicap: d[2], defaultTee: d[3], email: 'demo' + (i + 1) + '@pestovo.local', createdAt: now() - (30 - i) * 86400000 };
      });
      // демо-турнир «в прямом эфире»: 2 флета, частичные карточки — для оживления превью
      var HCP = { 'demo-1': 12.4, 'demo-2': 8.1, 'demo-3': 20.3, 'demo-4': 15.6, 'demo-5': 26.8, 'demo-6': 9.9, 'demo-7': 3.2, 'demo-8': 24.4 };
      var TEE = { 'demo-1': 'wh', 'demo-2': 'bk', 'demo-3': 'rd', 'demo-4': 'wh', 'demo-5': 'bl', 'demo-6': 'wh', 'demo-7': 'bk', 'demo-8': 'rd' };
      var GEN = { 'demo-1': 'men', 'demo-2': 'men', 'demo-3': 'women', 'demo-4': 'women', 'demo-5': 'men', 'demo-6': 'women', 'demo-7': 'men', 'demo-8': 'women' };
      var NAMES = { 'demo-1': 'Иван Петров', 'demo-2': 'Сергей Ихнов', 'demo-3': 'Ольга Ильина', 'demo-4': 'Марина Енина', 'demo-5': 'Алексей Дудин', 'demo-6': 'Катерина Пронина', 'demo-7': 'Никита Фёдоров', 'demo-8': 'Лела Фролова' };
      var pars = (C.course && C.course.holes || []).map(function (h) { return h.p; });
      function scoresFor(thru, bias) {
        var sc = {};
        for (var n = 1; n <= thru; n++) { var p = pars[n - 1] || 4; var d = ((n * 7 + bias * 3) % 4) - 1; sc[String(n)] = Math.max(1, p + d); }
        return sc;
      }
      var tourPlayers = {};
      ['demo-1', 'demo-2', 'demo-5', 'demo-4'].forEach(function (uid, i) {
        var tee = TEE[uid], g = GEN[uid], hi = HCP[uid];
        tourPlayers[uid] = { name: NAMES[uid], gender: g, tee: tee, handicap: hi,
          fieldHcp: window.WHS ? window.WHS.fieldHcp(hi, tee, g, C.course.ratings, C.course.par) : null,
          flight: 'A', scores: scoresFor(9, i) };
      });
      ['demo-3', 'demo-6', 'demo-7', 'demo-8'].forEach(function (uid, i) {
        var tee = TEE[uid], g = GEN[uid], hi = HCP[uid];
        tourPlayers[uid] = { name: NAMES[uid], gender: g, tee: tee, handicap: hi,
          fieldHcp: window.WHS ? window.WHS.fieldHcp(hi, tee, g, C.course.ratings, C.course.par) : null,
          flight: 'B', scores: scoresFor(5, i + 2) };
      });
      memory.tournaments['demo-tour-1'] = {
        name: 'Кубок открытия сезона «Пестово»', date: new Date().toISOString().slice(0, 10),
        format: 'stroke', divisions: 'both', tee: 'bl', tiebreak: 'countback', status: 'live',
        createdAt: now() - 3600000 * 2, startsAt: now() - 3600000 * 2, players: tourPlayers
      };
      memory.broadcasts['demo-bc-1'] = { title: 'Добро пожаловать в Пестово Live!', body: 'Кубок открытия сезона уже на поле — следите за живым счётом на табло.', audience: 'all', time: now() - 3600000 };
      memory.alerts['demo-alert-1'] = { type: 'marshal', hole: 7, playerName: 'Тур Смирнов', time: now() - 900000, status: 'closed', round: null };
      memory.__seededUsers = true;
    }
    persist();
  }

  function getAt(path) {
    var parts = path.split('/').filter(Boolean); var cur = load();
    for (var i = 0; i < parts.length; i++) { if (cur == null) return null; cur = cur[parts[i]]; }
    return clone(cur);
  }
  function setAt(path, value, notify) {
    var parts = path.split('/').filter(Boolean); var root = load(); var cur = root;
    for (var i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
    cur[parts[parts.length - 1]] = value;
    persist();
    if (notify !== false) {
      emit(path);
      if (BC) BC.postMessage({ type: 'set', path: path });
    }
  }
  function emit(path) {
    // уведомляем всех слушателей префиксов (как RTDB `.on('value')` на родителя)
    listeners.forEach(function (set, lpath) {
      if (path === lpath || path.indexOf(lpath + '/') === 0 || lpath.indexOf(path + '/') === 0) {
        set.forEach(function (fn) { try { fn(getAt(lpath)); } catch (e) { console.error(e); } });
      }
    });
  }

  function localOn(path, cb) {
    if (!listeners.has(path)) listeners.set(path, new Set());
    listeners.get(path).add(cb);
    setTimeout(function () { try { cb(getAt(path)); } catch (e) {} }, 0);
    return function () { var s = listeners.get(path); if (s) s.delete(cb); };
  }
  if (BC) BC.onmessage = function (ev) { if (ev.data && ev.data.type === 'set') { memory = null; emit(ev.data.path); } };

  /* ------------------ Публичный API (одинаков локально и в Firebase) ------------------- */
  var DB = {
    now: now,
    on: function (path, cb) {
      if (!useLocal) {
        var ref = db.ref(path);
        var handler = ref.on('value', function (snap) { cb(snap.exists() ? snap.val() : null); });
        return function () { ref.off('value', handler); };
      }
      return localOn(path, cb);
    },
    get: function (path) {
      if (!useLocal) return db.ref(path).get().then(function (s) { return s.exists() ? s.val() : null; });
      return Promise.resolve(getAt(path));
    },
    set: function (path, value) {
      if (!useLocal) return db.ref(path).set(value);
      setAt(path, value); return Promise.resolve();
    },
    update: function (path, partial) {
      if (!useLocal) return db.ref(path).update(partial);
      var cur = getAt(path) || {};
      if (typeof cur !== 'object') cur = {};
      Object.keys(partial).forEach(function (k) { cur[k] = partial[k]; });
      setAt(path, cur); return Promise.resolve();
    },
    push: function (path, value) {
      var id = (path.replace(/\//g, '-') + '-' + now().toString(36) + Math.random().toString(36).slice(2, 8));
      if (!useLocal) {
        var ref = db.ref(path).push();
        return ref.set(value).then(function () { return ref.key; });
      }
      setAt(path + '/' + id, value); return Promise.resolve(id);
    },
    remove: function (path) {
      if (!useLocal) return db.ref(path).remove();
      setAt(path, null); return Promise.resolve();
    },
    /** Оффлайн-очередь (§2.4): при отсутствии сети (или в локальном режиме — всегда сразу)
        пишем в очередь и немедленно применяем; SYNC_SCORES вытатривает её при появлении сети. */
    setWithQueue: function (path, value) {
      var self = this;
      var doWrite = function () { return self.set(path, value); };
      if (useLocal || navigator.onLine) return doWrite();
      return new Promise(function (resolve) {
        var q = JSON.parse(localStorage.getItem('pc.queue') || '[]');
        q.push({ path: path, value: value, at: now() });
        localStorage.setItem('pc.queue', JSON.stringify(q));
        // локальное мгновенное отображение: применяем в demo как «задержанная запись»
        setAt(path, value);
        resolve();
      });
    },
    flushQueue: function () {
      var self = this; var q = [];
      try { q = JSON.parse(localStorage.getItem('pc.queue') || '[]'); } catch (e) {}
      if (!q.length) return Promise.resolve(0);
      return q.reduce(function (p, item) {
        return p.then(function () { return self.set(item.path, item.value); });
      }, Promise.resolve()).then(function () {
        localStorage.setItem('pc.queue', '[]'); return q.length;
      });
    },
    queuedCount: function () { try { return (JSON.parse(localStorage.getItem('pc.queue') || '[]') || []).length; } catch (e) { return 0; } },
    mode: function () { return useLocal ? 'demo' : 'firebase'; }
  };

  window.DB = DB;

  if (!useLocal) {
    try {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.database();
    } catch (e) { console.error('firebase init', e); useLocal = true; }
  }
  window.addEventListener('online', function () { DB.flushQueue(); });
  document.addEventListener('sw:sync', function () { DB.flushQueue(); });
})();
