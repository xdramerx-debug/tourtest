/* Все раунды (§5.4): список, раскрытие, поиск, фильтр. */
(function () {
  'use strict';
  window.UI.mount('leaderboard');
  var C = window.APP_CONFIG;
  var all = [], filter = 'all', query = '';
  var expanded = {};

  window.DB.on('rounds', function (rounds) {
    all = Object.entries(rounds || {});
    all.sort(function (a, b) { return (b[1].startTime || b[1].createdAt || 0) - (a[1].startTime || a[1].createdAt || 0); });
    render();
  });
  window.DB.on('settings/privacy', function (p) { window.__privacy = p; render(); });

  document.getElementById('search').addEventListener('input', window.Util.debounce(function (e) { query = e.target.value.toLowerCase(); render(); }, 200));
  document.querySelectorAll('[data-f]').forEach(function (b) {
    b.addEventListener('click', function () {
      filter = filter === b.getAttribute('data-f') ? 'all' : b.getAttribute('data-f');
      document.querySelectorAll('[data-f]').forEach(function (x) { x.style.display = filter === 'all' || x.getAttribute('data-f') === filter ? '' : 'none'; });
      document.querySelector('[data-f="all"]').style.display = filter === 'all' ? '' : '';
      render();
    });
  });

  function matches(r) {
    var rd = r[1];
    if (filter !== 'all' && rd.status !== filter) return false;
    if (!query) return true;
    if ((rd.format || '').includes(query)) return true;
    return Object.values(rd.players || {}).some(function (p) { return String(p.name || '').toLowerCase().indexOf(query) >= 0; });
  }

  function render() {
    var wrap = document.getElementById('lb-list');
    var rows = all.filter(matches);
    if (!rows.length) { wrap.innerHTML = '<div class="card">' + t('lb.empty') + '</div>'; return; }
    wrap.innerHTML = rows.map(function (r) { return card(r); }).join('');
    wrap.querySelectorAll('[data-expand]').forEach(function (hd) {
      hd.addEventListener('click', function () {
        var id = hd.getAttribute('data-expand');
        expanded[id] = !expanded[id];
        render();
      });
    });
  }

  function card(r) {
    var id = r[0], rd = r[1];
    var players = Object.entries(rd.players || {});
    var head = players.map(function (pv) {
      var p = pv[1];
      var sum = window.WHS.summarize(p.scores || {}, C.course.holes, p.fieldHcp);
      return pv[0] === Object.keys(rd.players || {})[0]
        ? window.Util.showName(p.name, pv[0], window.__privacy, window.Auth.isAdmin()) + ' <span class="score-badge">' + (rd.status === 'completed' ? sum.gross : 'F' + (sum.thru || 0)) + '</span>' : ' +' + (players.length - 1);
    }).join(' · ');
    var open = expanded[id];
    return '<div class="card livecard">' +
      '<div class="card__head" data-expand="' + id + '">' +
      '<span class="card__title">' + head + '</span>' +
      '<span class="badge">' + t(rd.status === 'completed' ? 'round.status.done' : rd.status === 'active' ? 'round.status.active' : 'round.status.scheduled') + ' ' + (open ? '−' : '+') + '</span></div>' +
      '<small style="color:var(--muted)">' + window.Util.fmtDate(rd.endTime || rd.startTime || rd.createdAt) + ' · ' + teeLabel(rd.tee) + ' · ' + t('format.' + (rd.format || 'stroke')) + '</small>' +
      (open ? detailTable(rd) : '') +
      (rd.status === 'active' ? '<div class="btnrow"><a class="btn" href="solo.html?round=' + id + '">' + t('home.continue') + '</a></div>' : '') +
      '</div>';
  }

  function detailTable(rd) {
    var players = Object.entries(rd.players || {});
    if (!players.length) return '';
    var rows = players.map(function (pv) {
      var p = pv[1];
      var cells = C.course.holes.map(function (h, i) {
        var v = p.scores && p.scores[String(i + 1)];
        return '<td>' + (v != null && v !== 0 ? v : '·') + '</td>';
      });
      var sum = window.WHS.summarize(p.scores || {}, C.course.holes, p.fieldHcp);
      return '<tr><td style="min-width:160px;">' + window.Util.showName(p.name, pv[0], window.__privacy, window.Auth.isAdmin()) +
        ' ' + (p.tee ? '<span class="badge badge--tee-' + p.tee + '">' + p.tee.toUpperCase() + '</span>' : '') + '</td>' + cells.join('') +
        '<td><b>' + (sum.gross || '—') + '</b></td></tr>';
    });
    var head = C.course.holes.map(function (h, i) { return '<th>' + (i + 1) + '</th>'; }).join('');
    return '<div class="tablewrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Игрок</th>' + head + '<th>G</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function teeLabel(tee) { return (C.tees[tee] || {})[i18nLang()] || String(tee || '').toUpperCase(); }
})();
