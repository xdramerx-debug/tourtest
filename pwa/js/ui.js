/* Общая шапка/навигация/виджеты (§5): бургер, погода, RU/EN, online-бейдж,
   update+install баннеры, шаблоны дизайна (§9: data-dsp*, ?dsp=N). */
(function () {
  'use strict';

  var UI = window.UI = {
    mount: function (activeKey) {
      renderHeader(activeKey); bindWeather(); bindConnBadge(); bindInternationalization();
      UI.applyDesignFromParams(); UI.applyStoredDesign(); UI.applyCourseOverrides();
      document.addEventListener('pc:lang', function () { if (window.UI.refreshHeaderText) UI.refreshHeaderText(); });
    },

    /* settings/course (админ → «Поле»): runtime-override таймингов/метражей поверх seed */
    applyCourseOverrides: function () {
      var C = window.APP_CONFIG; if (!C || !C.course) return;
      function merge(sc) {
        if (!sc) return;
        if (sc.timingsOverride) { Object.keys(sc.timingsOverride).forEach(function (n) { C.course.timings[n] = Number(sc.timingsOverride[n]) || C.course.timings[n]; }); }
        if (sc.yardagesOverride) {
          Object.keys(sc.yardagesOverride).forEach(function (n) {
            var hd = C.course.holes[Number(n) - 1]; if (!hd) return;
            ['bk', 'bl', 'wh', 'rd'].forEach(function (t2) { if (sc.yardagesOverride[n][t2] != null) hd[t2] = Number(sc.yardagesOverride[n][t2]); });
          });
        }
      }
      try { /* локальный override (админ без БД-права) */ var over = JSON.parse(localStorage.getItem('pc.courseOverride') || 'null'); if (over) merge({ timingsOverride: over }); } catch (e) {}
      window.DB.on('settings/course', merge);
    },

    /* ---------- design templates (§9) ---------- */
    applyDesignFromParams: function () {
      var p = new URLSearchParams(location.search);
      if (!p.get('dsp')) return;
      document.documentElement.setAttribute('data-dsp', p.get('dsp'));
    },
    applyStoredDesign: function () {
      window.DB.on('settings/design', function (d) {
        d = d || { mode: 'single', global: 0, pages: {}, blocks: {} };
        var html = document.documentElement;
        if (new URLSearchParams(location.search).get('dsp') != null) return; // ?dsp= важнее
        html.setAttribute('data-dsp', String(d.global == null ? 0 : d.global));
        html.setAttribute('data-dsp-mode', d.mode || 'single');
        var page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
        if (d.mode === 'mix' && d.pages && d.pages[page] != null && d.pages[page] !== 'inherit') {
          html.setAttribute('data-dsp-page', String(d.pages[page]));
        } else html.removeAttribute('data-dsp-page');
        ['nav', 'hero', 'page-head', 'card', 'buttons', 'forms', 'stats', 'tables', 'badges', 'footer', 'tabs', 'round-card']
          .forEach(function (blk) {
            if (d.blocks && d.blocks[blk] != null && d.blocks[blk] !== 'inherit') html.setAttribute('data-dspb-' + blk, String(d.blocks[blk]));
            else html.removeAttribute('data-dspb-' + blk);
          });
      });
    },

    /* ---------- гости-инструменты главной (§5.1 п.7) ---------- */
    openToolsModal: function () {
      var html =
        '<h3>' + t('home.more') + '</h3>' +
        '<div class="tools">' +
        '<a class="btn" href="tv.html">TV-табло</a>' +
        '<a class="btn" href="tournaments.html">' + t('nav.tournaments') + '</a>' +
        '<a class="btn" href="oom.html">' + t('nav.oom') + '</a>' +
        '<a class="btn" href="stats.html">' + t('nav.stats') + '</a>' +
        '<a class="btn" href="players.html">' + t('nav.players') + '</a>' +
        '<a class="btn" href="guide.html">' + t('nav.guide') + '</a>' +
        '<a class="btn" href="handicap.html">' + t('nav.handicap') + '</a>' +
        '<a class="btn" href="predictor.html">' + t('nav.predictor') + '</a>' +
        '<a class="btn" href="feed.html">' + t('nav.feed') + '</a>' +
        '<a class="btn" href="assistant.html">' + t('nav.assistant') + '</a>' +
        '<a class="btn" href="qr-start.html">QR-старт</a>' +
        '<a class="btn" href="design-preview.html">' + t('nav.design') + '</a>' +
        (window.Auth.isAdmin() ? '<a class="btn btn--accent" href="admin.html">' + t('nav.admin') + '</a>' : '<a class="btn" href="auth.html">' + t('nav.auth') + '</a>') +
        '<a class="btn ghost" href="#" data-close>✕</a>' +
        '</div>';
      window.Util.modal(html);
    }
  };

  function renderHeader(active) {
    var C = window.APP_CONFIG;
    var wrap = document.getElementById('app-header');
    if (!wrap) { wrap = document.createElement('header'); wrap.id = 'app-header'; document.body.prepend(wrap); }
    wrap.setAttribute('data-dsp-block', 'nav');
    wrap.className = 'topnav';
    wrap.innerHTML =
      '<div class="topnav__row">' +
      '  <a class="brand" href="index.html" data-dsp-block="nav">' +
      '    <span class="brand__logo">⛳</span>' +
      '    <span class="brand__text"><b>' + (C.club.i18nName ? C.club.i18nName() : C.club.name) + '</b><small data-i18n="app.tag">' + t('app.tag') + '</small></span>' +
      '  </a>' +
      '  <div class="topnav__weather" id="wx" title="' + t('weather.label') + '">--°</div>' +
      '  <div class="topnav__conn" id="conn" title="conn"></div>' +
      '  <button class="topnav__lang" id="lang-sw" title="' + t('ui.lang') + '">' + (window.i18nLang ? i18nLang().toUpperCase() : 'RU') + '</button>' +
      '  <button class="topnav__burger" id="burger" aria-label="menu"><span></span><span></span><span></span></button>' +
      '</div>' +
      '<nav class="topnav__menu" id="topmenu">' +
      menuItems(active) +
      '</nav>' +
      '<div class="installsw"><button id="install-btn" class="install-btn" hidden>⤓ ' + t('ui.install') + '</button></div>';

    document.getElementById('burger').addEventListener('click', function () {
      document.getElementById('topmenu').classList.toggle('open');
    });
    document.getElementById('lang-sw').addEventListener('click', function () {
      setLang(window.i18nLang() === 'ru' ? 'en' : 'ru');
      renderHeader(active);
    });
    bindInstall();

    // подвал
    if (!document.querySelector('.foot')) {
      var f = document.createElement('footer'); f.className = 'foot'; f.setAttribute('data-dsp-block', 'footer');
      f.innerHTML = '<div>' + C.club.name + ' · ' + C.club.city + '</div><div class="foot__ver">' + t('ui.version') + ': <b>' + C.siteVersion + '</b> · ' + window.DB.mode() + '</div>';
      document.body.appendChild(f);
    }
  }

  function menuItems(active) {
    var items = [
      ['index.html', 'nav.home'], ['setup-round.html', 'nav.setup'], ['leaderboard.html', 'nav.rounds'],
      ['tournaments.html', 'nav.tournaments'], ['stats.html', 'nav.stats'], ['order-of-merit.html', 'nav.oom'],
      ['handicap.html', 'nav.handicap'], ['guide.html', 'nav.guide'], ['feed.html', 'nav.feed'],
      ['players.html', 'nav.players'], ['predictor.html', 'nav.predictor'], ['tv.html', null, 'TV-табло'],
      ['assistant.html', 'nav.assistant'], ['design-preview.html', 'nav.design'], ['admin.html', 'nav.admin'], ['auth.html', null, 'Вход / профиль']
    ];
    return items.map(function (it) {
      var href = it[0], key = it[1], label = it[2] || (key ? t(key) : href);
      var cls = href.replace('.html', '') === active ? 'active' : '';
      return '<a class="' + cls + '" href="' + href + '">' + label + '</a>';
    }).join('');
  }

  function bindWeather() {
    var el = document.getElementById('wx'); if (!el) return;
    var C = window.APP_CONFIG;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + C.club.lat + '&longitude=' + C.club.lon +
      '&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto', { signal: AbortSignal.timeout ? AbortSignal.timeout(C.weather.timeoutMs) : undefined })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var cur = d.current || {};
        el.innerHTML = weatherIcon(cur.weather_code) + ' <b>' + Math.round(cur.temperature_2m) + '°</b><small> ' + t('weather.wind') + ' ' + Math.round(cur.wind_speed_10m) + ' м/с</small>';
      })
      .catch(function () { el.textContent = '—'; });
  }

  function weatherIcon(code) {
    if (code === 0) return '☀️'; if (code <= 2) return '🌤️'; if (code <= 3) return '☁️';
    if (code <= 48) return '🌫️'; if (code <= 67) return '🌧️'; if (code <= 77) return '🌨️';
    if (code <= 82) return '🌧️'; if (code <= 86) return '🌨️'; if (code <= 99) return '⛈️';
    return '🌤️';
  }

  function bindConnBadge() {
    var el = document.getElementById('conn'); if (!el) return;
    function paint() {
      var online = navigator.onLine;
      var queued = window.DB.queuedCount();
      el.className = 'topnav__conn' + (online || window.DB.mode() === 'demo' ? ' ok' : ' off');
      var label = online || window.DB.mode() === 'demo' ? t('ui.online') : t('ui.offline');
      el.innerHTML = (online ? '●' : '○') + ' ' + label + (queued ? ' <span class="queue">+' + queued + '</span>' : '');
    }
    paint();
    window.addEventListener('online', function () { paint(); window.DB.flushQueue().then(paint); });
    window.addEventListener('offline', paint);
    document.addEventListener('pc:lang', paint);
  }

  function bindInternationalization() { /* data-i18n применяется i18n.js при загрузке; здесь только мигание новых узлов */ }

  function bindInstall() {
    var deferred;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferred = e;
      var b = document.getElementById('install-btn'); if (b) b.hidden = false;
    });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'install-btn' && deferred) { deferred.prompt(); deferred = null; e.target.hidden = true; }
    });
  }
})();
