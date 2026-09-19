/* Ввод счёта solo (§5.3): одна кнопка на лунку (≤5с), оптимистично, офлайн-очередь,
   pace-ассистент, пауза/продолжение, завершение, вызов судьи, kiosk-режим (?as=). */
(function () {
  'use strict';
  window.UI.mount('solo');
  var C = window.APP_CONFIG;
  var qs = new URLSearchParams(location.search);
  var roundId = qs.get('round');
  var playerId = qs.get('player');
  var kiosk = qs.get('as') || qs.get('kiosk');
  if (kiosk) {
    // kiosk-режим (§5.13): убрать навигацию/подвал
    document.addEventListener('DOMContentLoaded', function () {
      document.getElementById('app-header').style.display = 'none';
      var f = document.querySelector('.foot'); if (f) f.style.display = 'none';
    });
  }
  if (!roundId) { location.replace('setup-round.html'); return; }

  var round = null, pPlayer = null, hole = 1;
  var pad = document.getElementById('scorePad');
  var quickBox = document.getElementById('quickChips');
  var seqCache = null;

  window.DB.on('rounds/' + roundId, function (rd) {
    if (!rd) { window.Util.toast('Раунд не найден', 'err'); return; }
    round = rd;
    pPlayer = playerId && rd.players ? rd.players[playerId] : null;
    if (!pPlayer) playerId = Object.keys(rd.players || {})[0];
    pPlayer = rd.players[playerId];
    if (!seQ()) return;
    render();
  });

  function seQ() {
    if (!seqCache) {
      seqCache = holeSequence(round.startHole || 1, round.nHoles || 18, C.course.holesCount);
      hole = findCurrentHole();
    }
    return true;
  }
  function holeSequence(start, count, total) { var out = [], h = start; while (out.length < count) { out.push(h); h = (h % total) + 1; } return out; }
  function holeData(hn) { return C.course.holes[hn - 1]; }
  function findCurrentHole() {
    for (var i = 0; i < seqCache.length; i++) {
      var hn = seqCache[i];
      var v = pPlayer.scores && pPlayer.scores[String(hn)];
      if (v == null || v === 0) return hn;
    }
    return seqCache[seqCache.length - 1];
  }
  function inSeq(hn) { return seqCache.indexOf(hn) >= 0; }

  /* ------------ число кнопок ?? уведомление ------------ */
  function digitsFor(hole) {
    var par = holeData(hole).p;
    var from = Math.max(1, par - 3), to = par + 6;
    var out = []; for (var i = from; i <= to; i++) out.push(i);
    return out;
  }

  function render() {
    var holes = C.course.holes;
    var sum = window.WHS.summarize(Pscores(), holes, pPlayer.fieldHcp);
    var hd = holeData(hole);
    // шайба раунда
    document.getElementById('roundTitle').textContent = formatName(round.format) + ' · ' + t('round.status.active');
    document.getElementById('roundStatus').textContent = round.paused ? (t('round.paused') + (round.pauseReason ? ': ' + round.pauseReason : '')) : t('round.status.active');
    document.getElementById('roundMeta').innerHTML =
      stat(t('score.thru'), (sum.played || 0) + '/' + (round.nHoles || 18)) +
      stat(t('score.gross'), sum.gross || '—') +
      stat(t('score.toPar'), fmtTopar(sum.toPar)) +
      stat(t('score.stableford'), (round.format === 'stableford' || settingsStable()) ? sum.stableNet : (round.format === 'stableford' ? sum.stableNet : sum.stableGross));

    // голова лунки
    var tee = pPlayer.tee || round.tee;
    var dist = hd[tee] != null ? hd[tee] : '—';
    document.getElementById('holeNum').textContent = String(hole);
    document.getElementById('holeInfo').textContent = t('score.hole') + ' ' + hole;
    document.getElementById('holeMeta').textContent = 'P' + hd.p + ' · SI ' + hd.hcp + ' · ' + dist + ' м (' + teeLabel(tee) + ')';
    var cur = Pscores()[String(hole)];
    document.getElementById('cellScore').textContent = cur == null || cur === 0 ? '—' : String(cur);
    document.getElementById('cellName').textContent = cur != null && cur > 0 ? window.WHS.scoreName(cur - hd.p) : 'Par';

    // быстрые чипы (par-1, par, par+1)
    quickBox.innerHTML = '';
    [hd.p - 1, hd.p, hd.p + 1].forEach(function (v) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = String(v);
      ['birdie', 'par', 'bogey'].forEach(function () {});
      b.addEventListener('click', function () { applyScore(v); });
      quickBox.appendChild(b);
    });

    // кнопкпад
    pad.innerHTML = '';
    digitsFor(hole).forEach(function (d) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = String(d);
      if (cur === d) b.className = 'is-active';
      b.addEventListener('click', function () { applyScore(d); });
      pad.appendChild(b);
    });
    var bMore = document.createElement('button'); bMore.type = 'button'; bMore.className = 'ghost'; bMore.textContent = '…';
    bMore.addEventListener('click', function () {
      var v = prompt('Сколько ударов на ' + hole + '-й лунке?', '10');
      if (v != null && Number(v) > 0) applyScore(Math.min(15, Number(v)));
    });
    pad.appendChild(bMore);

    renderSumTiles(sum);
    renderPace();
    paintButtons(cur != null);
  }

  function stat(label, value) { return '<div class="stat"><b>' + value + '</b>' + label + '</div>'; }
  function fmtTopar(tp) { return tp === 0 || tp == null ? 'E' : tp > 0 ? '+' + tp : String(tp); }
  function formatName(f) { try { return t('format.' + (f || 'stroke')); } catch (e) { return 'Строук'; } }
  function settingsStable() { try { return !!JSON.parse(localStorage.getItem('pc.stableford') || 'true'); } catch (e) { return true; } }
  function teeLabel(tee) { return (C.tees[tee] || {})[i18nLang()] || String(tee).toUpperCase(); }
  function Pscores() { return pPlayer.scores || {}; }

  function applyScore(v) {
    if (round.status !== 'active') return;
    // оптимистично: пытаемся сразу в БД, при офлайне — очередь (§5.3)
    window.DB.setWithQueue('rounds/' + roundId + '/players/' + playerId + '/scores/' + String(hole), v)
      .then(function () {
        if (!navigator.onLine && window.DB.mode() !== 'demo') window.Util.toast(t('score.offlineQueued'));
      });
    // авто-переход на следующую лунку
    var idx = seqCache.indexOf(hole);
    if (idx >= 0 && idx + 1 < seqCache.length) hole = seqCache[idx + 1];
    // DB.on сам придёт — сделаем мгновенную локальную перерисовку оптимистично
    pPlayer.scores = pPlayer.scores || {};
    pPlayer.scores[String(seqCache[idx])] = v;
    render();
  }

  document.getElementById('prevHole').addEventListener('click', function () {
    var i = seqCache.indexOf(hole); if (i > 0) { hole = seqCache[i - 1]; render(); }
  });
  document.getElementById('nextHole').addEventListener('click', function () {
    var i = seqCache.indexOf(hole); if (i + 1 < seqCache.length) { hole = seqCache[i + 1]; render(); }
  });
  document.getElementById('pickup').addEventListener('click', function () {
    applyScore(0); // pickup = 0 → null (не сыграно/X)
  });
  document.getElementById('showStable').addEventListener('change', function (e) {
    try { localStorage.setItem('pc.stableford', e.target.checked ? 'true' : 'false'); } catch (er) {}
    render();
  });

  function paintButtons() { document.getElementById('finishBtn').hidden = false; }

  function renderPace() {
    // elapsed vs план по TIMINGS (§4.1, §5.3)
    if (!round.startTime) return;
    var playedIdx = 0; var sc = Pscores();
    var elapsed = (Date.now() - round.startTime);
    var order = [];
    for (var i = 0; i < seqCache.length; i++) { if (sc[String(seqCache[i])] != null && sc[String(seqCache[i])] !== 0) order.push(seqCache[i]); }
    order.push(hole); // текущая лунка тоже «занята»
    var p = window.WHS.pace(Date.now(), round.startTime, round.startHole || 1, order, C.course.timings);
    var fill = document.getElementById('paceFill'); var tx = document.getElementById('paceText'); var box = document.getElementById('paceBox');
    var pct = Math.min(100, Math.max(0, p.planMatched ? 0 : p.pct * 2 + 50));
    fill.style.width = pct + '%';
    box.className = 'card pace ' + (p.status === 'behind' ? 'pace--behind' : p.status === 'ahead' ? 'pace--ahead' : '');
    tx.textContent = (p.diffMin > 0 ? '−' + p.diffMin + ' мин ' + t('pace.behind') : p.diffMin < 0 ? '+' + Math.abs(p.diffMin) + ' мин ' + t('pace.ahead') : t('pace.onTime')) + ' · ' + t('ui.qr.hole') + ' ' + hole;
  }
  setInterval(renderPace, 30000);

  function renderSumTiles(sum) {
    // подробный смотр по лункам «всё сразу» для текущего игрока
    var sc = Pscores(); var holes = C.course.holes; var f = pPlayer.fieldHcp;
    var rows = seqCache.map(function (hn) {
      var hd = holeData(hn); var v = sc[String(hn)];
      var sr = f != null ? window.WHS.strokesReceived(f, hd, holes) : 0;
      return '<tr' + (hn === hole ? ' class="holewin"' : '') + '><td>' + hn + '</td><td>' + 'P' + hd.p + '</td><td>' + (v != null && v !== 0 ? v : '·') + '</td><td>' + (v != null && v > 0 ? window.WHS.scoreName(v - hd.p) : '—') + '</td><td class="num">' + (document.getElementById('showStable').checked && v != null && v > 0 ? window.WHS.stablefordPoints(v - sr - hd.p) : '—') + '</td></tr>';
    }).join('');
    document.getElementById('sumTiles').innerHTML =
      '<div class="tablewrap"><table class="tbl"><thead><tr><th>#</th><th>P</th><th>'.concat(t('score.gross'), '</th><th>').concat('Итог', '</th><th class="num">').concat(t('score.stableford'), '</th></tr></thead><tbody>') + rows +
      '<tr><td colspan="2"><b>Итог</b></td><td><b>' + (sum.gross || '—') + '</b></td><td>' + fmtTopar(sum.toPar) + '</td><td class="num"><b>' + (document.getElementById('showStable').checked ? (round.format === 'stableford' ? sum.stableNet : sum.stableGross) : '—') + '</b></td></tr></tbody></table></div>';
  }

  /* ------- пауза / завершение / вызовы ------- */
  document.getElementById('pauseBtn').addEventListener('click', function () {
    if (round.paused) {
      window.DB.update('rounds/' + roundId, { paused: null, pauseReason: null });
    } else {
      var reasons = ['⛈ Гроза/непогода', '🚑 Медпомощь', '🛠 Поле/дорожки', 'Другое'];
      var m = window.Util.modal(
        '<h3>' + t('round.paused') + '</h3>' + reasons.map(function (r, i) {
          return '<button class="btn btn--ghost" data-r="' + i + '" style="width:100%;margin:6px 0;">' + r + '</button>';
        }).join('') + '<button class="btn" data-close>Отмена</button>'
      );
      m.el.addEventListener('click', function (e) {
        var i = e.target.closest('[data-r]'); if (!i) return;
        window.DB.update('rounds/' + roundId, { paused: true, pauseReason: reasons[Number(i.getAttribute('data-r'))] });
        m.close();
      });
    }
  });
  document.getElementById('finishBtn').addEventListener('click', function () {
    if (!confirm('Завершить раунд?')) return;
    window.DB.update('rounds/' + roundId, { status: 'completed', endTime: Date.now() }).then(function () {
      location = 'leaderboard.html';
    });
  });
  document.getElementById('alertRef').addEventListener('click', function () {
    window.DB.push('alerts', {
      type: 'referee', hole: hole, playerName: pPlayer.name, time: Date.now(), round: roundId, status: 'active'
    }).then(function () { window.Util.toast('Судья вызван на лунку ' + hole); });
  });
})();
