/* Админка (§6): 15 вкладок одним модулем. Аудит — push('audit'). */
(function () {
  'use strict';
  window.UI.mount('admin');
  var C = window.APP_CONFIG;
  var TABS = [
    ['alerts', '🚨 Вызовы'], ['rounds', '🏌 Раунды'], ['scorer', '✏️ Счёт'],
    ['pace', '⏱ Pace'], ['wizard', '🧙 Мастер турнира'], ['tourman', '🏆 Турниры'],
    ['course', '⛳ Поле'], ['protocol', '📜 Протоколы'], ['announce', '📢 Анонсы'],
    ['players', '👤 Игроки'], ['imexp', '⇅ Импорт/экспорт'], ['rusgolf', '🔗 RUSGOLF'],
    ['settings', '⚙ Данные'], ['design', '🎨 Дизайн'], ['helper', '🤖 Помощник']
  ];
  var cur = new URLSearchParams(location.search).get('tab') || 'alerts';
  var PANE, auditActor = 'admin';

  /* --- вход --- */
  function gate() {
    var g = document.getElementById('gate');
    if (window.Auth.isAdmin()) {
      g.innerHTML = '<p style="color:var(--good)">✓ ' + (window.Auth.currentUser() && window.Auth.currentUser().name || 'Администратор') + '</p>';
      document.getElementById('admBody').style.display = '';
      document.getElementById('admMode').textContent = 'Режим: ' + window.DB.mode() + ' · очередь: ' + (window.DB.queuedCount ? window.DB.queuedCount() : 0);
      initTabs();
    } else {
      g.innerHTML = '<div class="card" style="max-width:420px;">Для доступа войдите: <a class="btn btn--accent" href="auth.html">Вход</a><br><small style="color:var(--muted)">Демо: admin / admin</small></div>';
      document.getElementById('admBody').style.display = 'none';
    }
  }
  window.Auth.onChange(gate); gate();

  function initTabs() {
    var bar = document.getElementById('admTabs');
    bar.innerHTML = TABS.map(function (t2) {
      return '<button class="chip' + (cur === t2[0] ? ' is-on' : '') + '" data-t="' + t2[0] + '">' + t2[1] + '</button>';
    }).join('');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      cur = b.getAttribute('data-t');
      history.replaceState(null, '', 'admin.html?tab=' + cur);
      bar.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      render();
    });
    PANE = document.getElementById('admPane');
    render();
  }
  function render() {
    ({ alerts: tabAlerts, rounds: tabRounds, scorer: tabScorer, pace: tabPace, wizard: tabWizard, tourman: tabTourMan,
       course: tabCourse, protocol: tabProtocol, announce: tabAnnounce, players: tabPlayers, imexp: tabImexp,
       rusgolf: tabRusgolf, settings: tabSettings, design: tabDesign, helper: tabHelper })[cur](PANE);
  }
  function audit(action, detail) {
    window.DB.push('audit', { ts: Date.now(), actor: auditActor, action: action, detail: detail || '', tab: cur });
  }
  function fm(t) { return window.Util.fmtDate(t); }
  function esc(s) { return window.Util.escapeHtml(s == null ? '' : String(s)); }

  /* ===== 1. Вызовы (§6.1): троттлинг 300мс, push админам, закрытие ===== */
  function tabAlerts(el) {
    window.DB.on('alerts', function (alerts) {
      var rows = Object.entries(alerts || {}).sort(function (a, b) { return (b[1].time || 0) - (a[1].time || 0); });
      el.innerHTML = '<div class="card"><h3>Активные вызовы</h3>' +
        (rows.filter(function (r) { return r[1].status !== 'closed'; }).length ? '' : '<p>Всё чисто 🎉</p>') +
        rows.map(function (r) {
          var a = r[1];
          var closed = a.status === 'closed';
          return '<div class="card" style="' + (closed ? 'opacity:.5;' : '') + '">' +
            '<div class="card__head"><span class="card__title">' + (a.type === 'marshal' ? '🏍 Маршал' : '🚨 Судья') + ' · лунка ' + (a.hole || '?') + '</span>' +
            '<span class="badge ' + (closed ? '' : 'badge--danger') + '">' + (closed ? 'закрыт' : 'АКТИВЕН') + '</span></div>' +
            '<small style="color:var(--muted)">' + fm(a.time) + ' · ' + esc(a.playerName || '') + (a.round ? ' · раунд ' + esc(a.round) : '') + '</small>' +
            (closed ? '' : '<div class="btnrow"><button class="btn btn--accent" data-take="' + r[0] + '">Принять (push)</button><button class="btn btn--ghost" data-close="' + r[0] + '">Закрыть</button></div>') +
          '</div>';
        }).join('') + '</div>';
      // троттлинг 300мс на массовые действия
      var lastPush = 0;
      el.querySelectorAll('[data-take]').forEach(function (b) {
        b.addEventListener('click', function () {
          var now = Date.now();
          if (now - lastPush < 300) { window.Util.toast('Подождите 300 мс между push', 'err'); return; }
          lastPush = now;
          window.DB.push('broadcasts', { title: '🚨 Вызов принят', body: 'Судья едет на лунку ' + b.parentNode.parentNode.querySelector('.card__title').textContent.split('лунка ')[1], audience: 'all', time: now });
          window.DB.update('alerts/' + b.getAttribute('data-take'), { status: 'taken', takenAt: now, takenBy: auditActor });
          audit('alert-take', b.getAttribute('data-take'));
        });
      });
      el.querySelectorAll('[data-close]').forEach(function (b) {
        b.addEventListener('click', function () {
          window.DB.update('alerts/' + b.getAttribute('data-close'), { status: 'closed', closedAt: Date.now() });
          audit('alert-close', b.getAttribute('data-close'));
        });
      });
    });
  }

  /* ===== 2. Раунды (§6.2): пауза/продолжение, авто-закрытие ===== */
  function tabRounds(el) {
    window.DB.on('rounds', function (rounds) {
      var rows = Object.entries(rounds || {}).sort(function (a, b) { return (b[1].startTime || b[1].createdAt || 0) - (a[1].startTime || a[1].createdAt || 0); });
      el.innerHTML = '<div class="card"><div class="btnrow"><button class="btn btn--accent" id="autoClose">⏹ Авто-закрытие live-раундов (старше 8ч)</button></div></div>' +
        rows.map(function (r) {
          var rd = r[1];
          var pl = Object.entries(rd.players || {});
          var ageH = rd.startTime ? Math.round((Date.now() - rd.startTime) / 36e5) : 0;
          return '<div class="card">' +
            '<div class="card__head"><span class="card__title">' + pl.map(function (p) { return esc(p[1].name || ''); }).join(' · ') + '</span>' +
            '<span class="badge">' + rd.status + (rd.paused ? ' + пауза' : '') + '</span></div>' +
            '<small style="color:var(--muted)">' + fm(rd.startTime || rd.createdAt) + ' · ' + t('format.' + (rd.format || 'stroke')) + ' · ' + ageH + 'ч назад</small>' +
            '<div class="btnrow">' +
            (rd.status === 'active' ?
              '<button class="btn btn--ghost" data-pause="' + r[0] + '" data-p="' + (rd.paused ? '0' : '1') + '">' + (rd.paused ? '▶ Снять паузу' : '⏸ Пауза') + '</button>' +
              '<button class="btn btn--ghost" data-finish="' + r[0] + '">⏹ Завершить</button>' : '') +
            '<a class="btn btn--ghost" href="leaderboard.html">Открыть доску</a>' +
            '</div></div>';
        }).join('') || '<div class="card">Раундов нет.</div>';
      el.querySelectorAll('[data-pause]').forEach(function (b) {
        b.addEventListener('click', function () {
          var rid = b.getAttribute('data-pause'), p = b.getAttribute('data-p') === '1';
          window.DB.update('rounds/' + rid, p ? { paused: true, pauseReason: 'Админ-пауза' } : { paused: null, pauseReason: null });
          audit(p ? 'round-pause' : 'round-resume', rid);
        });
      });
      el.querySelectorAll('[data-finish]').forEach(function (b) {
        b.addEventListener('click', function () {
          window.DB.update('rounds/' + b.getAttribute('data-finish'), { status: 'completed', endTime: Date.now() });
          audit('round-finish', b.getAttribute('data-finish'));
        });
      });
      el.querySelector('#autoClose').addEventListener('click', function () {
        var n = 0;
        rows.forEach(function (r) {
          var rd = r[1];
          if (rd.status === 'active' && rd.startTime && (Date.now() - rd.startTime) > 8 * 36e5) {
            window.DB.update('rounds/' + r[0], { status: 'completed', endTime: rd.startTime + 8 * 36e5, autoClosed: true });
            n++;
          }
        });
        audit('round-autoclose', n + ' шт');
        window.Util.toast('Авто-закрыто: ' + n);
      });
    });
  }

  /* ===== 3. Редактор счёта (§6.3) ===== */
  function tabScorer(el) {
    window.DB.on('rounds', function (rounds) {
      var ids = Object.keys(rounds || {});
      el.innerHTML = historyStatedScorer(ids, rounds || {});
      wireScorer(el, rounds || {});
    });
    function historyStatedScorer(ids, rounds) {
      return '<div class="card"><div class="row">' +
        '<label class="field"><span>Раунд</span><select id="s-round">' + ids.map(function (id) { var r = rounds[id]; var names = Object.values(r.players || {}).map(function (p) { return p.name; }).join(','); return '<option value="' + id + '">' + esc(names.slice(0, 40)) + ' · ' + fm(r.startTime || r.createdAt).slice(0, 10) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Игрок</span><select id="s-player"></select></label>' +
        '</div><div class="tablewrap"><table class="tbl" id="s-grid"></table></div>' +
        '<div class="btnrow"><button class="btn btn--accent" id="s-save">Сохранить изменения</button></div></div>';
    }
    function wireScorer(el2, rounds) {
      var rs = el2.querySelector('#s-round'), ps = el2.querySelector('#s-player');
      function refPlayers() {
        var r = rounds[rs.value];
        ps.innerHTML = Object.entries((r && r.players) || {}).map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1].name || p[0]) + '</option>'; }).join('');
        refGrid();
      }
      function refGrid() {
        var r = rounds[rs.value]; var p = r && r.players[ps.value];
        var cells = '';
        for (var n = 1; n <= 18; n++) {
          var v = p && p.scores && p.scores[String(n)];
          cells += '<td><input type="number" min="0" max="15" data-h="' + n + '" value="' + (v == null ? '' : v) + '" style="width:52px;text-align:center;"></td>';
        }
        el2.querySelector('#s-grid').innerHTML = '<thead><tr>' + Array.from({ length: 18 }, function (_, i) { return '<th>' + (i + 1) + '</th>'; }).join('') + '</tr></thead><tbody><tr>' + cells + '</tr></tbody>';
      }
      rs.addEventListener('change', refPlayers); ps.addEventListener('change', refGrid);
      el2.querySelector('#s-save').addEventListener('click', function () {
        var rid = rs.value, pid = ps.value;
        var upd = {};
        el2.querySelectorAll('[data-h]').forEach(function (inp) {
          var h = inp.getAttribute('data-h');
          var v = inp.value === '' ? null : Math.max(0, Math.min(15, Number(inp.value)));
          upd['rounds/' + rid + '/players/' + pid + '/scores/' + h] = v;
        });
        Object.keys(upd).forEach(function (path) { window.DB.set(path, upd[path]); });
        audit('score-edit', rid + '/' + pid);
        window.Util.toast('Счёт обновлён');
      });
      refPlayers();
    }
  }

  /* ===== 4. Pace-контроль (§6.4) ===== */
  function tabPace(el) {
    function draw(rounds) {
      var rows = [];
      Object.entries(rounds || {}).forEach(function (r) {
        var rd = r[1]; if (rd.status !== 'active' || rd.paused) return;
        Object.entries(rd.players || {}).forEach(function (pv) {
          var p = pv[1];
          var order = Object.keys(p.scores || {}).filter(function (k) { return p.scores[k] != null && p.scores[k] !== 0; }).map(Number);
          if (!order.length || !rd.startTime) return;
          var pc = window.WHS.pace(Date.now(), rd.startTime, Math.min.apply(null, order), order, C.course.timings);
          rows.push({ name: p.name, hole: Math.max.apply(null, order), diff: pc.diffMin, pct: pc.pct, status: pc.status });
        });
      });
      rows.sort(function (a, b) { return b.diff - a.diff; });
      el.innerHTML = '<div class="card"><div class="tablewrap"><table class="tbl"><thead><tr><th>Группа/Игрок</th><th>Лунка</th><th>Δ мин</th><th>Статус</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) {
          return '<tr><td style="text-align:left;">' + esc(r.name) + '</td><td>' + r.hole + '</td><td>' + (r.diff > 0 ? '+' + r.diff : r.diff) + '</td>' +
            '<td><span class="badge ' + (r.status === 'behind' ? 'badge--danger' : r.status === 'ahead' ? 'badge--ok' : '') + '">' + r.status + '</span></td></tr>';
        }).join('') : '<tr><td colspan="4">Активных раундов с pace нет</td></tr>') +
        '</tbody></table></div></div>' +
        '<small style="color:var(--muted)">Обновление — каждые 30 секунд. Отставание > 15% от плана = behind.</small>';
    }
    window.DB.on('rounds', draw);
    if (window.__paceTimer) clearInterval(window.__paceTimer);
    window.__paceTimer = setInterval(function () { if (cur === 'pace') window.DB.get('rounds').then(draw); }, 30000);
  }

  /* ===== 5. Мастер турнира (§6.5): 10 шагов, черновик автосейв 20с, шаблоны ===== */
  var WIZ_STEPS = ['Название/дата', 'Формат', 'Дивизионы', 'ТИ', 'Состав (импорт)', 'Флеты', 'Cut/тай-брейк', 'Точная HCP-проверка', 'Анонс', 'Публикация'];
  function tabWizard(el) {
    var d = window.TOUR.draftGet() || { step: 0, data: {} };
    var dd = d.data;
    function stepbar(n) {
      return '<div class="steps-bar">' + WIZ_STEPS.map(function (_, i) { return '<span class="' + (i <= n ? 'on' : '') + '"></span>'; }).join('') + '</div><small style="color:var(--muted)">Шаг ' + (n + 1) + ' из 10: ' + WIZ_STEPS[n] + '</small>';
    }
    function save() { window.TOUR.draftSet({ step: d.step, data: dd }); }
    if (!window.__wizTimer) window.__wizTimer = setInterval(save, 20000);

    var body = '';
    var s = d.step;
    if (s === 0) body =
      '<label class="field"><span>Название</span><input id="w-name" type="text" value="' + esc(dd.name || '') + '"></label>' +
      '<label class="field"><span>Дата</span><input id="w-date" type="date" value="' + esc(dd.date || '') + '"></label>' +
      '<div class="btnrow"><button class="btn btn--ghost" data-tpl="club">Шаблон: Клубный чемпионат</button><button class="btn btn--ghost" data-tpl="open">Шаблон: Открытый тур дня</button></div>';
    if (s === 1) body = '<div class="btnrow">' + ['stroke', 'stableford', 'match', 'scramble', 'bestball', 'skins'].map(function (f) {
      return '<button class="chip' + (dd.format === f ? ' is-on' : '') + '" data-f="' + f + '">' + t('format.' + f) + '</button>';
    }).join('') + '</div>';
    if (s === 2) body = '<div class="btnrow">' + ['all', 'men', 'women', 'both'].map(function (dv) {
      return '<button class="chip' + (dd.divisions === dv ? ' is-on' : '') + '" data-dv="' + dv + '">' + dv + '</button>';
    }).join('') + '</div><small style="color:var(--muted)">both — параллельные зачёты M/W</small>';
    if (s === 3) body = '<div class="btnrow">' + ['bk', 'bl', 'wh', 'rd'].map(function (t2) {
      return '<button class="chip' + (dd.tee === t2 ? ' is-on' : '') + '" data-t="' + t2 + '">' + t2.toUpperCase() + '</button>';
    }).join('') + '</div>';
    if (s === 4) body =
      '<p style="font-size:13px;">CSV со столбцами: Имя, HCP, Пол, ТИ. До 500 строк. Предпросмотр + дедупликация ниже.</p>' +
      '<textarea id="w-csv" rows="10" style="width:100%;" placeholder="Имя;HCP;Пол;ТИ&#10;Петров Иван;12.4;М;bl">' + esc(dd.csv || '') + '</textarea>' +
      '<button class="btn" id="w-preview">Предпросмотр</button><div id="w-prevTbl"></div>';
    if (s === 5) body = '<button class="btn" id="w-flights">Сгенерировать флеты (по индексу)</button><div id="w-flOut"></div>';
    if (s === 6) body =
      '<div class="row"><label class="field"><span>Cut</span><select id="w-cut"><option value="none">Без</option><option value="top"' + (dd.cutK === 'top' ? ' selected' : '') + '>Топ-N</option><option value="score"' + (dd.cutK === 'score' ? ' selected' : '') + '≤ ±par X</option><option value="pct"' + (dd.cutK === 'pct' ? ' selected' : '') + '% поля</option></select></label>' +
      '<label class="field"><span>Значение</span><input id="w-cutv" type="number" value="' + (dd.cutV || 30) + '"></label>' +
      '<label class="field"><span>Тай-брейк</span><select id="w-tb"><option value="countback"' + (dd.tb !== 'none' ? ' selected' : '') + '>Countback</option><option value="none">Нет (T)</option></select></label></div>';
    if (s === 7) body = '<p>Проверьте полевые HCP перед стартом:</p><div id="w-hcpTbl"></div><button class="btn" id="w-hcpCalc">Пересчитать по ТИ и полу</button>';
    if (s === 8) body =
      '<label class="field"><span>Анонс в ленту</span><input id="w-ann" type="text" value="' + esc(dd.announce || '') + '" placeholder="Кубок Пестово 19.09 — стартовый список опубликован!"></label>';
    if (s === 9) body = '<div id="w-summary"></div><div class="btnrow"><button class="btn btn--accent btn--big" id="w-publish">🚀 Публикация турнира</button></div>';

    el.innerHTML = '<div class="card">' + stepbar(s) + '<div style="margin-top:14px;" id="w-body">' + body + '</div>' +
      '<div class="btnrow"><button class="btn btn--ghost" ' + (s === 0 ? 'disabled' : '') + ' id="w-prev">← Назад</button>' +
      '<button class="btn" id="w-next" ' + (s === 9 ? 'disabled' : '') + '>Дальше →</button>' +
      '<button class="btn btn--ghost" id="w-reset">Сброс мастера</button></div></div>';

    wireWizard(el, d, dd, save);
    function nav(dir) {
      d.step = Math.max(0, Math.min(9, d.step + dir));
      save(); delete window.__wizTimer; tabWizard(el);
    }
    PANE.querySelector('#w-prev').addEventListener('click', function () { save(); nav(-1); });
    PANE.querySelector('#w-next').addEventListener('click', function () { save(); nav(1); });
    PANE.querySelector('#w-reset').addEventListener('click', function () { window.TOUR.draftSet(null); delete window.__wizTimer; tabWizard(el); });
  }
  function wireWizard(el, d, dd, save) {
    if (dd.format == null) dd.format = 'stroke';
    // шаг 0
    bindVal('#w-name', function (v) { dd.name = v; }); bindVal('#w-date', function (v) { dd.date = v; });
    el.querySelectorAll('[data-tpl]').forEach(function (b) {
      b.addEventListener('click', function () {
        var tpl = b.getAttribute('data-tpl');
        dd.name = tpl === 'club' ? 'Чемпионат клуба «Пестово» ' + new Date().getFullYear() : 'Открытый тур дня «Пестово»';
        dd.format = tpl === 'club' ? 'stroke' : 'stableford'; dd.divisions = 'both'; dd.tee = 'bl'; dd.tb = 'countback';
        save(); window.Util.toast('Шаблон применён');
      });
    });
    // шаг 1-3
    el.querySelectorAll('[data-f]').forEach(function (b) { b.addEventListener('click', function () { dd.format = b.getAttribute('data-f'); save(); tabWizard(el); }); });
    el.querySelectorAll('[data-dv]').forEach(function (b) { b.addEventListener('click', function () { dd.divisions = b.getAttribute('data-dv'); save(); tabWizard(el); }); });
    el.querySelectorAll('[data-t]').forEach(function (b) {
      if (el.querySelector('#w-csv')) return; // шаг 4 тоже имеет data-t? нет
      b.addEventListener('click', function () { dd.tee = b.getAttribute('data-t'); save(); tabWizard(el); });
    });
    // шаг 4: импорт
    bindVal('#w-csv', function (v) { dd.csv = v; });
    var pvBtn = el.querySelector('#w-preview');
    if (pvBtn) pvBtn.addEventListener('click', function () {
      var r = window.TOUR.parseCsv(dd.csv || '');
      var seen = {}, out = [];
      r.rows.slice(0, 500).forEach(function (row) {
        var name = row['Имя'] || row['Name'] || row[Object.keys(row)[0]];
        var hcp = parseFloat((row['HCP'] || row['hcp'] || '').replace(',', '.'));
        var gender = (row['Пол'] || row['Gender'] || '').trim().toLowerCase().startsWith('ж') || (row['Пол'] || '').trim().toLowerCase().startsWith('w') ? 'women' : 'men';
        var tee = (row['ТИ'] || row['Tee'] || dd.tee || 'bl').trim().toLowerCase() || 'bl';
        if (!name) return;
        var dup = !!seen[name.toLowerCase()]; seen[name.toLowerCase()] = true;
        out.push('<tr class="impRow' + (dup ? ' duplicate' : '') + '"><td>' + esc(name) + '</td><td>' + (isNaN(hcp) ? '—' : hcp) + '</td><td>' + gender + '</td><td>' + esc(tee) + '</td><td>' + (dup ? 'дубликат!' : 'ok') + '</td></tr>');
      });
      el.querySelector('#w-prevTbl').innerHTML = '<div class="tablewrap"><table class="tbl"><thead><tr><th>Имя</th><th>HCP</th><th>Пол</th><th>ТИ</th><th>Статус</th></tr></thead><tbody>' + out.join('') + '</tbody></table></div>';
      dd.roster = r.rows;
      save();
    });
    // шаг 5: флеты
    var flBtn = el.querySelector('#w-flights');
    if (flBtn) flBtn.addEventListener('click', function () {
      var players = importRoster(dd);
      var flights = window.TOUR.pairings(players, { by: 'index', size: 4 });
      el.querySelector('#w-flOut').innerHTML = flights.map(function (f, i) {
        return '<div class="card"><b>Флет ' + String.fromCharCode(65 + i) + '</b>: ' + f.map(function (p) { return esc(p.name); }).join(' · ') + '</div>';
      }).join('');
      dd.flightsCount = flights.length;
      save();
    });
    // шаг 6
    bindVal('#w-cut', function (v) { dd.cutK = v; }); bindVal('#w-cutv', function (v) { dd.cutV = Number(v); }); bindVal('#w-tb', function (v) { dd.tb = v; });
    // шаг 7
    var hcpBtn = el.querySelector('#w-hcpCalc');
    if (hcpBtn) hcpBtn.addEventListener('click', function () {
      var players = importRoster(dd);
      el.querySelector('#w-hcpTbl').innerHTML = '<div class="tablewrap"><table class="tbl"><thead><tr><th>Игрок</th><th>HI</th><th>Полевой</th></tr></thead><tbody>' +
        players.map(function (p) {
          var f = p.handicap == null ? null : window.WHS.fieldHcp(p.handicap, p.tee, p.gender, C.course.ratings, C.course.par);
          return '<tr><td style="text-align:left;">' + esc(p.name) + '</td><td>' + (p.handicap != null ? p.handicap : '—') + '</td><td>' + (f != null ? f : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    });
    // шаг 8
    bindVal('#w-ann', function (v) { dd.announce = v; });
    // шаг 9
    var sum = el.querySelector('#w-summary');
    if (sum) {
      var players = importRoster(dd);
      sum.innerHTML = '<dl class="kv">' +
        '<dt>Название</dt><dd>' + esc(dd.name || '—') + '</dd>' +
        '<dt>Дата</dt><dd>' + esc(dd.date || '—') + '</dd>' +
        '<dt>Формат</dt><dd>' + esc(dd.format || 'stroke') + '</dd>' +
        '<dt>Дивизионы</dt><dd>' + esc(dd.divisions || 'all') + '</dd>' +
        '<dt>Состав</dt><dd>' + players.length + ' игроков (' + (dd.flightsCount || '—') + ' флетов)</dd>' +
        '<dt>Cut</dt><dd>' + esc(dd.cutK || 'none') + '</dd>' +
        '<dt>Тай-брейк</dt><dd>' + esc(dd.tb || 'countback') + '</dd></dl>';
    }
    var pubBtn = el.querySelector('#w-publish');
    if (pubBtn) pubBtn.addEventListener('click', function () {
      var players = importRoster(dd);
      var id = 't' + window.Util.uid();
      var rec = {
        name: dd.name || 'Турнир', date: dd.date || '', format: dd.format || 'stroke',
        divisions: dd.divisions || 'all', tee: dd.tee || 'bl', tiebreak: dd.tb || 'countback',
        cut: dd.cutK && dd.cutK !== 'none' ? { kind: dd.cutK, n: dd.cutV, x: dd.cutV, p: dd.cutV } : null,
        status: 'live', createdAt: Date.now(), players: {}
      };
      var letters = 'ABCDEFGH';
      var flights = window.TOUR.pairings(players, { by: 'index', size: 4 });
      flights.forEach(function (f, fi) {
        f.forEach(function (p) { rec.players[p.pid] = { name: p.name, gender: p.gender, tee: p.tee, handicap: p.handicap, fieldHcp: p.fieldHcp, flight: letters[fi] || 'A', scores: {} }; });
      });
      window.DB.set('tournaments/' + id, rec).then(function () {
        if (dd.announce) return window.DB.push('broadcasts', { title: rec.name, body: dd.announce, audience: 'all', time: Date.now() });
      }).then(function () {
        window.TOUR.draftSet(null);
        audit('tour-publish', id + ' · ' + rec.name + ' · ' + players.length + ' уч.');
        window.Util.toast('Турнир опубликован: ' + rec.name);
        location = 'tournaments.html?tournament=' + id;
      });
    });
  }
  function bindVal(sel, fn) { var n = PANE.querySelector(sel); if (n) n.addEventListener('input', function () { fn(n.value); }); }
  function importRoster(dd) {
    var out = [];
    (dd.roster || []).slice(0, 500).forEach(function (row) {
      var name = (row['Имя'] || row['Name'] || row[Object.keys(row)[0]] || '').trim();
      if (!name) return;
      var hcp = parseFloat((row['HCP'] || row['hcp'] || '').replace(',', '.'));
      var genderRaw = (row['Пол'] || row['Gender'] || '').trim().toLowerCase();
      var gender = genderRaw.startsWith('ж') || genderRaw.startsWith('w') || genderRaw.startsWith('f') ? 'women' : 'men';
      var tee = ((row['ТИ'] || row['Tee'] || dd.tee || 'bl') + '').trim().toLowerCase() || 'bl';
      out.push({
        pid: 'p' + window.Util.uid().slice(0, 6), name: name, gender: gender, tee: tee,
        handicap: isNaN(hcp) ? null : hcp,
        fieldHcp: isNaN(hcp) ? null : window.WHS.fieldHcp(hcp, tee, gender, C.course.ratings, C.course.par)
      });
    });
    return out;
  }

  /* ===== 6. Управление турнирами (§6.5) ===== */
  function tabTourMan(el) {
    window.DB.on('tournaments', function (trs) {
      var items = Object.entries(trs || {});
      el.innerHTML = (items.length ? items.map(function (t2) {
        var tr = t2[1];
        return '<div class="card"><div class="card__head"><span class="card__title">' + esc(tr.name || t2[0]) + '</span><span class="badge">' + (tr.status || '—') + '</span></div>' +
          '<small style="color:var(--muted)">' + (tr.date || '') + ' · ' + Object.keys(tr.players || {}).length + ' участников · cut ' + (tr.cut ? tr.cut.kind : 'нет') + '</small>' +
          '<div class="btnrow">' +
          '<button class="btn btn--ghost" data-end="' + t2[0] + '">⏹ Завершить (счёт финальный)</button>' +
          '<a class="btn btn--ghost" href="tournaments.html?tournament=' + t2[0] + '">Открыть табло</a>' +
          '<button class="btn btn--ghost" data-del="' + t2[0] + '">🗑 Удалить</button>' +
          '</div></div>';
      }).join('') : '<div class="card">Создайте турнир через вкладку «Мастер турнира».</div>') +
      '<div class="card"><button class="btn" id="goWizard">🧙 Новый турнир (мастер)</button></div>';
      el.querySelectorAll('[data-end]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Завершить турнир? Табло зафиксируется.')) return;
          window.DB.update('tournaments/' + b.getAttribute('data-end'), { status: 'done', endedAt: Date.now() });
          audit('tour-end', b.getAttribute('data-end'));
        });
      });
      el.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Удалить турнир безвозвратно?')) return;
          window.DB.remove('tournaments/' + b.getAttribute('data-del'));
          audit('tour-delete', b.getAttribute('data-del'));
        });
      });
      el.querySelector('#goWizard').addEventListener('click', function () {
        cur = 'wizard'; history.replaceState(null, '', 'admin.html?tab=wizard'); initTabsRe(); tabWizard(PANE);
      });
    });
    function initTabsRe() {
      document.querySelectorAll('#admTabs .chip').forEach(function (x) { x.classList.toggle('is-on', x.getAttribute('data-t') === 'wizard'); });
    }
  }

  /* ===== 7. Поле (§6: тайминги/метражи читаем из config; правки — localStorage override) ===== */
  function tabCourse(el) {
    var over = {}; try { over = JSON.parse(localStorage.getItem('pc.courseOverride') || '{}'); } catch (e) {}
    el.innerHTML = '<div class="card"><p style="font-size:13px;color:var(--muted)">Карточка поля живёт в <code>js/config.js</code> (seed §4.1). Здесь — runtime-override таймингов локально.</p>' +
      '<div class="tablewrap"><table class="tbl"><thead><tr><th>#</th><th>P</th><th>SI</th><th>Pace, мин</th></tr></thead><tbody>' +
      C.course.holes.map(function (h, i) {
        var n = i + 1;
        return '<tr><td>' + n + '</td><td>' + h.p + '</td><td>' + h.hcp + '</td>' +
          '<td><input type="number" data-t="' + n + '" value="' + (over[n] || C.course.timings[n]) + '" style="width:70px;text-align:center;"></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="btnrow"><button class="btn btn--accent" id="c-save">Сохранить override</button><button class="btn btn--ghost" id="c-reset">Сбросить</button></div></div>';
    el.querySelector('#c-save').addEventListener('click', function () {
      var out = {};
      el.querySelectorAll('[data-t]').forEach(function (i2) { out[i2.getAttribute('data-t')] = Number(i2.value) || C.course.timings[i2.getAttribute('data-t')]; });
      try { localStorage.setItem('pc.courseOverride', JSON.stringify(out)); } catch (e) {}
      window.DB.set('settings/course/timingsOverride', out).then(function () {
        audit('course-timings-override', JSON.stringify(out));
        window.Util.toast('Тайминги обновлены (БД: settings/course)');
      });
    });
    el.querySelector('#c-reset').addEventListener('click', function () {
      localStorage.removeItem('pc.courseOverride');
      window.DB.set('settings/course/timingsOverride', null).then(function () {
        window.Util.toast('Сброшено'); tabCourse(el);
      });
    });
  }

  /* ===== 8. Протоколы (§6.7) ===== */
  function tabProtocol(el) {
    window.DB.on('protocols', function (prs) {
      var items = Object.entries(prs || {});
      el.innerHTML = items.length ? items.map(function (p) {
        var pr = p[1];
        return '<div class="card"><div class="card__head"><span class="card__title">' + esc(pr.name || p[0]) + '</span><span class="badge">v' + pr.version + ' · ' + pr.hash + '</span></div>' +
          '<small style="color:var(--muted)">' + (pr.date || '') + ' · ' + fm(pr.createdAt) + ' · защищён от перезаписи</small>' +
          '<div class="btnrow"><button class="btn btn--ghost" data-try="' + p[0] + '">Проверить guard (повторная публикация)</button></div>' +
          '<div id="pg-' + p[0] + '"></div></div>';
      }).join('') : '<div class="card">Протоколов нет. Публикация — со страницы турнира.</div>';
      el.querySelectorAll('[data-try]').forEach(function (b) {
        b.addEventListener('click', function () {
          window.DB.get('protocols/' + b.getAttribute('data-try')).then(function (old) {
            var fake = Object.assign({}, old);
            var d = window.TOUR.protocolDiff(old, fake);
            document.getElementById('pg-' + b.getAttribute('data-try')).innerHTML =
              '<small style="color:' + (d.allowed ? 'var(--good)' : 'var(--danger,#c33)') + ';">guard: ' + d.reason + ' → ' + (d.allowed ? 'разрешено' : 'ОТКЛОНЕНО') + '</small>';
          });
        });
      });
    });
  }

  /* ===== 9. Анонсы (§6.8): аудитории + TG/VK заглушки ===== */
  function tabAnnounce(el) {
    el.innerHTML = '<div class="card">' +
      '<label class="field"><span>Заголовок</span><input id="a-title" type="text"></label>' +
      '<label class="field"><span>Текст</span><textarea id="a-body" rows="3" style="width:100%;"></textarea></label>' +
      '<div class="btnrow" id="a-aud">' + ['all', 'players', 'spectators', 'admin'].map(function (a) { return '<button class="chip" data-a="' + a + '">' + a + '</button>'; }).join('') + '</div>' +
      '<div class="btnrow"><button class="btn btn--accent" id="a-send">📢 Отправить (лента + push)</button>' +
      '<button class="btn btn--ghost" id="a-tg">TG ↗</button><button class="btn btn--ghost" id="a-vk">VK ↗</button></div>' +
      '<small style="color:var(--muted)">TG/VK — внешние интеграции; здесь готовим только текст/ссылку (этап 8).</small></div>' +
      '<div class="card" id="a-recent"><h3>Последние</h3><div id="a-rec"></div></div>';
    var aud = 'all';
    el.querySelectorAll('[data-a]').forEach(function (b) {
      b.addEventListener('click', function () {
        aud = b.getAttribute('data-a');
        el.querySelectorAll('[data-a]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      });
    });
    el.querySelector('[data-a="all"]').classList.add('is-on');
    el.querySelector('#a-send').addEventListener('click', function () {
      var title = el.querySelector('#a-title').value.trim();
      var body = el.querySelector('#a-body').value.trim();
      if (!title) return window.Util.toast('Заголовок обязателен', 'err');
      window.DB.push('broadcasts', { title: title, body: body, audience: aud, time: Date.now() }).then(function () {
        audit('broadcast', title + ' → ' + aud);
        el.querySelector('#a-title').value = ''; el.querySelector('#a-body').value = '';
        window.Util.toast('Отправлено');
      });
    });
    ['tg', 'vk'].forEach(function (n) {
      el.querySelector('#a-' + n).addEventListener('click', function () {
        var txt = (el.querySelector('#a-title').value + '\n' + el.querySelector('#a-body').value).trim();
        navigator.clipboard && navigator.clipboard.writeText(txt).then(function () { window.Util.toast('Текст скопирован для ' + n.toUpperCase()); });
      });
    });
    window.DB.on('broadcasts', function (b) {
      var items = Object.entries(b || {}).sort(function (x, y) { return (y[1].time || 0) - (x[1].time || 0); }).slice(0, 5);
      var host = document.getElementById('a-rec'); if (!host) return;
      host.innerHTML = items.map(function (i) { return '<div style="border-bottom:1px solid var(--border);padding:4px 0;"><b>' + esc(i[1].title) + '</b> <small style="color:var(--muted)">' + fm(i[1].time) + ' → ' + (i[1].audience || 'all') + '</small></div>'; }).join('') || '—';
    });
  }

  /* ===== 10. Игроки/роли/дедуп (§6.9) ===== */
  function tabPlayers(el) {
    window.DB.on('users', function (users) {
      var list = Object.entries(users || {}).sort(function (a, b) { return String(a[1].name).localeCompare(String(b[1].name), 'ru'); });
      el.innerHTML = '<div class="card"><div class="btnrow"><button class="btn btn--accent" id="p-add">+ Игрок</button></div>' +
        '<div class="tablewrap"><table class="tbl"><thead><tr><th>ФИО</th><th>HI</th><th>Пол</th><th>ТИ</th><th>Роль</th><th>Приватность</th><th></th></tr></thead><tbody>' +
        list.map(function (u) {
          var p = u[1];
          return '<tr><td style="text-align:left;">' + esc(p.name) + '</td><td>' + (p.handicap != null ? p.handicap : '—') + '</td><td>' + (p.gender === 'women' ? 'Ж' : 'М') + '</td><td>' + (p.defaultTee || 'wh').toUpperCase() + '</td><td>' + esc(p.role || 'player') + '</td><td>' + esc((p.privacy && p.privacy.mode) || '(клуб)') + '</td>' +
            '<td><button class="btn btn--ghost" data-e="' + u[0] + '">✎</button><button class="btn btn--ghost" data-d="' + u[0] + '">🗑</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
      el.querySelector('#p-add').addEventListener('click', function () { editUser(el, null); });
      el.querySelectorAll('[data-e]').forEach(function (b) { b.addEventListener('click', function () { editUser(el, b.getAttribute('data-e')); }); });
      el.querySelectorAll('[data-d]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Удалить игрока?')) return;
          window.DB.remove('users/' + b.getAttribute('data-d'));
          audit('user-delete', b.getAttribute('data-d'));
        });
      });
    });
  }
  function editUser(el, uid) {
    window.DB.get('users/' + (uid || '')).then(function (p) {
      p = p || { role: 'player', gender: 'men', defaultTee: 'wh' };
      var m = window.Util.modal(
        '<h3>' + (uid ? 'Правка игрока' : 'Новый игрок') + '</h3>' +
        '<label class="field"><span>ФИО полностью</span><input id="u-name" type="text" value="' + esc(p.name || '') + '"></label>' +
        '<div class="row">' +
        '<label class="field"><span>HI</span><input id="u-hcp" type="number" step="0.1" value="' + (p.handicap != null ? p.handicap : '') + '"></label>' +
        '<label class="field"><span>Пол</span><select id="u-g"><option value="men">Мужской</option><option value="women"' + (p.gender === 'women' ? ' selected' : '') + '>Женский</option></select></label>' +
        '<label class="field"><span>ТИ</span><select id="u-t">' + ['bk', 'bl', 'wh', 'rd'].map(function (t2) { return '<option value="' + t2 + '"' + (p.defaultTee === t2 ? ' selected' : '') + '>' + t2.toUpperCase() + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Роль</span><select id="u-r"><option value="player">player</option><option value="admin"' + (p.role === 'admin' ? ' selected' : '') + '>admin</option><option value="referee"' + (p.role === 'referee' ? ' selected' : '') + '>referee</option></select></label>' +
        '</div><div class="btnrow"><button class="btn btn--accent" id="u-save">Сохранить</button><button class="btn btn--ghost" data-close>Закрыть</button></div>');
      m.el.querySelector('#u-save').addEventListener('click', function () {
        var rec = {
          name: m.el.querySelector('#u-name').value.trim(),
          handicap: m.el.querySelector('#u-hcp').value === '' ? null : Number(m.el.querySelector('#u-hcp').value.replace(',', '.')),
          gender: m.el.querySelector('#u-g').value,
          defaultTee: m.el.querySelector('#u-t').value,
          role: m.el.querySelector('#u-r').value
        };
        if (rec.name.length < 3) return window.Util.toast('ФИО: минимум 3 символа', 'err');
        var target = uid || ('u' + window.Util.uid().slice(0, 6));
        window.DB.set('users/' + target, Object.assign({}, p, rec)).then(function () {
          audit(uid ? 'user-edit' : 'user-add', target + ' · ' + rec.name);
          m.close();
        });
      });
    });
  }

  /* ===== 11. Импорт/Экспорт (§6.10) ===== */
  function tabImexp(el) {
    el.innerHTML = '<div class="card"><h3>Экспорт</h3><div class="btnrow">' +
      '<button class="btn" data-x="rounds">Раунды JSON</button><button class="btn" data-x="users">Игроки JSON</button>' +
      '<button class="btn" data-x="tournaments">Турниры JSON</button><button class="btn" data-x="audit">Аудит JSON</button>' +
      '<button class="btn" id="x-stand">Ведомости CSV (завершённые раунды)</button></div>' +
      '<h3 style="margin-top:14px;">Импорт</h3>' +
      '<label class="field"><span>Игроки CSV (Имя;HI;Пол;ТИ)</span><textarea id="i-csv" rows="6" style="width:100%;"></textarea></label>' +
      '<button class="btn btn--accent" id="i-users">Импорт игроков</button></div>';
    el.querySelectorAll('[data-x]').forEach(function (b) {
      b.addEventListener('click', function () {
        window.DB.get(b.getAttribute('data-x')).then(function (d) {
          download(b.getAttribute('data-x') + '-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(d, null, 2), 'application/json');
          audit('export', b.getAttribute('data-x'));
        });
      });
    });
    el.querySelector('#x-stand').addEventListener('click', function () {
      window.DB.get('rounds').then(function (rounds) {
        var lines = ['round,player,tee,gross,played,toPar,finished'];
        Object.entries(rounds || {}).forEach(function (r) {
          if (r[1].status !== 'completed') return;
          Object.entries(r[1].players || {}).forEach(function (pv) {
            var s = window.WHS.summarize(pv[1].scores || {}, C.course.holes, pv[1].fieldHcp);
            lines.push([r[0], '"' + (pv[1].name || '').replace(/"/g, '""') + '"', pv[1].tee || '', s.gross, s.played, s.toPar, new Date(r[1].endTime || 0).toISOString().slice(0, 10)].join(','));
          });
        });
        download('vedomosti.csv', lines.join('\n'), 'text/csv');
        audit('export', 'vedomosti');
      });
    });
    el.querySelector('#i-users').addEventListener('click', function () {
      var r = window.TOUR.parseCsv(el.querySelector('#i-csv').value || '');
      var n = 0;
      r.rows.forEach(function (row) {
        var name = (row['Имя'] || row['Name'] || '').trim(); if (!name) return;
        var hcp = parseFloat((row['HI'] || row['HCP'] || '').replace(',', '.'));
        var g = (row['Пол'] || '').toLowerCase();
        window.DB.set('users/u' + window.Util.uid().slice(0, 6), {
          name: name, handicap: isNaN(hcp) ? null : hcp,
          gender: g.startsWith('ж') ? 'women' : 'men',
          defaultTee: (row['ТИ'] || 'wh').toLowerCase() || 'wh', role: 'player'
        });
        n++;
      });
      audit('import-users', n + ' строк');
      window.Util.toast('Импортировано игроков: ' + n);
    });
    function download(name, text, mime) {
      var blob = new Blob([text], { type: mime + ';charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    }
  }

  /* ===== 12. RUSGOLF (§6.11): только через прокси {url} + скопы ================================================= */
  function tabRusgolf(el) {
    window.DB.on('settings/rusgolf', function (s) {
      s = s || {};
      el.innerHTML = '<div class="card">' +
        '<p style="font-size:13px;color:var(--muted)">Клуб НЕ ходит в rusgolf.ru напрямую: все запросы идут через прокси-подстабновку вида <code>https://<proxy>/{url}</code>. Укажите URL прокси и скопы синхронизации.</p>' +
        '<label class="field"><span>URL прокси (шаблон с {url})</span><input id="r-proxy" type="text" value="' + esc(s.proxyTemplate || '') + '" placeholder="https://proxy.pestovo.example/rg/{url}"></label>' +
        '<div class="btnrow" id="r-scopes">' + ['roster', 'hcp', 'schedule', 'results'].map(function (sc2) {
          return '<button class="chip' + ((s.scopes || []).indexOf(sc2) >= 0 ? ' is-on' : '') + '" data-s="' + sc2 + '">' + sc2 + '</button>';
        }).join('') + '</div>' +
        '<label class="field"><span>Учётка (системная, не коммитим)</span><input id="r-auth" type="password" value="' + esc(s.auth || '') + '" placeholder="token (хранится в RTDB settings/rusgolf/auth)"></label>' +
        '<div class="btnrow"><button class="btn btn--accent" id="r-save">Сохранить</button><button class="btn" id="r-test">Тест прокси</button></div>' +
        '<div id="r-out" style="margin-top:10px;"></div></div>';
      var scopes = (s.scopes || []).slice();
      el.querySelectorAll('[data-s]').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-s');
          var i = scopes.indexOf(v); if (i >= 0) scopes.splice(i, 1); else scopes.push(v);
          b.classList.toggle('is-on');
        });
      });
      el.querySelector('#r-save').addEventListener('click', function () {
        window.DB.set('settings/rusgolf', { proxyTemplate: el.querySelector('#r-proxy').value.trim(), scopes: scopes, auth: el.querySelector('#r-auth').value.trim() || null });
        audit('rusgolf-settings', scopes.join(','));
        window.Util.toast('Настройки RUSGOLF сохранены');
      });
      el.querySelector('#r-test').addEventListener('click', function () {
        var tpl = el.querySelector('#r-proxy').value.trim();
        if (!tpl || tpl.indexOf('{url}') < 0) { el.querySelector('#r-out').innerHTML = '<small style="color:var(--danger,#c33)">Шаблон должен содержать {url}</small>'; return; }
        el.querySelector('#r-out').innerHTML = '<small>Шаблон валиден. Любой вызов rusgolf пойдёт через: ' + esc(tpl.replace('{url}', 'https://rusgolf.ru/…')) + '</small>';
      });
    });
  }

  /* ===== 13. Данные/Настройки + стереть (§6.12) ===== */
  function tabSettings(el) {
    var q = window.DB.queuedCount ? window.DB.queuedCount() : 0;
    el.innerHTML = '<div class="card"><dl class="kv">' +
      '<dt>Режим DB</dt><dd>' + window.DB.mode() + '</dd>' +
      '<dt>Офлайн-очередь</dt><dd>' + q.length + ' записей</dd>' +
      '<dt>Версия</dt><dd>' + esc((C.siteVersion || '') + '') + '</dd>' +
      '<dt>Узел</dt><dd>demo:' + (window.DB.mode() === 'demo' ? 'да' : 'нет') + '</dd></dl>' +
      '<div class="btnrow"><button class="btn" id="st-flush">↻ Принудительный flush очереди</button></div>' +
      '<h3 style="margin-top:14px;color:var(--danger,#c33)">Опасная зона</h3>' +
      '<p style="font-size:13px;">Очистка demo-хранилища (localStorage ' + ('pc-rtdb') + ') — игроки, раунды, турниры. Настройки PWA (язык, дизайн) останутся.</p>' +
      '<button class="btn" id="st-wipe" style="border-color:var(--danger,#c33);color:var(--danger,#c33);">🗑 Стереть ВСЕ данные</button></div>';
    el.querySelector('#st-flush').addEventListener('click', function () {
      (window.DB.flushQueue ? window.DB.flushQueue() : Promise.resolve()).then(function () {
        window.Util.toast('Очередь: ' + (window.DB.queuedCount ? window.DB.queuedCount() : 0));
        tabSettings(el);
      });
    });
    el.querySelector('#st-wipe').addEventListener('click', function () {
      if (!confirm('Стереть ВСЕ данные demo-режима? Действие необратимо.')) return;
      if (!confirm('Последний шанс. Точно удалить players/rounds/tournaments/alerts и пр.?')) return;
      Object.keys(localStorage).filter(function (k) { return k.indexOf('pc-rtdb') === 0 && k.indexOf('settings') < 0; }).forEach(function (k) { localStorage.removeItem(k); });
      audit('wipe', 'demo storage');
      window.Util.toast('Данные стёрты. Обновите страницу.');
      auditPushFinal();
    });
    function auditPushFinal() { /* аудит сам лежал в стёртой ветке — помечаем флаг */ }
  }

  /* ===== 14. Дизайн (§6.13) ===== */
  function tabDesign(el) {
    el.innerHTML = '<div class="card"><p>Настройка 6 шаблонов и микса per-блок — на странице превью:</p>' +
      '<div class="btnrow">' + Array.from({ length: 6 }, function (_, i) { return '<button class="chip" data-d="' + i + '">№' + i + '</button>'; }).join('') + '</div>' +
      '<div class="btnrow"><a class="btn btn--accent" href="design-preview.html">Открыть design-preview</a>' +
      '<a class="btn btn--ghost" href="index.html?dsp=0" target="_blank">Главная в Классике</a></div></div>' +
      '<iframe src="design-preview.html" style="width:100%;height:70vh;border:1px solid var(--border);border-radius:12px;background:#fff;"></iframe>';
    el.querySelectorAll('[data-d]').forEach(function (b) {
      b.addEventListener('click', function () {
        window.DB.get('settings/design').then(function (cur3) {
          cur3 = cur3 || { mode: 'single', global: 0, pages: {}, blocks: {} };
          cur3.global = Number(b.getAttribute('data-d'));
          window.DB.set('settings/design', cur3).then(function () {
            audit('design-global', cur3.global);
            window.Util.toast('Глобальный шаблон: №' + cur3.global);
          });
        });
      });
    });
  }

  /* ===== 15. Помощник (§6.14): диагностика + гид ===== */
  function tabHelper(el) {
    var q = window.DB.queuedCount ? window.DB.queuedCount() : 0;
    el.innerHTML = '<div class="card"><h3>Диагностика</h3>' +
      '<dl class="kv">' +
      '<dt>SW</dt><dd id="h-sw">…</dd>' +
      '<dt>DB</dt><dd>' + window.DB.mode() + '</dd>' +
      '<dt>Очередь</dt><dd>' + q.length + '</dd>' +
      '<dt>Отложенных round' +
      '</dt><dd>—</dd>' +
      '<dt>Cache Storage</dt><dd>' + ('caches' in window ? 'ok' : 'нет') + '</dd>' +
      '</dl>' +
      '<div class="btnrow"><button class="btn" id="h-precheck">Прогнать self-check</button><a class="btn btn--ghost" href="assistant.html">Открыть Помощника</a></div>' +
      '<pre id="h-log" style="max-height:220px;overflow:auto;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:12px;"></pre></div>';
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('./').then(function (r) {
        document.getElementById('h-sw').textContent = r ? 'active (scope ' + r.scope + ')' : 'не зарегистрирован';
      }).catch(function () { document.getElementById('h-sw').textContent = 'ошибка'; });
    } else document.getElementById('h-sw').textContent = 'нет поддержки';
    el.querySelector('#h-precheck').addEventListener('click', function () {
      var log = [];
      function step(name, p) { return Promise.resolve().then(p).then(function (m) { log.push('✓ ' + name + (m ? ' — ' + m : '')); refresh(); }).catch(function (e) { log.push('✗ ' + name + ': ' + (e && e.message || e)); refresh(); }); }
      function refresh() { document.getElementById('h-log').textContent = log.join('\n'); }
      step('config', function () { if (C.course.holes.length !== 18) throw new Error('holes'); return '18 лунок, par ' + C.course.par; });
      step('engine whs', function () { var f = window.WHS.fieldHcp(12.4, 'bl', 'men', C.course.ratings, C.course.par); return 'field(12.4/bl)=' + f; });
      step('engine tour', function () { return 'oom(1)=' + window.TOUR.oomPoints(1); });
      step('users seed', function () { return window.DB.get('users').then(function (u) { return Object.keys(u || {}).length + ' игроков'; }); });
      step('settings/design', function () { return window.DB.get('settings/design').then(function (d) { return JSON.stringify(d || 'default'); }); });
      step('localStorage', function () { localStorage.setItem('pc.t', '1'); localStorage.removeItem('pc.t'); });
      step('serviceWorker', function () { if (!('serviceWorker' in navigator)) throw new Error('unsupported'); });
    });
  }
})();
