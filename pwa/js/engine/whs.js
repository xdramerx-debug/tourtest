/* WHS-расчёты (§4). Чистый модуль без DOM/БД — Node-тестируемый (tests/pestovo-engine.test.mjs).
   UMD: window.WHS в браузере, module.exports в Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WHS = factory();
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function round1(x) { return Math.round(x * 10) / 10; }

  /** Полевой (course) HCP: round(exact × SR/113 + (CR − Par)) — §4.2. Допустим отрицательный (plus). */
  function fieldHcp(exact, tee, gender, ratings, par) {
    var g = gender === 'women' ? 'women' : 'men';
    var byGender = ratings[g] || {};
    var r = byGender[tee] || ratings.men[tee] || ratings.men.wh;
    if (!r) throw new Error('нет рейтинга для ти ' + tee + ' / ' + gender);
    return Math.round(exact * r.sr / 113 + (r.cr - par));
  }

  /**
   * WHS-индекс по истории: очавшие 18-луночные раунды (до 20), дифференциал
   * (adjGross − CR) × 113 / SR; берём до 8 лучших (минимальных), их среднее — округлённый шаг 0.1.
   */
  function whsIndex(history, ratingsLookup) {
    var rows18 = (history || [])
      .filter(function (h) { return h && (h.nHoles === 18 || (h.gross != null && h.holes == null)) && h.gross != null; })
      .slice(-20);
    if (!rows18.length) return null;
    var diffs = rows18.map(function (h) {
      var r = ratingsLookup(h.tee, h.gender);
      return (h.gross - r.cr) * 113 / r.sr;
    }).sort(function (a, b) { return a - b; });
    var take = Math.min(8, Math.max(1, Math.ceil(diffs.length * 0.4))); // правило «лучшие до 8», адаптировано для <20 раундов
    var avg = diffs.slice(0, take).reduce(function (s, x) { return s + x; }, 0) / take;
    return round1(clamp(avg, -10, 54));
  }

  /** Итоговые счётчики раунда по лункам. scores: { n: стрaксы| null | 0 }; null/0 = не сыграна. */
  function summarize(scores, holes, field) {
    var gross = 0, played = 0, thru = 0;
    var stableGross = 0, stableNet = 0;
    var toPar = 0; var toParThru = 0;
    holes.forEach(function (hole, i) {
      var n = i + 1;
      var v = scores ? scores[String(n)] : undefined;
      if (v == null || v === 0) { thru = thru || n - 1; return; }
      played += 1; thru = n;
      gross += v;
      var d = v - hole.p; toPar += d; if (n <= thru) toParThru = toPar;
      // стейблфорд по гроссу и по полевому НСР (SI)
      stableGross += stablefordPoints(d);
      var rec = field == null ? 0 : strokesReceived(field, hole, holes);
      stableNet += stablefordPoints(v - rec - hole.p);
    });
    var prog = prognosis(played, gross, holes, scores);
    return { gross: gross, played: played, thru: thru, toPar: toPar, stableGross: stableGross, stableNet: stableNet, projected18: prog };
  }

  /** Stableford points классический: ≤−4 → 6, −3 → 5, −2 → 4, −1 → 3, 0 → 2, +1 → 1, ≥+2 → 0. */
  function stablefordPoints(diffToPar) {
    if (diffToPar <= -4) return 6;
    if (diffToPar <= -3) return 5;
    if (diffToPar === -2) return 4;
    if (diffToPar === -1) return 3;
    if (diffToPar === 0) return 2;
    if (diffToPar === 1) return 1;
    return 0;
  }
  /** Modified Stableford: ≤−4 → 8, −3 → 6, −2 → 4, −1 → 2, 0 → 0, +1 → −1, ≥+2 → −3 (WHS-style «модифицированный»). */
  function modifiedStablefordPoints(diffToPar) {
    if (diffToPar <= -4) return 8;
    if (diffToPar === -3) return 6;
    if (diffToPar === -2) return 4;
    if (diffToPar === -1) return 2;
    if (diffToPar === 0) return 0;
    if (diffToPar === 1) return -1;
    return -3;
  }

  /** Сколько инсультов получает игрок на лунке от полевого HCP (с учётом цикла за 18/9). */
  function strokesReceived(field, hole, holes) {
    if (field == null) return 0;
    var si = hole.hcp; var count = holes.length;
    if (field <= 0) {
      // plus-игрок «отдаёт» на самых тяжёлых индексах (строчные индексы занижаем)
      return field < 0 && si > count + field ? -1 : 0;
    }
    var extra = Math.floor(field / count); var rest = field % count;
    return extra + (si <= rest ? 1 : 0);
  }

  /** Проекция результата на 18: gross + ожидание par на неотыгранных по текущему темпу ± пар (линейная экстраполяция ± toPar/hole). */
  function prognosis(played, gross, holes, scores) {
    if (!played) return null;
    var toPar = 0; holes.forEach(function (h, i) {
      var v = scores && scores[String(i + 1)];
      if (v != null && v !== 0) toPar += v - h.p;
    });
    var parDone = 0; holes.forEach(function (h, i) { var v = scores && scores[String(i + 1)]; if (v != null && v !== 0) parDone += h.p; });
    var remainingPar = 0; holes.forEach(function (h, i) { var v = scores && scores[String(i + 1)]; if (v == null || v === 0) remainingPar += h.p; });
    var perHole = toPar / played;
    var proj = gross + remainingPar + Math.round(perHole * (holes.length - played));
    return { grossProj: proj, toParProj: Math.round(perHole * holes.length), remainingPar: remainingPar, perHole: Math.round(perHole * 100) / 100 };
  }

  /** Название результата по лунке (§4.3). */
  function scoreName(diff) {
    if (diff <= -4) return 'Condor';
    if (diff === -3) return 'Albatross';
    if (diff === -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double';
    return '+' + diff;
  }

  /** Тайминг pace-of-play: elapsed по факту vs ожидание по TIMINGS (кумулятивно, начиная со startHole). */
  function pace(now, startAtMs, startHole, schedules, timings) {
    var elapsedMin = (now - startAtMs) / 60000;
    var plannedMin = 0; var order = schedules || [];
    for (var i = 0; i < order.length; i++) { plannedMin += (timings[order[i]] || 15); }
    var planned = plannedMin * (elapsedMin > 0 ? 1 : 1);
    var diff = elapsedMin - planned; var pct = plannedMin ? (diff / plannedMin) * 100 : 0;
    var status = pct > 15 ? 'behind' : pct < -15 ? 'ahead' : 'ontime';
    return { elapsedMin: Math.round(elapsedMin), plannedMin: Math.round(plannedMin), diffMin: Math.round(diff), pct: Math.round(pct), status: status };
  }

  /** Бенды полевого HCP на бейджах (§4.2): +/scratch (≤0), 1–10, 11–20, 21–36, 37+. */
  function hcpBand(field) {
    if (field <= 0) return { id: 'plus', label: '+/scr' };
    if (field <= 10) return { id: 'low', label: '1–10' };
    if (field <= 20) return { id: 'mid', label: '11–20' };
    if (field <= 36) return { id: 'high', label: '21–36' };
    return { id: 'max', label: '37+' };
  }

  /** WHS-симулятор (§4.2): целевые счёты для удержания индекса и снижения на 1.0. */
  function simulator(indexNow, historyCount, tee, gender, ratings, par) {
    var r = (ratings[gender === 'women' ? 'women' : 'men'] || {})[tee] || ratings.men[tee] || ratings.men.wh;
    var keepD = indexNow == null ? (r.cr - par) : indexNow;
    var betterD = keepD - 1.0;
    function grossFor(diff) { return Math.round(diff * r.sr / 113 + r.cr); }
    return {
      keep: grossFor(keepD), betterByOne: grossFor(betterD),
      note: 'CR ' + r.cr + ' / SR ' + r.sr + ', дифф удержания ≈ ' + round1(keepD)
    };
  }

  /** Формат: таблица exact→field (диапазоны), по ТИ и полу — §4.2 «полные таблицы». */
  function fieldHcpTable(tee, gender, ratings, par, exactFrom, exactTo) {
    var rows = [];
    var curF = null;
    for (var e = exactFrom; e <= exactTo + 0.001; e += 0.5) {
      var f = fieldHcp(e, tee, gender, ratings, par);
      if (f !== curF) { rows.push({ from: round1(e), field: f }); curF = f; }
    }
    // доработать «to» = следующая граница −0.5
    for (var i = 0; i < rows.length; i++) rows[i].to = i + 1 < rows.length ? round1(rows[i + 1].from - 0.5) : round1(exactTo);
    return rows;
  }

  return {
    fieldHcp: fieldHcp, whsIndex: whsIndex, summarize: summarize,
    stablefordPoints: stablefordPoints, modifiedStablefordPoints: modifiedStablefordPoints,
    strokesReceived: strokesReceived, prognosis: prognosis, scoreName: scoreName,
    pace: pace, hcpBand: hcpBand, simulator: simulator, fieldHcpTable: fieldHcpTable,
    round1: round1
  };
});
