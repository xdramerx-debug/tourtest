// Цифровая скоркарта: live-ввод по лункам, Net/Stableford в реальном времени,
// подписи маркера/игрока, блокировка после финализации, печать бумажной карточки.
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;
  const $$ = UI.$$;
  const params = new URLSearchParams(location.search);
  const pid = params.get("id");
  const rno = Number(params.get("round") || "1");
  const base = "scorecards/" + pid + "/round" + rno;
  const WRITE_DELAY_MS = 400;
  const MAX_STROKES = 15;

  let p = null;
  let renderedKey = null;
  const pendingWrites = new Map();
  let writeTimer = null;

  function scoringConfig() {
    return ((APP.config() || {}).scoring) || {};
  }

  function teeInfo() {
    const m = APP.meta(), c = APP.config() || {};
    const tee = m.tees && m.tees[c.tee] ? m.tees[c.tee] : Object.values(m.tees || {})[0];
    const ph = tee ? GolfCalc.playingHandicap(p.hcpIndex, tee.slope, tee.cr, tee.par, scoringConfig().playingHandicapAllowancePct) : null;
    const perHole = GolfCalc.strokesPerHole(APP.holes(), ph);
    return { tee: tee, ph: ph, perHole: perHole };
  }

  function groupOf(playerId) {
    return APP.groups().find((g) => (g.players || []).includes(playerId)) || null;
  }

  function starsFor(count) {
    if (count <= 0) return "";
    const label = count === 1 ? "Гандикап-удар" : count + " гандикап-удара";
    return " <span class='star' title='" + label + "'>" + "★".repeat(Math.min(count, 3)) + "</span>";
  }

  // Текущие значения из полей ввода: число или "X"
  function currentValues() {
    const vals = {};
    $$("#sc-table input[data-n]").forEach((inp) => {
      const n = Number(inp.dataset.n);
      if (inp.classList.contains("sc-flagged")) vals[n] = "X";
      else if (inp.value !== "" && !isNaN(Number(inp.value))) vals[n] = Number(inp.value);
    });
    return vals;
  }

  // Общий расчёт по набору значений (используется и для экрана, и для печати)
  function compute(vals) {
    const ti = teeInfo();
    const holes = APP.holes();
    const scf = scoringConfig();
    const useStable = scf.stableford !== false;
    const useMax = scf.maxScoreRule !== false;
    const rows = holes.map((h, i) => {
      const v = vals[h.n];
      const isNum = typeof v === "number";
      const strokes = ti.perHole[i];
      const row = { n: h.n, par: h.par, si: h.si, m: h.m, strokes: strokes, gross: isNum ? v : null, flag: isNum ? null : (v || null), net: null, st: null };
      if (isNum) {
        row.net = GolfCalc.holeResult(v, h.par, strokes, useMax).net;
        row.st = useStable ? GolfCalc.stablefordPoints(row.net - h.par) : null;
      }
      return row;
    });
    const sum = (from, to, f) => rows.slice(from, to).reduce((s, r) => (r.gross != null ? s + f(r) : s), 0);
    const played = rows.filter((r) => r.gross != null || r.flag).length;
    const numeric = rows.filter((r) => r.gross != null).length;
    return {
      ti: ti, rows: rows, useStable: useStable, numeric: numeric, played: played,
      parOut: sum(0, 9, (r) => r.par) || rows.slice(0, 9).reduce((s, r) => s + r.par, 0),
      parIn: rows.slice(9).reduce((s, r) => s + r.par, 0),
      parTotal: GolfCalc.parTotal(holes),
      gOut: sum(0, 9, (r) => r.gross), gIn: sum(9, 18, (r) => r.gross),
      nOut: sum(0, 9, (r) => r.net), nIn: sum(9, 18, (r) => r.net),
      sOut: sum(0, 9, (r) => r.st || 0), sIn: sum(9, 18, (r) => r.st || 0)
    };
  }

  // ---------- экран ----------
  function renderHead() {
    const ti = teeInfo();
    const g = groupOf(p.id);
    const sc = APP.scorecard(pid, rno) || {};
    const signed = sc.signed || null;
    const holes = APP.holes();

    let head = "<td class='sc-hole' style='width:60px'></td>";
    holes.forEach((h, i) => {
      head += "<td class='sc-hole'><b>" + h.n + "</b>par " + h.par + starsFor(ti.perHole[i]) + "</td>";
    });
    head += "<td class='sc-hole sc-out-in' style='text-align:center'>OUT</td>" +
            "<td class='sc-hole sc-out-in' style='text-align:center'>IN</td>" +
            "<td class='sc-hole sc-out-in' style='text-align:center'>Σ</td>";

    let inputs = "<td style='width:60px' class='muted small'>Результат</td>";
    holes.forEach((h) => {
      const v = sc.holes ? sc.holes[h.n] : null;
      const flagged = v === "X";
      const valAttr = flagged ? 'value="X"' : (typeof v === "number" ? 'value="' + v + '"' : 'value=""');
      const dis = signed ? " disabled" : "";
      inputs += "<td class='sc-cell'><div class='sc-cell'>" +
        '<input type="text" inputmode="numeric" autocomplete="off" aria-label="Лунка ' + h.n + '" data-n="' + h.n + '" ' + valAttr + ' class="' + (flagged ? "sc-flagged" : "") + '"' + dis + " placeholder='—'>" +
        '<div class="sc-btns">' +
        '<button type="button" data-act="dec" data-n="' + h.n + '" aria-label="Минус"' + dis + ">−</button>" +
        '<button type="button" data-act="inc" data-n="' + h.n + '" aria-label="Плюс"' + dis + ">+</button>" +
        '<button type="button" data-act="flag" data-n="' + h.n + '"' + dis + ' class="' + (flagged ? "on" : "") + '" title="X — лунка не завершена" aria-label="Пометить X">✕</button>' +
        "</div></div></td>";
    });
    inputs += "<td class='num sc-sum-out' id='cell-out'></td><td class='num sc-sum-in' id='cell-in'></td><td class='num sc-sum-tot' id='cell-tot'></td>";

    const markers = g ? g.players : [pid];
    const signedAt = signed ? new Date(signed.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
    $("#sc-main").innerHTML =
      '<section class="card">' +
      "<div style='display:flex;gap:14px;align-items:center;flex-wrap:wrap'>" + UI.avatarHtml(p, "lg") +
      "<div><div style='font-size:19px;font-weight:700'>" + UI.esc(p.lastName + " " + p.firstName) + "</div>" +
      "<div class='muted small'>" + UI.esc(p.club || "") + " · HI " + (p.hcpIndex != null ? Number(p.hcpIndex).toFixed(1) : "—") +
      " · Playing HCP <b>" + (ti.ph != null ? ti.ph : "—") + "</b> · ти " + (ti.tee ? UI.esc(ti.tee.label) : "—") +
      (g ? " · группа " + g.number + " (" + UI.esc(g.time) + ")" : "") + "</div></div>" +
      '<div style="margin-left:auto">' +
      (signed
        ? '<span class="st st-f">Подписана: ' + signedAt + " · маркер " + UI.esc(signed.marker || "") + "</span>"
        : '<span class="st st-ip">На поле</span>') +
      "</div></div>" +
      '<div class="toolbar" style="margin-top:14px;margin-bottom:0">' +
      (signed
        ? '<button class="btn btn-sm btn-danger" id="b-reopen">Открыть для правок</button>'
        : '<label class="field" style="margin:0"><span>Маркер</span><select id="marker">' +
          markers.map((id) => { const q = APP.player(id); return q ? '<option value="' + q.id + '">' + UI.esc(q.lastName + " " + q.firstName) + "</option>" : ""; }).join("") +
          "</select></label>" +
          '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="player-ok"> Игрок подтверждает результат</label>' +
          '<button class="btn btn-sm btn-primary" id="b-sign">Подписать скоркарту</button>') +
      '<button class="btn btn-sm" id="b-print-sc">Бумажная карточка (PDF)</button>' +
      "</div></section>" +
      '<div class="table-wrap" style="margin-top:16px"><table class="tbl sc-table"><tbody><tr>' + head + "</tr><tr>" + inputs + "</tr></tbody></table></div>" +
      '<section class="card" style="margin-top:16px"><div class="sc-sum" id="sc-summary"></div>' +
      '<p class="muted small" style="margin-top:12px">Net — с учётом Playing HCP и Max Score Rule (Net Double Bogey). ★ — гандикап-удар на лунке. X — лунка не завершена.</p>' +
      "</section>";

    $("#f-name").textContent = (APP.meta() || {}).name + "";
  }

  // Подтягивает значения из состояния, не трогая поле, в котором сейчас печатает пользователь
  function syncValues() {
    const sc = APP.scorecard(pid, rno) || {};
    $$("#sc-table input[data-n]").forEach((inp) => {
      if (inp === document.activeElement) return;
      const n = Number(inp.dataset.n);
      if (pendingWrites.has(n)) return;
      const v = sc.holes ? sc.holes[n] : null;
      const flagged = v === "X";
      inp.classList.toggle("sc-flagged", flagged);
      inp.value = flagged ? "X" : (typeof v === "number" ? String(v) : "");
      const fb = document.querySelector('#sc-table button[data-act="flag"][data-n="' + n + '"]');
      if (fb) fb.classList.toggle("on", flagged);
    });
  }

  function recompute() {
    const r = compute(currentValues());
    const any = r.numeric > 0;
    const parFront = r.parOut;

    $("#cell-out").innerHTML = any ? "<b>" + r.gOut + "</b><br><span class='muted small'>net " + r.nOut + "</span>" : "—";
    $("#cell-in").innerHTML = any ? "<b>" + r.gIn + "</b><br><span class='muted small'>net " + r.nIn + "</span>" : "—";
    $("#cell-tot").innerHTML = any
      ? "<b>" + (r.gOut + r.gIn) + "</b><br><span class='muted small'>net " + (r.nOut + r.nIn) + " · " + UI.fmtToPar(r.nOut + r.nIn - r.parTotal) + "</span>"
      : "—";

    const cell = (label, val, sub) =>
      '<div class="cell"><span>' + label + "</span><b>" + (val == null ? "—" : val) + "</b>" + (sub ? "<span>" + sub + "</span>" : "") + "</div>";
    $("#sc-summary").innerHTML =
      cell("Gross OUT", any ? r.gOut : null) + cell("Net OUT", any ? r.nOut : null, any ? "to par " + UI.fmtToPar(r.nOut - parFront) : "") +
      cell("Gross IN", any ? r.gIn : null) + cell("Net IN", any ? r.nIn : null, any ? "to par " + UI.fmtToPar(r.nIn - r.parIn) : "") +
      cell("Σ Gross", any ? r.gOut + r.gIn : null, any ? "to par " + UI.fmtToPar(r.gOut + r.gIn - r.parTotal) : "") +
      cell("Σ Net", any ? r.nOut + r.nIn : null, any ? "to par " + UI.fmtToPar(r.nOut + r.nIn - r.parTotal) : "") +
      cell("Stableford", r.useStable && any ? r.sOut + r.sIn : null) +
      cell("Thru", r.played ? (r.played >= 18 ? "F" : r.played) : null);

    $$("#sc-table input[data-n]").forEach((inp) => {
      const v = Number(inp.value);
      inp.classList.toggle("warn", inp.value !== "" && !inp.classList.contains("sc-flagged") && (isNaN(v) || v < 1 || v >= 12));
    });
  }

  // ---------- запись с задержкой ----------
  function queueWrite(n, value) {
    pendingWrites.set(n, value);
    clearTimeout(writeTimer);
    writeTimer = setTimeout(flushWrites, WRITE_DELAY_MS);
  }

  function flushWrites() {
    clearTimeout(writeTimer);
    writeTimer = null;
    if (!pendingWrites.size) return;
    const batch = Array.from(pendingWrites.entries());
    pendingWrites.clear();
    batch.forEach(([n, value]) => APP.set(base + "/holes/" + n, value == null ? null : value));
  }

  function writeNow(n, value) {
    pendingWrites.delete(n);
    APP.set(base + "/holes/" + n, value == null ? null : value);
  }

  function clampStrokes(v) {
    return Math.max(1, Math.min(MAX_STROKES, v));
  }

  function bindInputs() {
    $$("#sc-table input[data-n]").forEach((inp) => {
      inp.addEventListener("focus", () => inp.select());
      inp.addEventListener("input", () => {
        const n = Number(inp.dataset.n);
        const raw = inp.value.trim();
        if (raw === "") queueWrite(n, null);
        else if (!isNaN(Number(raw)) && Number(raw) >= 1) queueWrite(n, clampStrokes(Math.trunc(Number(raw))));
        recompute();
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.nativeEvent?.isComposing && e.keyCode !== 229) {
          e.preventDefault();
          const next = document.querySelector('#sc-table input[data-n="' + (Number(inp.dataset.n) + 1) + '"]');
          if (next) next.focus(); else inp.blur();
        }
      });
      inp.addEventListener("blur", () => {
        const v = Number(inp.value);
        if (inp.value !== "" && !inp.classList.contains("sc-flagged")) {
          if (!isNaN(v) && v >= 1) inp.value = clampStrokes(Math.trunc(v));
          else { inp.value = ""; queueWrite(Number(inp.dataset.n), null); }
        }
        flushWrites();
        recompute();
      });
    });
    $$("#sc-table button[data-act]").forEach((b) => {
      b.addEventListener("click", () => {
        const n = Number(b.dataset.n);
        const inp = document.querySelector('#sc-table input[data-n="' + n + '"]');
        if (!inp) return;
        const act = b.dataset.act;
        const fb = document.querySelector('#sc-table button[data-act="flag"][data-n="' + n + '"]');
        if (act === "flag") {
          const on = !inp.classList.contains("sc-flagged");
          inp.classList.toggle("sc-flagged", on);
          inp.value = on ? "X" : "";
          if (fb) fb.classList.toggle("on", on);
          writeNow(n, on ? "X" : null);
          recompute();
          return;
        }
        if (inp.classList.contains("sc-flagged")) {
          inp.classList.remove("sc-flagged");
          inp.value = "";
          if (fb) fb.classList.remove("on");
        }
        const cur = Number(inp.value);
        const holePar = (APP.holes().find((h) => h.n === n) || {}).par || 4;
        let v = inp.value === "" || isNaN(cur) ? holePar : cur;
        if (inp.value !== "" && !isNaN(cur)) v = act === "inc" ? cur + 1 : cur - 1;
        v = clampStrokes(v);
        inp.value = v;
        writeNow(n, v);
        recompute();
      });
    });
    const sign = $("#b-sign");
    if (sign) sign.addEventListener("click", () => {
      const markerSel = $("#marker");
      const ok = $("#player-ok");
      if (!ok || !ok.checked) { alert("Нужно подтверждение игрока (чекбокс)"); return; }
      const r = compute(currentValues());
      if (r.played < 18 && !confirm("Заполнены не все лунки (" + r.played + " из 18). Подписать карточку?")) return;
      flushWrites();
      const marker = markerSel ? (markerSel.options[markerSel.selectedIndex] || {}).text || "—" : "—";
      APP.set(base + "/signed", { marker: marker, player: p.lastName + " " + p.firstName, at: new Date().toISOString() });
    });
    const reopen = $("#b-reopen");
    if (reopen) reopen.addEventListener("click", () => {
      if (confirm("Открыть карточку для правок? Подпись будет снята.")) APP.set(base + "/signed", null);
    });
    const printBtn = $("#b-print-sc");
    if (printBtn) printBtn.addEventListener("click", () => { flushWrites(); buildPrint(); window.print(); });
  }

  // ---------- печать бумажной скоркарты ----------
  function buildPrint() {
    const m = APP.meta();
    const sc = APP.scorecard(pid, rno) || {};
    const r = compute(Object.assign({}, sc.holes || {}, currentValues()));
    const ti = r.ti;
    const holes = APP.holes();
    const td = (v) => "<td>" + (v == null || v === "" ? "" : v) + "</td>";
    const line = (label, cellFn, out, inn, tot) =>
      "<tr><td class='l'>" + label + "</td>" +
      r.rows.slice(0, 9).map(cellFn).join("") + td(out) +
      r.rows.slice(9).map(cellFn).join("") + td(inn) + "<td><b>" + (tot == null ? "" : tot) + "</b></td></tr>";
    const any = r.numeric > 0;
    const yd = (a, b) => holes.slice(a, b).reduce((s, h) => s + (Number(h.m) || 0), 0);

    $("#print-area").innerHTML =
      '<div class="doc"><div class="doc-header"><div><h1>' + UI.esc(m.name) + " · Скоркарта · Раунд " + rno + "</h1>" +
      "<div class='doc-sub'>" + UI.esc(p.lastName + " " + p.firstName) + " · " + UI.esc(p.club || "") + " · " + UI.fmtDate((m.dates || {})["round" + rno] || (m.dates || {}).round1) +
      " · " + (ti.tee ? UI.esc(ti.tee.label) + " (CR " + ti.tee.cr + " / Slope " + ti.tee.slope + ")" : "") + "</div></div>" +
      '<div class="doc-logo">HI ' + (p.hcpIndex != null ? Number(p.hcpIndex).toFixed(1) : "—") + " · Playing HCP: " + (ti.ph != null ? ti.ph : "—") + "<br>LIVE SCORING · ПЕСТОВО</div></div>" +
      "<table><thead>" +
      line("Лунка", (row) => "<td>" + row.n + "</td>", "OUT", "IN", "Σ") +
      "</thead><tbody>" +
      line("Par", (row) => td(row.par), r.parOut, r.parIn, r.parTotal) +
      line("Длина (м)", (row) => td(row.m), yd(0, 9), yd(9, 18), yd(0, 18)) +
      line("SI ★", (row) => td(row.si + (row.strokes > 0 ? " " + "★".repeat(Math.min(row.strokes, 3)) : "")), "", "", "") +
      line("Gross", (row) => td(row.gross != null ? row.gross : row.flag), any ? r.gOut : "", any ? r.gIn : "", any ? r.gOut + r.gIn : "") +
      line("Net", (row) => td(row.net), any ? r.nOut : "", any ? r.nIn : "", any ? r.nOut + r.nIn : "") +
      (r.useStable ? line("Stableford", (row) => td(row.st), any ? r.sOut : "", any ? r.sIn : "", any ? r.sOut + r.sIn : "") : "") +
      "</tbody></table>" +
      '<div class="doc-watermark">SCORECARD</div>' +
      '<div class="doc-footer">' +
      '<div class="sign">Подпись игрока: ____________________</div>' +
      '<div class="sign">Подпись маркера: ____________________</div>' +
      '<div class="sign">Судья: ____________________</div>' +
      '<div class="qr"><div id="pp-q1"></div>Цифровая карта</div>' +
      '<div class="qr"><div id="pp-q2"></div>Лидерборд</div></div></div>';

    UI.makeQR($("#pp-q1"), APP.url("scorecard.html", { id: pid, round: String(rno) }), 66);
    UI.makeQR($("#pp-q2"), APP.url("leaderboard.html"), 66);
  }

  function render() {
    const m = APP.meta();
    if (!m) return;
    p = APP.player(pid);
    if (!p) {
      $("#sc-main").innerHTML = '<section class="card"><h2>Игрок не найден</h2><p class="muted">Укажите ?id=… · все игроки — в <a href="startlist.html">стартовом листе</a></p></section>';
      return;
    }
    const sc = APP.scorecard(pid, rno) || {};
    const key = [p.id, p.hcpIndex, (APP.config() || {}).tee, sc.signed ? sc.signed.at : ""].join("|");
    if (key !== renderedKey || !$("#sc-table")) {
      renderedKey = key;
      renderHead();
      bindInputs();
    } else {
      syncValues();
    }
    recompute();
  }

  window.addEventListener("beforeunload", flushWrites);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushWrites(); });
  APP.subscribe(render);
})();
