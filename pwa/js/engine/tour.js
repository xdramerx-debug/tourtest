/* Турнирный движок (§7): чистый модуль без DOM — Node-тестируемый.
   Handicap/Scoring — в whs.js; здесь: TieBreak, Pairing, Cut, Leaderboard,
   OoM-очки, протокол v2 (неперезаписываемый), CSV-парсер импорта, аудит. */
(function (root, factory) {
  var api = factory(root ? root.WHS : undefined);
  try { if (typeof module === 'object' && module.exports) module.exports = api; } catch (e) {}
  if (root) root.TOUR = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (WHS) {
  'use strict';

  /* ---------- TieBreak: countback 9/6/3/1 (§4.6) ---------- */
  function countback(scores, holes) {
    // scores: {n: strokes}. Возвращает вектор [t18,t9,t6,t3,t1] относительно par.
    var total = 0, all = [18, 9, 6, 3, 1];
    var back = [];
    [18, 9, 6, 3, 1].forEach(function (span) {
      var s = 0;
      holes.slice(-span).forEach(function (h, idx) {
        var n = holes.length - span + idx + 1;
        var v = scores && scores[String(n)];
        if (v != null && v !== 0) s += (v - h.p);
      });
      back.push(s);
    });
    holes.forEach(function (h, i) { var v = scores && scores[String(i + 1)]; if (v != null && v !== 0) total += (v - h.p); });
    total = back.shift() == null ? total : total;
    return { total: total, back: back };
  }
  // Сравнение двух countback-векторов: -1 лучше a, +1 лучше b
  function cmpCountback(a, b) {
    if (a.total !== b.total) return a.total - b.total;
    for (var i = 0; i < Math.max(a.back.length, b.back.length); i++) {
      var av = a.back[i] == null ? null : a.back[i];
      var bv = b.back[i] == null ? null : b.back[i];
      if (av == null || bv == null) continue;
      if (av !== bv) return av - bv;
    }
    return 0;
  }

  /* ---------- LeaderboardService (§7.6) ----------
     players: [{pid,name,gender,tee,scores,fieldHcp,status?,teamId?,pair?}]
     Опции: format stroke|stableford|match|scramble|bestball|skins, division 'men'|'women'|'all',
     tiebreak 'countback'|'none', holesCount. */
  function leaderboard(players, holes, opts) {
    opts = opts || {};
    var format = opts.format || 'stroke';
    var div = opts.division || 'all';
    var rows = (players || []).filter(function (p) {
      if (div === 'all') return true;
      var g = p.gender === 'women' || p.gender === 'w' ? 'women' : 'men';
      return g === div;
    }).map(function (p) {
      var st = String(p.status || '').toUpperCase();
      var inactive = ['DQ', 'WD', 'DNS', 'DNF'].indexOf(st) >= 0;
      var row = { pid: p.pid, name: p.name, gender: p.gender, tee: p.tee, status: st || null, rounds: p.rounds || null };
      if (inactive) { row.inactive = true; return row; }
      var scores = p.scores || {};
      if (format === 'stableford') {
        var pts = 0, played = 0;
        holes.forEach(function (h, i) {
          var v = scores[String(i + 1)];
          if (v == null || v === 0) return;
          played++;
          var rec = p.fieldHcp == null ? 0 : WHS.strokesReceived(p.fieldHcp, h, holes);
          pts += WHS.stablefordPoints(v - rec - h.p);
        });
        row.points = pts; row.played = played;
        row.toPar = toPar(scores, holes);
      } else if (format === 'skins') {
        row.skins = 0; row.toPar = toPar(scores, holes); row.played = playedCount(scores, holes);
      } else {
        var sum = WHS.summarize(scores, holes, p.fieldHcp);
        row.gross = sum.gross; row.played = sum.played; row.thru = sum.thru;
        row.toPar = sum.toPar;
        row.net = p.fieldHcp == null ? null : sum.gross - p.fieldHcp;
        row.stableNet = sum.stableNet;
        row.countback = countback(scores, holes);
      }
      return row;
    });
    var active = rows.filter(function (r) { return !r.inactive; });
    var sortKey = {
      stroke: function (a, b) {
        if ((a.toPar || 0) !== (b.toPar || 0)) return (a.toPar || 0) - (b.toPar || 0);
        if (opts.tiebreak === 'countback' && a.played >= 18 && b.played >= 18) return cmpCountback(a.countback, b.countback);
        return (b.played || 0) - (a.played || 0);
      },
      stableford: function (a, b) { return (b.points || 0) - (a.points || 0) || ((b.played || 0) - (a.played || 0)); },
      match: function (a, b) { return (b.points || 0) - (a.points || 0); },
      scramble: function (a, b) { return (a.toPar || 0) - (b.toPar || 0); },
      bestball: function (a, b) { return (a.toPar || 0) - (b.toPar || 0); },
      skins: function (a, b) { return (b.skins || 0) - (a.skins || 0) || ((a.toPar || 0) - (b.toPar || 0)); }
    }[format] || function (a, b) { return (a.toPar || 0) - (b.toPar || 0); };
    active.sort(sortKey);
    var place = 0, prevKey = null, leaderPlace = 0;
    active.forEach(function (r, i) {
      var key = format === 'stableford' ? String(r.points) : (format === 'skins' ? [-r.skins, r.toPar].join() : String(r.toPar));
      if (prevKey !== key) { leaderPlace = i + 1; r.place = String(i + 1); }
      else r.place = '=' + String(leaderPlace);
      prevKey = key; place = i + 1;
    });
    return active.concat(rows.filter(function (r) { return r.inactive; }));
  }
  function playedCount(scores, holes) {
    var n = 0; holes.forEach(function (h, i) { var v = scores[String(i + 1)]; if (v != null && v !== 0) n++; });
    return n;
  }
  function toPar(scores, holes) {
    var d = 0; holes.forEach(function (h, i) { var v = scores[String(i + 1)]; if (v != null && v !== 0) d += (v - h.p); });
    return d;
  }

  /* ---------- PairingService (§7.4): флеты 2–4 ---------- */
  function pairings(players, opts) {
    opts = opts || {};
    var size = opts.size || 4;
    var by = opts.by || 'index'; // 'index' | 'random' | 'league'(змейка)
    var list = (players || []).slice();
    if (by === 'index') list.sort(function (a, b) { return (a.fieldHcp || 0) - (b.fieldHcp || 0); });
    if (by === 'random') shuffle(list);
    var flights = [];
    if (by === 'league') {
      var n = list.length, cols = Math.min(size, 4), rowsN = Math.ceil(n / cols);
      for (var c = 0; c < cols; c++) {
        var fl = [];
        var left = c, goingLeft = false;
        for (var r = 0; r < rowsN; r++) {
          var idx = r * cols + left;
          if (n % cols === 0 || !goingLeft || idx < n) { if (idx < n) fl.push(list[idx]); }
          if (left === 0) goingLeft = false;
          if (left === cols - 1) goingLeft = true;
          left = goingLeft ? left - 1 : c === cols - 1 && !goingLeft ? left - 1 : left + 1;
        }
        if (fl.length) flights.push(fl);
      }
      return flights;
    }
    for (var i = 0; i < list.length; i += size) {
      var f = list.slice(i, i + size);
      if (f.length === 1 && flights.length) {
        var last = flights[flights.length - 1];
        if (last.length >= 2) { // перебрасываем одного из прошлого флета: 4/4/4/3+2 вместо 4/4/4/5
          var moved = last.pop();
          flights.push([moved, f[0]]);
        } else last.push(f[0]);
      }
      else flights.push(f);
    }
    return flights;
  }
  function shuffle(arr) {
    var a = arr.slice ? arr : arr;
    var out = [];
    while (a.length) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    return out;
  }

  /* ---------- CutService (§7.5) ---------- */
  function cut(standings, rule) {
    rule = rule || { kind: 'top', n: 30 };
    var act = (standings || []).filter(function (s) { return !s.inactive; });
    var pass;
    if (rule.kind === 'score') pass = act.filter(function (s) { return (s.toPar || 0) <= rule.x; });
    else if (rule.kind === 'pct') {
      var k = Math.ceil(act.length * (rule.p || 50) / 100);
      pass = act.slice(0, k);
    } else pass = act.slice(0, rule.n || Math.ceil(act.length / 2));
    var passIds = {};
    pass.forEach(function (s) { passIds[s.pid] = true; });
    return { pass: pass, fail: act.filter(function (s) { return passIds[s.pid] !== true; }) };
  }

  /* ---------- Skins (§4.4): лунка — тому, у кого уникально лучший результат ---------- */
  function skinsWinners(players, holes) {
    var skins = {}; var carried = Object.create(null);
    (players || []).forEach(function (p) { skins[p.pid] = 0; });
    holes.forEach(function (h, i) {
      var n = i + 1;
      var best = null, bestPid = null, tie = false;
      (players || []).forEach(function (p) {
        var v = p.scores && p.scores[String(n)];
        if (v == null || v === 0) return;
        if (best == null || v < best) { best = v; bestPid = p.pid; tie = false; }
        else if (v === best) tie = true;
      });
      if (bestPid != null && !tie) skins[bestPid] += 1 + (carried[n - 1] || 0) + 0 * (carried[n] || 0);
      if (bestPid != null && tie) carried[n] = (carried[n - 1] || 0) + 1; else carried[n] = 0;
    });
    return skins;
  }

  /* ---------- BestBall (§4.4): лучший мяч пары/флета на лунке ---------- */
  function bestBallBoard(flights, holes) {
    return (flights || []).map(function (flight) {
      var scores = {};
      holes.forEach(function (h, i) {
        var n = i + 1, best = null;
        flight.forEach(function (p) {
          var v = p.scores && p.scores[String(n)];
          if (v != null && v !== 0 && (best == null || v < best)) best = v;
        });
        scores[String(n)] = best;
      });
      var sum = WHS.summarize(scores, holes, null);
      return { flight: flight, scores: scores, gross: sum.gross, toPar: sum.toPar, played: sum.played, name: flight.map(function (p) { return (p.name || '').split(' ')[0]; }).join(' / ') };
    }).sort(function (a, b) { return (a.toPar || 0) - (b.toPar || 0); });
  }

  /* ---------- MatchPlayService (§4.4): попарный счёт по нетто-ударам ---------- */
  /** Очки матча игрока A против B: strokesReceived относительно разницы полевых HCP.
     Возвращает { up, holesLeft, result: 'WIN'|'LOSS'|'HALF'|'LIVE', status: '2&1' } */
  function matchScore(a, b, holes) {
    var diffA = (a.fieldHcp || 0) - (b.fieldHcp || 0); // >0 → A получает diffA ударов
    var up = 0, played = 0, lastN = 0;
    for (var i = 0; i < holes.length; i++) {
      var n = i + 1;
      var va = a.scores && a.scores[String(n)], vb = b.scores && b.scores[String(n)];
      if (va == null && vb == null) continue;
      if (va == null || vb == null || va === 0 || vb === 0) continue;
      var rec = 0;
      if (diffA > 0) rec = WHS.strokesReceived(diffA, holes[i], holes);
      else if (diffA < 0) rec = -WHS.strokesReceived(-diffA, holes[i], holes);
      var na = va - rec + 0, nb = vb - 0;
      if (na < nb) up += 1; else if (na > nb) up -= 1;
      played++; lastN = n;
      // досрочный исход: up > оставшихся
      var left = holes.length - played;
      if (Math.abs(up) > left) return { up: up, played: played, result: up > 0 ? 'WIN' : 'LOSS', status: Math.abs(up) + '&' + left, lastN: lastN };
    }
    if (played === holes.length || played > 0) {
      if (up > 0) return { up: up, played: played, result: 'WIN', status: up + 'UP', lastN: lastN };
      if (up < 0) return { up: up, played: played, result: 'LOSS', status: Math.abs(up) + 'DN', lastN: lastN };
      return { up: 0, played: played, result: 'HALF', status: 'AS', lastN: lastN };
    }
    return { up: 0, played: 0, result: 'LIVE', status: '—' };
  }
  /** Очки match-формата по флеттам: победа 1, делёж 0.5 × состав пар внутри флета. */
  function matchBoard(flights, holes) {
    var pts = {}, vs = [];
    (flights || []).forEach(function (f) {
      for (var i = 0; i < f.length; i++) {
        for (var j = i + 1; j < f.length; j++) {
          var r = matchScore(f[i], f[j], holes);
          pts[f[i].pid] = pts[f[i].pid] || 0;
          pts[f[j].pid] = pts[f[j].pid] || 0;
          if (r.result === 'WIN') pts[f[i].pid] += 1;
          else if (r.result === 'LOSS') pts[f[j].pid] += 1;
          else if (r.result === 'HALF') { pts[f[i].pid] += 0.5; pts[f[j].pid] += 0.5; }
          vs.push({ a: f[i].pid, b: f[j].pid, status: r.status, result: r.result });
        }
      }
    });
    return { points: pts, matches: vs };
  }

  /* ---------- OoM (§5.6): 100/80/70/60/55/… + 5 за участие ---------- */
  var OOM_TABLE = [100, 80, 70, 60, 55, 50, 45, 40, 35, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10];
  function oomPoints(place) {
    if (place >= 1 && place <= 20) return OOM_TABLE[place - 1];
    return place > 0 ? 5 : 0;
  }
  /** tournaments: [{id,name,date,standings:[{pid,name,place}]}] → rows [{pid,name,points,events,best}] */
  function computeOoM(tournaments) {
    var acc = {};
    (tournaments || []).forEach(function (t) {
      (t.standings || []).forEach(function (s) {
        var pts = oomPoints(s.place);
        acc[s.pid] = acc[s.pid] || { pid: s.pid, name: s.name, points: 0, events: 0, best: null, byEvent: [] };
        acc[s.pid].points += pts;
        acc[s.pid].events += 1;
        acc[s.pid].best = acc[s.pid].best == null ? s.place : Math.min(acc[s.pid].best, s.place);
        acc[s.pid].byEvent.push({ id: t.id, name: t.name, place: s.place, pts: pts });
      });
    });
    return Object.values(acc).sort(function (a, b) { return b.points - a.points || ((a.best || 99) - (b.best || 99)); });
  }

  /* ---------- Протокол v2 (§6.7): неперезаписываемый документ ---------- */
  function protocol(tournament, standings, meta) {
    var doc = {
      version: 2,
      tournamentId: tournament.id,
      name: tournament.name || '',
      format: tournament.format || 'stroke',
      date: tournament.date || (meta && meta.date) || '',
      createdAt: Date.now(),
      sealed: true,
      tables: {}
    };
    ['all', 'men', 'women'].forEach(function (d) {
      var rows = (standings[d] || []).map(function (r, i) {
        return { place: r.inactive ? r.status : String(r.place || i + 1), name: r.name, gross: r.gross, net: r.net, toPar: r.toPar, points: r.points, status: r.status || null };
      });
      doc.tables[d] = rows;
    });
    doc.hash = fnv(JSON.stringify(doc.tables) + doc.tournamentId + doc.date);
    return doc;
  }
  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  /** Проверка «неперезаписываемости»: новая версия допустима только поверх несуществующего/несогласованного. */
  function protocolDiff(oldDoc, newDoc) {
    if (!oldDoc) return { allowed: true, reason: 'new' };
    if (oldDoc.version !== newDoc.version) return { allowed: false, reason: 'version-mismatch' };
    if (oldDoc.sealed && oldDoc.tournamentId == newDoc.tournamentId && oldDoc.hash === newDoc.hash) return { allowed: false, reason: 'identical-already-sealed' };
    if (oldDoc.sealed) return { allowed: false, reason: 'sealed-immutable', oldHash: oldDoc.hash };
    return { allowed: true, reason: 'upgrade' };
  }

  /* ---------- CSV-парсер импорта (§6.5): 500 строк, кавычки, ;/ ,/tab ---------- */
  function parseCsv(text) {
    var rows = []; var cur = ['']; var inQ = false; var field = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur[field] += '"'; i++; } else inQ = false; }
        else cur[field] += ch;
        continue;
      }
      if (ch === '"') { inQ = true; continue; }
      if (ch === ',' || ch === ';' || ch === '\t') { field++; cur[field] = ''; continue; }
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        if (cur.length > 1 || cur[0] !== '') rows.push(cur);
        cur = ['']; field = 0; continue;
      }
      cur[field] += ch;
    }
    if (cur.length > 1 || cur[0] !== '') rows.push(cur);
    if (!rows.length) return { headers: [], rows: [] };
    var sep = detectSep(text.slice(0, 1000));
    var headers = rows[0].map(function (h) { return h.trim(); });
    var body = rows.slice(1).map(function (r) { var o = {}; headers.forEach(function (h, j) { o[h] = (r[j] || '').trim(); }); return o; });
    return { headers: headers, rows: body, sep: sep };
  }
  function detectSep(sample) {
    var c = (sample.match(/,/g) || []).length, s = (sample.match(/;/g) || []).length, t = (sample.match(/\t/g) || []).length;
    return t > s && t > c ? '\t' : s > c ? ';' : ',';
  }

  /* ---------- Draft-сервис мастера (§6.5): черновик в localStorage, автосейв 20с ---------- */
  var DRAFT_KEY = 'pc.tour.draft';
  function draftGet() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; } }
  function draftSet(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {} }

  return {
    countback: countback, cmpCountback: cmpCountback,
    leaderboard: leaderboard, pairings: pairings, cut: cut,
    skinsWinners: skinsWinners, bestBallBoard: bestBallBoard,
    matchScore: matchScore, matchBoard: matchBoard,
    oomPoints: oomPoints, computeOoM: computeOoM, OOM_TABLE: OOM_TABLE,
    protocol: protocol, protocolDiff: protocolDiff,
    parseCsv: parseCsv, draftGet: draftGet, draftSet: draftSet,
    _internals: { playedCount: playedCount, toPar: toPar }
  };
});
