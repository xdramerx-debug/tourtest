// Гольф-расчёты по World Handicap System (WHS):
// Playing Handicap, распределение ударов по Stroke Index,
// Net Score, Maximum Score Rule (Net Double Bogey), Stableford,
// To Par, позиции с тай-брейком (countback), статистика лунок.
window.GolfCalc = (function () {
  "use strict";

  // WHS: Course Handicap = HI × Slope/113 + (CR − Par);
  // Playing Handicap = round( Course Handicap × SCA% ).
  // SCA (Stroke Competition Allowance): 95% stroke play / stableford по умолчанию.
  function courseHandicap(hi, slope, cr, par) {
    if (hi == null || slope == null || cr == null || par == null) return null;
    return Number(hi) * (Number(slope) / 113) + (Number(cr) - Number(par));
  }

  function playingHandicap(hi, slope, cr, par, scaPct) {
    const ch = courseHandicap(hi, slope, cr, par);
    if (ch == null) return null;
    const sca = (scaPct == null ? 100 : Number(scaPct)) / 100;
    return Math.round(ch * sca);
  }

  // Число гандикап-ударов на каждой лунке (по индексу 0..17).
  // Удары раздаются по возрастанию Stroke Index; при PH > 18 второй круг раздачи.
  // Отрицательный PH (plus-handicap) забирает удары с лунок с наибольшим SI.
  function strokesPerHole(holes, ph) {
    const out = holes.map(() => 0);
    if (!Number.isFinite(ph) || ph === 0 || !holes.length) return out;
    const ranked = holes
      .map((h, i) => ({ i: i, si: Number(h.si) || 99 }))
      .sort((a, b) => (a.si - b.si) || (a.i - b.i));
    const total = Math.abs(Math.trunc(ph));
    const sign = ph > 0 ? 1 : -1;
    for (let k = 0; k < total; k++) {
      const idx = sign > 0 ? k % holes.length : holes.length - 1 - (k % holes.length);
      out[ranked[idx].i] += sign;
    }
    return out;
  }

  // Индексы лунок, получающих хотя бы один удар (совместимость с UI).
  function strokeHoleSet(holes, ph) {
    const per = strokesPerHole(holes, ph);
    return new Set(per.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0));
  }

  // Maximum Score Rule: Net Double Bogey — максимальный gross на лунке
  // для целей гандикапа: par + 2 + полученные удары.
  function netDoubleBogey(par, strokes) {
    return Number(par) + 2 + (Number(strokes) || 0);
  }

  // Результат лунки: gross с учётом NDB и net.
  function holeResult(gross, par, strokes, useMax) {
    const capped = useMax ? Math.min(gross, netDoubleBogey(par, strokes)) : gross;
    return { adjGross: capped, net: capped - (Number(strokes) || 0) };
  }

  function toPar(gross, par) {
    return gross == null ? null : gross - par;
  }

  function fmtToPar(v) {
    if (v == null) return "–";
    if (v === 0) return "E";
    return (v > 0 ? "+" : "") + v;
  }

  // Stableford (R&A/USGA): albatross 5, eagle 4, birdie 3, par 2, bogey 1, double+ 0.
  function stablefordPoints(netToPar) {
    if (netToPar == null) return null;
    return Math.max(0, 2 - netToPar);
  }

  // Класс цветовой индикации к гру-результату
  function scoreClass(gross, par) {
    if (gross == null) return "";
    const d = gross - par;
    if (d <= -3) return "sc-eb";
    if (d === -2) return "sc-eagle";
    if (d === -1) return "sc-birdie";
    if (d === 0) return "sc-par";
    if (d === 1) return "sc-bogey";
    if (d === 2) return "sc-double";
    return "sc-worse";
  }

  // Полный расчёт раунда игрока: по лункам + итоги
  function computeRound(t, playerId, roundNo) {
    roundNo = roundNo || 1;
    const holes = (t.course && t.course.holes) || [];
    const scf = (t.config && t.config.scoring) || {};
    const tee =
      t.meta && t.meta.tees
        ? t.meta.tees[t.config.tee] || Object.values(t.meta.tees)[0]
        : null;
    const player = (t.players || {})[playerId] || {};
    const sc =
      ((t.scorecards || {})[playerId] || {})["round" + roundNo] || {};
    const useStable = scf.stableford !== false;
    const useMax = scf.maxScoreRule !== false;

    const ph = tee
      ? playingHandicap(player.hcpIndex, tee.slope, tee.cr, tee.par, scf.playingHandicapAllowancePct)
      : null;
    const perHole = strokesPerHole(holes, ph);

    const rows = [];
    let gSum = 0, nSum = 0, sSum = 0, played = 0, numeric = 0, hasWD = false, hasDQ = false;

    holes.forEach((h, i) => {
      const raw = sc.holes && sc.holes[h.n] != null ? sc.holes[h.n] : null;
      const isNum = typeof raw === "number";
      const flag = isNum ? null : raw; // "X" | "WD" | "DQ"
      if (flag === "WD") hasWD = true;
      if (flag === "DQ") hasDQ = true;
      const stroke = perHole[i];
      let gross = null, net = null, tpg = null, tpn = null, st = null;
      if (isNum) {
        gross = raw;
        net = holeResult(gross, h.par, stroke, useMax).net;
        tpg = toPar(gross, h.par);
        tpn = toPar(net, h.par);
        st = useStable ? stablefordPoints(tpn) : null;
        gSum += gross;
        nSum += net;
        if (st != null) sSum += st;
        numeric++;
      }
      if (raw != null) played++;
      rows.push({ n: h.n, par: h.par, si: h.si, stroke: stroke, gross: gross, net: net, tpg: tpg, tpn: tpn, st: st, flag: flag });
    });

    let thru = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].gross != null || rows[i].flag) thru = i + 1;
      else break;
    }
    const finished = played === holes.length && !hasWD && !hasDQ;

    return {
      playerId: playerId,
      roundNo: roundNo,
      ph: ph,
      rows: rows,
      outGross: sumRange(rows, 0, 9),
      inGross: sumRange(rows, 9, 18),
      totalGross: numeric ? gSum : null,
      totalNet: numeric ? nSum : null,
      totalToParGross: numeric ? gSum - parTotal(holes) : null,
      totalToParNet: numeric ? nSum - parTotal(holes) : null,
      stableford: useStable && numeric ? sSum : null,
      thru: thru,
      finished: finished,
      hasWD: hasWD,
      hasDQ: hasDQ,
      status: hasDQ ? "DQ" : hasWD ? "WD" : finished ? "finished" : numeric ? "in_progress" : "not_started"
    };
  }

  function sumRange(rows, a, b) {
    let s = 0;
    for (let i = a; i < b && i < rows.length; i++) if (rows[i].gross != null) s += rows[i].gross;
    return s;
  }

  function parTotal(holes) {
    return holes.reduce((s, h) => s + h.par, 0);
  }

  function rowsOf(r) {
    if (r.rows) return r.rows;
    if (r.perRound && r.perRound.length) return r.perRound[r.perRound.length - 1].rows;
    return null;
  }

  // Net-to-par по диапазону лунок (для countback)
  function spanNet(r, from, to) {
    const rows = rowsOf(r);
    if (!rows) return null;
    let s = 0;
    for (let i = from - 1; i < to; i++) {
      const row = rows[i];
      if (!row || row.net == null) return null;
      s += row.net - row.par;
    }
    return s;
  }

  function compareRows(a, b) {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.totalNet != null && b.totalNet != null && a.totalNet !== b.totalNet) return a.totalNet - b.totalNet;
    if (a.totalGross != null && b.totalGross != null && a.totalGross !== b.totalGross) return a.totalGross - b.totalGross;
    // Countback (USGA): последние 9 → последние 3 → 18-я лунка (net)
    for (const span of [[10, 18], [16, 18], [18, 18]]) {
      const sa = spanNet(a, span[0], span[1]);
      const sb = spanNet(b, span[0], span[1]);
      if (sa != null && sb != null && sa !== sb) return sa - sb;
    }
    if (a.thru !== b.thru) return b.thru - a.thru;
    return 0;
  }

  function sortRows(rows) {
    const order = { DQ: 3, WD: 2 };
    return rows
      .slice()
      .sort((a, b) => {
        const oa = order[a.status] != null ? order[a.status] : a.finished ? 0 : 1;
        const ob = order[b.status] != null ? order[b.status] : b.finished ? 0 : 1;
        if (oa !== ob) return oa - ob;
        return compareRows(a, b);
      });
  }

  function assignPositions(rows) {
    let lastNet = null, lastGross = null, prevPos = 0;
    rows.forEach((r, i) => {
      if (r.finished && r.totalNet != null && r.totalNet === lastNet && r.totalGross === lastGross && prevPos > 1) {
        r.pos = prevPos;
        r.tied = true;
      } else {
        r.pos = i + 1;
        r.tied = false;
      }
      if (r.finished && r.totalNet != null) {
        lastNet = r.totalNet;
        lastGross = r.totalGross;
      }
      prevPos = r.pos;
    });
    rows.forEach((r) => {
      if (!r.finished && r.status !== "DQ" && r.status !== "WD") r.pos = null;
    });
  }

  // Лидерборд за один раунд
  function board(t, roundNo) {
    const players = Object.values((t && t.players) || {})
      .filter((p) => p.status !== "cancelled")
      .filter((p) => p.status === "confirmed" || (t.scorecards && t.scorecards[p.id]));
    const rows = sortRows(players.map((p) => {
      const r = computeRound(t, p.id, roundNo);
      return { player: p, ph: r.ph, rows: r.rows, outGross: r.outGross, inGross: r.inGross, totalGross: r.totalGross, totalNet: r.totalNet, totalToParGross: r.totalToParGross, totalToParNet: r.totalToParNet, stableford: r.stableford, thru: r.thru, finished: r.finished, status: r.status, hasWD: r.hasWD, hasDQ: r.hasDQ };
    }));
    assignPositions(rows);
    return rows;
  }

  // Сводный лидерборд по всем раундам (Total)
  function boardTotal(t) {
    const roundNos = Object.keys((t.meta && t.meta.roundStarts) || {}).map(Number).sort((a, b) => a - b);
    if (!roundNos.length) return [];
    const players = Object.values((t && t.players) || {})
      .filter((p) => p.status !== "cancelled")
      .filter((p) => p.status === "confirmed" || (t.scorecards && t.scorecards[p.id]));
    const rows = players.map((p) => {
      const per = roundNos.map((n) => computeRound(t, p.id, n));
      const agg = (f) => per.reduce((s, r) => s + (f(r) != null ? f(r) : 0), 0);
      const anyScore = per.some((r) => r.totalGross != null);
      const allFinished = per.every((r) => r.finished);
      const status = per.some((r) => r.hasDQ) ? "DQ" : per.some((r) => r.hasWD) ? "WD" : allFinished ? "finished" : anyScore ? "in_progress" : "not_started";
      return {
        player: p,
        ph: per[0].ph,
        perRound: per,
        totalGross: anyScore ? agg((r) => r.totalGross) : null,
        totalNet: anyScore ? agg((r) => r.totalNet) : null,
        stableford: per.some((r) => r.stableford != null) ? agg((r) => r.stableford) : null,
        thru: per[per.length - 1].thru,
        finished: allFinished,
        status: status
      };
    });
    const sorted = sortRows(rows);
    assignPositions(sorted);
    return sorted;
  }

  // Статистика по одной лунке (все игроки)
  function holeStats(t, roundNo, holeN) {
    if (!holeN) holeN = 1;
    const rows = board(t, roundNo)
      .map((r) => r.rows[holeN - 1])
      .filter(Boolean);
    const scores = rows.filter((x) => x.gross != null).map((x) => x.gross);
    if (!scores.length) return null;
    return {
      count: scores.length,
      avg: +(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1),
      best: Math.min.apply(null, scores)
    };
  }

  return {
    courseHandicap: courseHandicap,
    playingHandicap: playingHandicap,
    strokesPerHole: strokesPerHole,
    strokeHoleSet: strokeHoleSet,
    netDoubleBogey: netDoubleBogey,
    holeResult: holeResult,
    toPar: toPar,
    fmtToPar: fmtToPar,
    stablefordPoints: stablefordPoints,
    scoreClass: scoreClass,
    computeRound: computeRound,
    compareRows: compareRows,
    board: board,
    boardTotal: boardTotal,
    holeStats: holeStats,
    parTotal: parTotal
  };
})();
