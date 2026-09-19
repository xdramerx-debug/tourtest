/* «Начало раунда» (§5.2): автопоиск игрока из users + гость; pace-таблица;
   URL-parameter ?: round=…&as=… → kiosk-режим для повторного входа (§5.13). */
(function () {
  'use strict';
  window.UI.mount('setup-round');
  var C = window.APP_CONFIG;
  var players = []; // {uid?, name, gender, handicap, tee?}
  var qs = new URLSearchParams(location.search);

  var startHoleSel = document.getElementById('startHole');
  for (var h = 1; h <= C.course.holesCount; h++) {
    var o = document.createElement('option'); o.value = String(h); o.textContent = String(h); startHoleSel.appendChild(o);
  }

  var now = new Date();
  document.getElementById('startTime').value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  // автопоиск по имени — из каталога (§5.2)
  DB.get('users').then(function (users) {
    var dl = document.getElementById('userList');
    dl.innerHTML = Object.entries(users || {}).map(function (u) {
      return '<option value="' + window.Util.escapeHtml(u[1].name) + '" data-uid="' + u[0] + '"></option>';
    }).join('');
    window.__catalog = users || {};
  });

  document.getElementById('addByName').addEventListener('click', function () {
    var inp = document.getElementById('playerSearch');
    var name = inp.value.trim(); if (!name) return;
    var uid = null, prof = null;
    Object.entries(window.__catalog || {}).some(function (u) {
      if (u[1].name.toLowerCase() === name.toLowerCase()) { uid = u[0]; prof = u[1]; return true; } return false;
    });
    if (prof) {
      players.push({ uid: uid, name: prof.name, gender: prof.gender || 'men', handicap: prof.handicap, tee: prof.defaultTee || null });
    } else {
      players.push({ uid: null, name: name, gender: 'men', handicap: null, tee: null, askGuest: true });
    }
    inp.value = '';
    renderPlayers();
  });

  document.getElementById('addGuest').addEventListener('click', function () {
    var html =
      '<h3>Гость</h3>' +
      '<label class="field">ФИО<input id="g-name" type="text"></label>' +
      '<div class="row">' +
      '<label class="field">Пол<select id="g-gender"><option value="men">Мужчина</option><option value="women">Девушка</option></select></label>' +
      '<label class="field">ТИ<select id="g-tee"><option value="bk">Чёрный</option><option value="bl">Синий</option><option value="wh" selected>Белый</option><option value="rd">Красный</option></select></label>' +
      '<label class="field">Точный HCP<input id="g-hcp" type="number" step="0.1" placeholder="12.4"></label>' +
      '</div>' +
      '<div class="btnrow"><button class="btn btn--accent" id="g-save" type="button">Добавить</button><button class="btn btn--ghost" data-close type="button">✕</button></div>';
    var m = window.Util.modal(html);
    m.el.querySelector('#g-save').addEventListener('click', function () {
      var name = m.el.querySelector('#g-name').value.trim();
      if (name.length < 3) return window.Util.toast('ФИО: минимум 3 символа', 'err');
      players.push({
        uid: null, name: name, gender: m.el.querySelector('#g-gender').value,
        tee: m.el.querySelector('#g-tee').value,
        handicap: m.el.querySelector('#g-hcp').value ? Number(m.el.querySelector('#g-hcp').value.replace(',', '.')) : null
      });
      m.close(); renderPlayers();
    });
  });

  function renderPlayers() {
    var wrap = document.getElementById('playersList');
    wrap.innerHTML = players.map(function (p, i) {
      var field = (p.handicap != null) ? window.WHS.fieldHcp(p.handicap, (p.tee || document.getElementById('tee').value), p.gender, C.course.ratings, C.course.par) : null;
      return '<div class="card" style="display:flex;gap:8px;align-items:center;">' +
        '<b>' + (i + 1) + '. ' + window.Util.escapeHtml(p.name) + '</b>' +
        '<span class="badge badge--tee-' + (p.tee || document.getElementById('tee').value) + '">' + (p.tee || document.getElementById('tee').value).toUpperCase() + '</span>' +
        (p.handicap != null ? '<span class="badge">HI ' + p.handicap + '</span>' : '') +
        (field != null ? '<span class="badge ' + window.Util.hcpBadgeClass(field) + '">' + t('hcp.field') + ' ' + field + '</span>' : '') +
        '<button type="button" class="btn btn--ghost" data-i="' + i + '" style="margin-left:auto;">✕</button>' +
        '</div>';
    }).join('');
    wrap.querySelectorAll('button[data-i]').forEach(function (b) {
      b.addEventListener('click', function () { players.splice(Number(b.getAttribute('data-i')), 1); renderPlayers(); });
    });
  }

  // pace-превью (§5.2): по старт-лунке, числу лунок и времени начала
  function renderPacePreview() {
    var startHole = Number(document.getElementById('startHole').value);
    var nHoles = Number(document.getElementById('nHoles').value);
    var tm = document.getElementById('startTime').value.split(':');
    var rows = []; var cum = 0; var seq = holeSeq(startHole, nHoles, C.course.holesCount);
    seq.forEach(function (hn) {
      var hole = C.course.holes[hn - 1]; var t= C.course.timings[hn] || 15; cum += t;
      var dt = new Date(); dt.setHours(Number(tm[0] || 8), Number(tm[1] || 0) + cum, 0, 0);
      rows.push('<tr><td class="holewin">' + hn + '</td><td>P' + hole.p + '</td><td>' + t + ' мин</td><td>' + dt.toLocaleTimeString().slice(0, 5) + '</td></tr>');
    });
    document.getElementById('pacePreview').innerHTML =
      '<thead><tr><th>#</th><th>P</th><th>Pace, мин</th><th>Время</th></tr></thead><tbody>' + rows.join('') + '</tbody>';
  }
  ['startHole', 'nHoles', 'startTime'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', renderPacePreview);
  });
  renderPacePreview();

  function holeSeq(start, count, total) {
    var out = []; var h = start;
    while (out.length < count) { out.push(h); h = (h % total) + 1; }
    return out;
  }

  document.getElementById('setupForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!players.length) return window.Util.toast('Добавьте хотя бы одного игрока', 'err');
    var tee = document.getElementById('tee').value;
    var format = document.getElementById('format').value;
    var startHole = Number(document.getElementById('startHole').value);
    var nHoles = Number(document.getElementById('nHoles').value);
    var tm = document.getElementById('startTime').value.split(':');
    var start = new Date(); start.setHours(Number(tm[0] || 8), Number(tm[1] || 0), 0, 0);
    if (start.getTime() < Date.now() - 10 * 60000) start = new Date(); // прошлое → сейчас

    var id = 'r' + window.Util.uid();
    var rec = {
      status: 'active', tee: tee, format: format, startHole: startHole, nHoles: nHoles,
      startTime: start.getTime(), createdAt: Date.now(), players: {}
    };
    players.forEach(function (p, i) {
      var pid = 'p' + (i + 1) + window.Util.uid().slice(0, 4);
      var playerTee = p.tee || tee;
      rec.players[pid] = {
        name: p.name, gender: p.gender, tee: playerTee,
        exactHcp: p.handicap, fieldHcp: p.handicap == null ? null : window.WHS.fieldHcp(p.handicap, playerTee, p.gender, C.course.ratings, C.course.par),
        scores: {}, marker: i > 0
      };
    });
    window.DB.set('rounds/' + id, rec).then(function () {
      var firstPid = Object.keys(rec.players)[0];
      var q = players.length > 1 ? '&group=1' : '';
      location = 'solo.html?round=' + id + '&player=' + firstPid + q;
      if (players.length > 1) location = 'solo.html?round=' + id + '&player=' + firstPid + q;
    });
  });

  // kiosk per §5.13: прямой линк к вводу
  if (qs.get('round')) { /* solo.html сам подхватит */ }
})();
