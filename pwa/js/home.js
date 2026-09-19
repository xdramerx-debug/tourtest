/* Главная (§5.1): мои раунды → live-лента «Сейчас на поле» → последние → курс → цифры. */
(function () {
  'use strict';
  window.UI.mount('index');
  document.getElementById('tools-btn').addEventListener('click', function () { window.UI.openToolsModal(); });

  var collapsed = JSON.parse(localStorage.getItem('pc.collapse') || '{}');
  document.querySelectorAll('[data-coll]').forEach(function (btn) {
    var id = btn.getAttribute('data-coll');
    var body = document.getElementById(id);
    if (collapsed[id]) { body.hidden = true; btn.textContent = '+'; }
    btn.addEventListener('click', function () {
      body.hidden = !body.hidden;
      btn.textContent = body.hidden ? '+' : '−';
      collapsed[id] = body.hidden; localStorage.setItem('pc.collapse', JSON.stringify(collapsed));
    });
  });

  var C = window.APP_CONFIG;
  var roundsCache = {};
  window.DB.on('rounds', function (rounds) {
    roundsCache = rounds || {};
    var arr = Object.entries(roundsCache);
    renderLive(arr.filter(function (r) { return r[1].status === 'active'; }));
    renderRecent(arr.filter(function (r) { return r[1].status === 'completed'; })
      .sort(function (a, b) { return (b[1].endTime || b[1].startTime || 0) - (a[1].endTime || a[1].startTime || 0); }).slice(0, 6));
    renderNumbers();
  });

  window.Auth.onChange(function () { DB.get('rounds').then(renderMine); });

  function sessionUid() { var u = window.Auth.current(); return u && !u.guest ? u.uid : null; }
  function sessionNames() {
    var u = window.Auth.current();
    var out = [];
    if (u && u.name) out.push(u.name.toLowerCase().trim());
    return out;
  }

  function renderMine(rounds) {
    var names = sessionNames(); var wrap = document.getElementById('my-rounds');
    var sec = document.getElementById('sec-mine');
    var mine = Object.entries(rounds || {}).filter(function (r) {
      if (r[1].status !== 'active') return false;
      return Object.values(r[1].players || {}).some(function (p) { return names.indexOf(String(p.name || '').toLowerCase().trim()) >= 0; });
    });
    if (!mine.length) { sec.hidden = true; return; }
    sec.hidden = false;
    wrap.innerHTML = mine.map(function (r) {
      var me = Object.values(r[1].players || {}).find(function (p) { return names.indexOf(String(p.name || '').toLowerCase().trim()) >= 0; });
      return roundCard(r, 'home.continue', roundUrl(r[0], me));
    }).join('');
  }

  function renderLive(list) {
    var wrap = document.getElementById('sec-live-body');
    if (!list.length) { wrap.innerHTML = '<div class="card">' + t('home.mine.empty') + '</div>'; return; }
    list.sort(function (a, b) { return (a[1].startTime || 0) - (b[1].startTime || 0); });
    wrap.innerHTML = list.map(function (r) { return roundCard(r, 'home.continue', roundUrl(r[0], null)); }).join('');
  }

  function renderRecent(list) {
    var wrap = document.getElementById('sec-recent-body');
    wrap.innerHTML = list.length ? list.map(function (r) { return roundCard(r, null, null); }).join('') : '';
  }

  function roundCard(r, actionKey, actionHref) {
    var id = r[0], rd = r[1];
    var players = Object.entries(rd.players || {});
    var holePlayers = players.map(function (pv) {
      var p = pv[1];
      var sum = window.WHS.summarize(p.scores || {}, C.course.holes, p.fieldHcp);
      var nameView = window.Util.showName(p.name, pv[0], window.__privacy, window.Auth.isAdmin());
      return '<div class="prec">' +
        '<div><div><b>' + window.Util.escapeHtml(nameView) + '</b> ' + badgesFor(p) + '</div>' +
        '<small>' + (rd.tee ? teeLabel(rd.tee) : '') + ' · ' + fmtStart(rd) + '</small></div>' +
        '<div class="score-badge">' + (rd.status === 'completed' ? sum.gross : (sum.thru ? 'F' + sum.thru + ' / ' + fmtToPar(sum.toPar) : '—')) + '</div>' +
        '</div>';
    }).join('');
    var title = (rd.format ? t('format.' + rd.format) : t('format.stroke'));
    var paceInfo = paceInfoFor(rd);
    return '<div class="card livecard card--click" data-round="' + id + '" onclick="if(!event.target.closest(\'a\'))location=\'' + roundUrl(id, null) + '\'">' +
      '<div class="card__head"><span class="card__title">' + title + '</span>' +
      '<span class="badge">' + t(rd.status === 'completed' ? 'round.status.done' : 'round.status.active' + (rd.paused ? ' · ' + t('round.paused') : '')) + '</span></div>' +
      '<div class="holesumo">' + (rd.paused ? '<div class="stat"><b>⏸</b>' + (rd.pauseReason || '') + '</div>' : '') +
      (paceInfo ? '<div class="stat"><b>' + paceInfo + '</b>pace</div>' : '') + '</div>' +
      '<div class="players-grid">' + holePlayers + '</div>' +
      (actionHref ? '<div class="btnrow"><a class="btn" href="' + actionHref + '">' + t(actionKey || 'home.continue') + '</a></div>' : '') +
      '</div>';
  }

  function badgesFor(p) {
    if (p.exactHcp == null && p.fieldHcp == null) return '';
    var b = '';
    if (p.tee) b += '<span class="badge badge--tee-' + p.tee + '">' + teeLabel(p.tee) + '</span> ';
    if (p.exactHcp != null) b += '<span class="badge">' + t('hcp.exact') + ' ' + window.WHS.round1(p.exactHcp) + '</span> ';
    if (p.fieldHcp != null) b += '<span class="badge ' + window.Util.hcpBadgeClass(p.fieldHcp) + '">' + t('hcp.field') + ' ' + p.fieldHcp + '</span>';
    return b;
  }

  function fmtStart(rd) {
    if (rd.startTime) return window.Util.fmtTime(rd.startTime);
    return '—';
  }
  function fmtToPar(tp) { if (tp == null || tp === 0) return 'E'; return tp > 0 ? '+' + tp : String(tp); }

  function paceInfoFor(rd) {
    if (!rd.startTime || rd.status !== 'active') return null;
    var hrs = (Date.now() - rd.startTime) / 3600000;
    if (hrs < 0) return null;
    var m = Math.round(hrs * 60);
    return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  }

  function renderNumbers() {
    var rows = Object.entries(roundsCache);
    var players = new Set(); var birdies = 0;
    rows.forEach(function (r) { Object.keys(r[1].players || {}).forEach(function (pk) { players.add(pk); }); });
    // считаем birdie+ из готовых раундов
    rows.forEach(function (r) {
      Object.values(r[1].players || {}).forEach(function (p) {
        Object.entries(p.scores || {}).forEach(function (h) {
          var hole = C.course.holes[Number(h[0]) - 1];
          if (hole && h[1] <= hole.p - 1 && h[1] > 0) birdies++;
        });
      });
    });
    var tiles = [
      [players.size, t('nav.players')], [rows.length, t('nav.rounds')],
      [Object.keys(window.__tournaments || {}).length, t('nav.tournaments')], [birdies, 'Birdie+ всего']
    ];
    document.getElementById('club-numbers').innerHTML = tiles.map(function (ti) {
      return '<div class="stat-tile"><b>' + ti[0] + '</b><small>' + ti[1] + '</small></div>';
    }).join('');
  }

  window.DB.on('tournaments', function (tourns) { window.__tournaments = tourns || {}; renderNumbers(); });
  window.DB.on('settings/privacy', function (p) { window.__privacy = p; });

  function teeLabel(tee) { return (C.tees[tee] || {})[i18nLang()] || tee.toUpperCase(); }
  function roundUrl(id, me) {
    // QName §5.13: группа → solo с «двойным» режимом live.js (этап 2); solo → solo.html; kiosk при ?as=
    return 'solo.html?round=' + id + (me ? '&as=' + encodeURIComponent(me.name) : '');
  }
})();
