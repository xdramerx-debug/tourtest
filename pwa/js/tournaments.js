/* Турниры (§5.3): 5 видов табло, 3 gender-разделения, 3 вида состава, 3 вида scorecard,
   статусы DQ/WD/DNS/DNF, публикация протокола v2 (админ). */
(function () {
  'use strict';
  window.UI.mount('tournaments');
  var C = window.APP_CONFIG;
  var qs = new URLSearchParams(location.search);
  var curId = qs.get('tournament');
  window.__privacy = window.__privacy || null;

  var state = { board: 'table', division: 'all', rosterView: 'flights', cardView: 'full', cardPid: null };

  window.DB.on('settings/privacy', function (p) { window.__privacy = p; if (curId) openDetail(curId); });
  window.DB.on('tournaments', function (trs) {
    window.__tours = trs || {};
    if (curId) openDetail(curId);
    else renderList();
  });
  document.getElementById('back').addEventListener('click', function () {
    curId = null; history.replaceState(null, '', 'tournaments.html');
    document.getElementById('tdetail').style.display = 'none';
    document.getElementById('tlist').style.display = '';
    renderList();
  });

  function renderList() {
    try { renderListSafe(); }
    catch (e) {
      var w = document.getElementById('tlist');
      if (w) w.innerHTML = '<div class="card" style="border-color:var(--danger,#c33);">Ошибка отрисовки списка: ' + (e && e.message || e) + '</div>';
      console.error('renderList error', e);
    }
  }
  function renderListSafe() {
    var wrap = document.getElementById('tlist');
    var items = Object.entries(window.__tours || {});
    if (!items.length) { wrap.innerHTML = '<div class="card">Турниров пока нет. Создайте их в <a href="admin.html">админке</a>.</div>'; return; }
    wrap.innerHTML = items.map(function (t) {
      var tr = t[1];
      var n = Object.keys(tr.players || {}).length;
      return '<div class="card livecard">' +
        '<div class="card__head"><span class="card__title">' + window.Util.escapeHtml(tr.name || t[0]) + '</span>' +
        '<span class="badge">' + (tr.status === 'live' ? '· LIVE' : tr.status === 'done' ? t('round.status.done') : tr.status || '—') + '</span></div>' +
        '<small style="color:var(--muted)">' + (tr.date || '') + ' · ' + t('format.' + (tr.format || 'stroke')) + ' · ' + n + ' уч.</small>' +
        (tr.protocolId ? ' <span class="badge badge--ok">протокол опубликован</span>' : '') +
        '<div class="btnrow"><a class="btn" href="tournaments.html?tournament=' + t[0] + '">Открыть</a>' +
        (tr.status === 'live' ? ' <a class="btn btn--ghost" href="tv.html?tournament=' + t[0] + '">📺 TV</a>' : '') + '</div>' +
        '</div>';
    }).join('');
  }

  function openDetail(id) {
    curId = id;
    var tr = (window.__tours || {})[id];
    if (!tr) return;
    document.getElementById('tdetail').style.display = '';
    document.getElementById('tlist').style.display = 'none';
    document.getElementById('tdetailBody').innerHTML =
      '<div class="page-head"><h1>' + window.Util.escapeHtml(tr.name || id) + '</h1>' +
      '<p class="desc">' + (tr.date || '') + ' · ' + t('format.' + (tr.format || 'stroke')) + ((tr.cut && tr.cut.kind) ? ' · cut ' + tr.cut.kind + ':' + (tr.cut.n || tr.cut.x || tr.cut.p) : '') + '</p></div>' +
      toolbar() +
      '<div id="tpane"></div>';
    wireToolbar(tr);
    renderPane(tr);
  }

  function btnGroup(label, items, current, key) {
    return '<div style="margin:8px 0;"><small style="color:var(--muted)">' + label + '</small><div class="btnrow">' +
      items.map(function (it) {
        return '<button class="btn ' + (current === it.v ? 'btn--accent' : 'btn--ghost') + '" data-k="' + key + '" data-v="' + it.v + '">' + it.l + '</button>';
      }).join('') + '</div></div>';
  }
  function toolbar() {
    return '<div class="card">' +
      btnGroup('Вид табло (5)', [
        { v: 'table', l: 'Таблица' }, { v: 'grid', l: 'Сетка' }, { v: 'tv', l: 'TV' }, { v: 'cards', l: 'Карточки' }, { v: 'compact', l: 'Компакт' }
      ], state.board, 'board') +
      btnGroup('Разделение (3)', [
        { v: 'all', l: 'Общий' }, { v: 'men', l: 'Мужчины' }, { v: 'women', l: 'Девушки' }
      ], state.division, 'division') +
      btnGroup('Состав (3)', [
        { v: 'flights', l: 'По флетам' }, { v: 'alpha', l: 'Алфавит' }, { v: 'index', l: 'По индексу' }
      ], state.rosterView, 'roster') +
      btnGroup('Карточка (3)', [
        { v: 'full', l: 'Полная' }, { v: 'lines', l: 'Строки' }, { v: 'mini', l: 'Мини' }
      ], state.cardView, 'cardview') +
      (window.Auth.isAdmin() ? '<div class="btnrow"><button class="btn btn--accent" id="publishProto" style="margin-left:auto;">🖨 Опубликовать протокол v2</button></div>' : '') +
      '</div>';
  }
  function wireToolbar(tr) {
    document.getElementById('tdetailBody').querySelectorAll('[data-k]').forEach(function (b) {
      b.addEventListener('click', function () {
        state[b.getAttribute('data-k')] = b.getAttribute('data-v');
        openDetail(curId);
      });
    });
    var pb = document.getElementById('publishProto');
    if (pb) pb.addEventListener('click', function () { publishProtocol(tr); });
  }

  function playersOf(tr) {
    return Object.entries(tr.players || {}).map(function (pv) { return Object.assign({ pid: pv[0] }, pv[1]); });
  }

  function renderPane(tr) {
    var pane = document.getElementById('tpane');
    var players = playersOf(tr);
    var lbs = { all: null, men: null, women: null };
    ['all', 'men', 'women'].forEach(function (d) {
      lbs[d] = window.TOUR.leaderboard(players, C.course.holes, { format: tr.format || 'stroke', division: d, tiebreak: tr.tiebreak || 'countback' });
    });
    var lb = lbs[state.division] || lbs.all;
    var html = '';
    if (state.board === 'table') html = boardTable(lb, tr);
    else if (state.board === 'grid') html = boardGrid(lb, tr);
    else if (state.board === 'tv') html = boardTV(lb, tr);
    else if (state.board === 'cards') html = boardCards(lb, tr, true);
    else html = boardCompact(lb, tr);
    html += '<h3 style="margin-top:18px;">Состав (' + players.length + ')</h3>' + roster(players, state.rosterView);
    html += '<h3 style="margin-top:18px;">Карточки</h3>' + scorecardBlock(players, tr, state.cardView);
    // простокол, если опубликован
    if (tr.protocolId) {
      window.DB.get('protocols/' + tr.protocolId).then(function (p) {
        var el = document.getElementById('protoView'); if (el) el.innerHTML = protocolHtml(p);
      });
      html += '<h3 style="margin-top:18px;">Протокол v2</h3><div id="protoView" class="card">…</div>';
    }
    pane.innerHTML = html;
  }

  /* ----- 5 видов табло ----- */
  function fmttopar(tp) { return tp === 0 || tp == null ? 'E' : tp > 0 ? '+' + tp : String(tp); }
  function nm(r, i) { return window.Util.showName(r.name, r.pid, window.__privacy, window.Auth.isAdmin()); }
  function scoreVal(r, format) {
    if (r.inactive) return '<b>' + r.status + '</b>';
    if (format === 'stableford') return '<b>' + (r.points || 0) + '</b> пт';
    if (format === 'skins') return '<b>' + (r.skins || 0) + '</b> ск.';
    return '<b>' + fmttopar(r.toPar) + '</b>' + (r.gross != null ? ' <small>(' + r.gross + ')</small>' : '');
  }

  function boardTable(lb, tr) {
    var rows = lb.map(function (r, i) {
      return '<tr><td>' + (r.place || '—') + '</td><td style="text-align:left;">' + nm(r) + (r.tee ? ' <span class="badge badge--tee-' + r.tee + '">' + r.tee.toUpperCase() + '</span>' : '') +
        '</td><td>' + (r.played != null ? 'F' + r.played : '—') + '</td><td>' + scoreVal(r, tr.format) + '</td><td>' + (r.net != null ? r.net : '—') + '</td></tr>';
    }).join('');
    return '<div class="card"><div class="tablewrap"><table class="tbl"><thead><tr><th>#</th><th>Игрок</th><th>' + t('lb.thru') + '</th><th>Итог</th><th>Нетто</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function boardGrid(lb, tr) {
    return '<div class="cards">' + lb.map(function (r) {
      return '<div class="card" style="text-align:center;"><div class="big">' + (r.place || '—') + '</div>' +
        '<b>' + nm(r) + '</b><div style="margin-top:4px;">' + scoreVal(r, tr.format) + '</div></div>';
    }).join('') + '</div>';
  }
  function boardTV(lb, tr) {
    return '<div class="card" data-dspb-tables="4"><div class="tablewrap"><table class="tbl"><thead><tr><th>#</th><th>Игрок</th><th>Итог</th></tr></thead><tbody>' +
      lb.slice(0, 12).map(function (r) { return '<tr><td>' + (r.place || '') + '</td><td style="text-align:left;font-size:1.15em;">' + nm(r) + '</td><td><b>' + scoreVal(r, tr.format) + '</b></td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }
  function boardCards(lb, tr, withScore) {
    return '<div class="cards">' + lb.map(function (r) {
      return '<div class="card livecard"><div class="card__head"><span class="card__title">' + (r.place || '—') + ' · ' + nm(r) + '</span><span class="score-badge">' + (r.inactive ? r.status : fmttopar(r.toPar)) + '</span></div>' +
        (withScore ? '<small style="color:var(--muted)">' + scoreVal(r, tr.format) + (r.net != null ? ' · нет ' + r.net : '') + '</small>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function boardCompact(lb, tr) {
    return '<div class="card" style="font-family:var(--mono);font-size:13px;white-space:pre-wrap;">' +
      lb.map(function (r) {
        return String(r.place || '—').padEnd(4) + (r.name || '').padEnd(22).slice(0, 22) + '  ' + (r.inactive ? r.status : fmttopar(r.toPar) + ' (' + (r.gross || '—') + ')');
      }).join('\n') + '</div>';
  }

  /* ----- 3 вида состава ----- */
  function roster(players, view) {
    if (!players.length) return '<div class="card">Состав пуст.</div>';
    if (view === 'flights') {
      var flights = window.TOUR.pairings(players, { by: 'index', size: 4 });
      return flights.map(function (f, i) {
        return '<div class="card"><b>Флет ' + String.fromCharCode(65 + i) + '</b><table class="tbl"><tbody>' +
          f.map(function (p) { return '<tr><td>' + window.Util.escapeHtml(p.name || '') + '</td><td>' + (p.fieldHcp != null ? p.fieldHcp : '—') + '</td><td>' + (p.tee || '—').toUpperCase() + '</td><td>' + (p.status || '') + '</td></tr>'; }).join('') +
          '</tbody></table></div>';
      }).join('');
    }
    var sorted = players.slice().sort(function (a, b) {
      return view === 'alpha' ? String(a.name || '').localeCompare(String(b.name || ''), 'ru') : (a.fieldHcp || 0) - (b.fieldHcp || 0);
    });
    return '<div class="card"><table class="tbl"><thead><tr><th>#</th><th>Игрок</th><th>Полевой</th><th>ТИ</th><th>Статус</th></tr></thead><tbody>' +
      sorted.map(function (p, i) { return '<tr><td>' + (i + 1) + '</td><td>' + window.Util.escapeHtml(p.name || '') + '</td><td>' + (p.fieldHcp != null ? p.fieldHcp : '—') + '</td><td>' + (p.tee || '—').toUpperCase() + '</td><td>' + (p.status || 'играет') + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  /* ----- 3 вида scorecard ----- */
  function scorecardBlock(players, tr, view) {
    if (!players.length) return '';
    if (view === 'mini') {
      return '<div class="card" style="font-family:var(--mono);font-size:12px;overflow-x:auto;">' +
        players.map(function (p) {
          var nums = [];
          for (var n = 1; n <= 18; n++) { var v = p.scores && p.scores[String(n)]; nums.push(v == null || v === 0 ? '·' : v); }
          return (p.name || '').padEnd(20).slice(0, 20) + ' │ ' + nums.join(' ');
        }).join('<br>') + '</div>';
    }
    var cells = view === 'lines' ? 9 : 18;
    return players.map(function (p) {
      var sum = window.WHS.summarize(p.scores || {}, C.course.holes, p.fieldHcp);
      var rows = ''; var half = cells === 9 ? 2 : 1;
      for (var block = 0; block < half; block++) {
        var HO = [], SC = [];
        for (var k = 1; k <= 9; k++) {
          var n = block * 9 + k;
          var hd = C.course.holes[n - 1]; var v = p.scores && p.scores[String(n)];
          HO.push('<td><b>' + n + '</b></td>');
          SC.push('<td style="' + cellBg(v, hd.p) + '">' + (v == null || v === 0 ? '·' : v) + '</td>');
        }
        rows += '<tr>' + HO.join('') + '</tr><tr>' + SC.join('') + '</tr>';
      }
      return '<div class="card"><div class="card__head"><span class="card__title">' + window.Util.escapeHtml(p.name || '') + '</span>' +
        '<span class="score-badge">' + (p.status || fmttopar(sum.toPar)) + '</span></div>' +
        '<div class="tablewrap"><table class="tbl" style="min-width:' + (cells === 9 ? 520 : 980) + 'px;"><tbody>' + rows + '</tbody></table></div>' +
        '<small style="color:var(--muted)">' + t('score.gross') + ' ' + (sum.gross || '—') + (p.fieldHcp != null ? ' · нет ' + Math.max(0, sum.gross - p.fieldHcp) : '') + (p.status ? ' · ' + p.status : '') + '</small></div>';
    }).join('');
  }
  function cellBg(v, par) {
    if (v == null || v === 0) return '';
    var d = v - par;
    if (d <= -2) return 'background:#1d5c3f;color:#fff;';
    if (d === -1) return 'background:#cfeee0;';
    if (d === 0) return '';
    if (d === 1) return 'background:#fdf1d7;';
    return 'background:#fbe4e4;';
  }

  /* ----- Протокол v2 ----- */
  function publishProtocol(tr) {
    var players = playersOf(tr);
    var lbs = {};
    ['all', 'men', 'women'].forEach(function (d) {
      lbs[d] = window.TOUR.leaderboard(players, C.course.holes, { format: tr.format || 'stroke', division: d, tiebreak: 'countback' });
    });
    var doc = window.TOUR.protocol(tr, lbs, { date: tr.date });
    window.DB.get('protocols/' + doc.tournamentId).then(function (old) {
      var diff = window.TOUR.protocolDiff(old, doc);
      if (!diff.allowed) {
        window.Util.toast('Протокол уже опубликован и неперезаписываем (' + diff.reason + ')', 'err');
        return;
      }
      window.DB.set('protocols/' + doc.tournamentId, doc).then(function () {
        return window.DB.update('tournaments/' + curId, { protocolId: doc.tournamentId });
      }).then(function () { window.Util.toast('Протокол v2 опубликован (hash ' + doc.hash + ')'); });
    });
  }
  function protocolHtml(p) {
    if (!p) return 'Протокол не найден.';
    function tbl(rows, title) {
      if (!rows || !rows.length) return '';
      return '<h4>' + title + '</h4><div class="tablewrap"><table class="tbl"><thead><tr><th>#</th><th>Игрок</th><th>Gross</th><th>Net</th><th>±par</th><th>Очки</th><th>Статус</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + (r.place || '') + '</td><td style="text-align:left;">' + window.Util.escapeHtml(r.name || '') + '</td><td>' + (r.gross != null ? r.gross : '—') + '</td><td>' + (r.net != null ? r.net : '—') + '</td><td>' + (r.toPar != null ? fmttopar(r.toPar) : '—') + '</td><td>' + (r.points != null ? r.points : '—') + '</td><td>' + (r.status || '') + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
    }
    return '<div class="card"><div class="card__head"><span class="card__title">Протокол v2 · ' + window.Util.escapeHtml(p.name || '') + '</span><span class="badge">hash ' + p.hash + '</span></div>' +
      '<small style="color:var(--muted)">v' + p.version + ' · ' + (p.date || '') + ' · опубликован ' + window.Util.fmtDate(p.createdAt) + ' · защищён от перезаписи</small>' +
      tbl(p.tables.all, 'Общий зачёт') + tbl(p.tables.men, 'Мужчины') + tbl(p.tables.women, 'Девушки') +
      '<div class="btnrow"><button class="btn btn--ghost" onclick="window.print()">⎙ Печать (принт-классик)</button></div></div>';
  }
})();
