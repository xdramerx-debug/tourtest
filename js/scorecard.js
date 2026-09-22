// Цифровая скоркарта: live-ввод по лункам, Net/Stableford в реальном времени,
// подписи маркера/игрока, блокировка после финализации, печать бумажной карточки.
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;
  const params = new URLSearchParams(location.search);
  const pid = params.get("id");
  const rno = Number(params.get("round") || "1");
  const base = "scorecards/" + pid + "/round" + rno;

  let p = null;

  function teeInfo() {
    const m = APP.meta(), c = APP.config();
    const tee = m.tees && m.tees[c.tee] ? m.tees[c.tee] : Object.values(m.tees || {})[0];
    const ph = tee ? GolfCalc.playingHandicap(p.hcpIndex, tee.slope, tee.cr, tee.par, (c.scoring || {}).playingHandicapAllowancePct) : null;
    return { tee: tee, ph: ph, strokes: GolfCalc.strokeHoleSet(APP.holes(), ph) };
  }

  function groupOf(playerId) {
    return APP.groups().find((g) => (g.players || []).includes(playerId)) || null;
  }

  function currentValues() {
    const vals = {};
    $$("#sc-table input[data-n]").forEach((inp) => {
      const n = Number(inp.dataset.n);
      if (!inp.classList.contains("sc-flagged") && inp.value !== "" && !isNaN(Number(inp.value))) {
        vals[n] = Number(inp.value);
      }
    });
    return vals;
  }

  function renderHead() {
    const m = APP.meta();
    const ti = teeInfo();
    const g = groupOf(p.id);
    const sc = APP.scorecard(pid, rno) || {};
    const signed = sc.signed || null;

    const holes = APP.holes();
    let head = "<div class='sc-hole' style='width:60px'></div>";
    for (let i = 0; i < 18; i++) {
      const h = holes[i];
      head += "<td class='sc-hole'><b>" + h.n + "</b>par " + h.par +
        (ti.strokes.has(i) ? " <span class='star' title='Гандикап-удар'>★</span>" : "") + "</td>";
    }
    head += "<td class='sc-hole sc-out-in' colspan='1' style='text-align:center'>OUT</td>" +
            "<td class='sc-hole sc-out-in' style='text-align:center'>IN</td>" +
            "<td class='sc-hole sc-out-in' style='text-align:center'>Σ</td>";

    let inputs = "<td style='width:60px' class='muted small'>Результат</td>";
    for (let i = 0; i < 18; i++) {
      const h = holes[i];
      const v = sc.holes ? sc.holes[h.n] : null;
      const flagged = v === "X";
      const cls = flagged ? "sc-flagged" : "";
      const valAttr = flagged ? 'value="X"' : (v != null ? 'value="' + v + '"' : 'value=""');
      inputs += "<td class='sc-cell'><div class='sc-cell'>" +
        '<input type="text" inputmode="numeric" data-n="' + h.n + '" ' + valAttr + ' class="' + cls + '"' + (signed ? " disabled" : "") + " placeholder='—'>" +
        '<div class="sc-btns">' +
        '<button data-act="dec" data-n="' + h.n + '"' + (signed ? " disabled" : "") + ">−</button>" +
        '<button data-act="inc" data-n="' + h.n + '"' + (signed ? " disabled" : "") + ">+</button>" +
        '<button data-act="flag" data-n="' + h.n + '"' + (signed ? " disabled" : "") + ' class="' + (flagged ? "on" : "") + '" title="X — лунка не завершена / пометка">✕</button>' +
        "</div></div></td>";
    }
    inputs += "<td class='num sc-sum-out' id='cell-out'></td><td class='num sc-sum-in' id='cell-in'></td><td class='num sc-sum-tot' id='cell-tot'></td>";

    const markers = g ? g.players : [pid];
    $("#sc-main").innerHTML =
      '<section class="card">' +
      "<div style='display:flex;gap:14px;align-items:center;flex-wrap:wrap'>" + UI.avatarHtml(p, "lg") +
      "<div><div style='font-size:19px;font-weight:700'>" + UI.esc(p.lastName + " " + p.firstName) + "</div>" +
      "<div class='muted small'>" + UI.esc(p.club || "") + " · HI " + (p.hcpIndex != null ? p.hcpIndex.toFixed(1) : "—") +
      " · Playing HCP <b>" + (ti.ph != null ? ti.ph : "—") + "</b> · ти " + (ti.tee ? ti.tee.label : "—") +
      (g ? " · группа " + g.number + " (" + UI.esc(g.time) + ")" : "") + "</div></div>" +
      '<div style="margin-left:auto">' +
      (signed
        ? '<span class="st st-f">Подписана: ' + new Date(signed.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) + " · маркер " + UI.esc(signed.marker || "") + "</span>"
        : '<span class="st st-ip">На поле</span>') +
      "</div></div>" +
      (signed
        ? '<div class="toolbar" style="margin-top:14px;margin-bottom:0">' +
          '<button class="btn btn-sm btn-danger" id="b-reopen">Открыть для правок</button>' +
          '<button class="btn btn-sm" id="b-print-sc">🖨 Бумажная карточка (PDF)</button>' +
          "</div>"
        : '<div class="toolbar" style="margin-top:14px;margin-bottom:0">' +
          '<label class="field" style="margin:0"><span>Маркер</span><select id="marker">' +
          markers.map((id) => { const q = APP.player(id); return q ? '<option value="' + q.id + '">' + UI.esc(q.lastName + " " + q.firstName) + "</option>" : ""; }).join("") +
          "</select></label>" +
          '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="player-ok"> Игрок подтверждает результат</label>' +
          '<button class="btn btn-sm btn-primary" id="b-sign">✓ Подписать скоркарту</button>' +
          '<button class="btn btn-sm" id="b-print-sc">🖨 Бумажная карточка (PDF)</button>' +
          "</div>"
      ) +
      "</section>" +
      '<div class="table-wrap" style="margin-top:16px"><table class="tbl sc-table"><tbody><tr>' + head + "</tr><tr>" + inputs + "</tr></tbody></table></div>" +
      '<section class="card" style="margin-top:16px"><div class="sc-sum" id="sc-summary"></div>' +
      '<p class="muted small" style="margin-top:12px">Net — с учётом Playing HCP и Max Score Rule (NDB). Цвет: birdie красный, par зелёный, bogey синий, double — тёмно-синий, triple+ — чёрный. X — лунка не завершена.</p>' +
      "</section>";

    $("#f-name").textContent = (APP.meta() || {}).name + "";
  }

  function recompute() {
    const m = APP.meta();
    const c = APP.config() || {};
    const ti = teeInfo();
    const holes = APP.holes();
    const vals = currentValues();
    const useStable = (c.scoring || {}).stableford !== false;
    const useMax = (c.scoring || {}).maxScoreRule !== false;
    let gOut = 0, gIn = 0, nOut = 0, nIn = 0, st = 0, played = 0;
    const playedAny = Object.keys(vals).length;
    holes.forEach((h, i) => {
      const v = vals[h.n];
      if (v == null) return;
      played++;
      const g = v;
      const stroke = ti.strokes.has(i) ? 1 : 0;
      let net = g - stroke;
      if (useMax && net > GolfCalc.netDoubleBogey(h.par, stroke)) net = GolfCalc.netDoubleBogey(h.par, stroke);
      if (i < 9) { gOut += g; nOut += net; } else { gIn += g; nIn += net; }
      if (useStable) st += GolfCalc.stablefordPoints(net - h.par);
    });
    const totalG = gOut + gIn, totalN = nOut + nIn;
    const totPar = m.courseTotal.par || 72;

    const cls = (g) => g == null ? "" : GolfCalc.scoreClass(g, totPar / 2 || g);
    $("#cell-out").innerHTML = playedAny ? "<b>" + gOut + "</b><br><span class='muted small'>net " + nOut + "</span>" : "—";
    $("#cell-in").innerHTML = playedAny ? "<b>" + gIn + "</b><br><span class='muted small'>net " + nIn + "</span>" : "—";
    $("#cell-tot").innerHTML = playedAny ? "<b>" + totalG + "</b><br><span class='muted small'>net " + totalN + " · " + UI.fmtToPar(totalN - totPar) + "</span>" : "—";

    const cell = (label, val, sub) =>
      '<div class="cell"><span>' + label + "</span><b>" + (val == null ? "—" : val) + "</b>" + (sub ? '<span>' + sub + "</span>" : "") + "</div>";
    $("#sc-summary").innerHTML =
      cell("Гross OUT", gOut || "—") + cell("Net OUT", playedAny ? nOut : "—", "to par " + UI.fmtToPar(nOut - (m.courseTotal.par ? Math.round(m.courseTotal.par / 2) : 36))) +
      cell("Gross IN", gIn || "—") + cell("Net IN", playedAny ? nIn : "—") +
      cell("Σ Gross", totalG || "—") + cell("Σ Net", playedAny ? totalN : "—", "to par " + UI.fmtToPar(totalN - totPar)) +
      cell("Stableford", st || "—") + cell("Thru", played ? (played >= 18 ? "F (finished)" : played + " th") : "—");

    // подсветка предупреждений (0 или >=12)
    $$("#sc-table input[data-n]").forEach((inp) => {
      const v = Number(inp.value);
      inp.classList.toggle("warn", !isNaN(v) && (v < 1 || v >= 12));
    });
  }

  function writeHole(n, value) {
    APP.set(base + "/holes/" + n, value == null ? null : value);
  }

  function bindInputs() {
    $$("#sc-table input[data-n]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const n = Number(inp.dataset.n);
        const raw = inp.value.trim();
        if (raw === "") writeHole(n, null);
        else if (!isNaN(Number(raw))) writeHole(n, Number(raw));
        recompute();
      });
      inp.addEventListener("blur", () => {
        const v = Number(inp.value);
        if (inp.value !== "" && !isNaN(v)) inp.value = v;
      });
    });
    $$("#sc-table button[data-act]").forEach((b) => {
      b.addEventListener("click", () => {
        const n = Number(b.dataset.n);
        const inp = document.querySelector('#sc-table input[data-n="' + n + '"]');
        if (!inp) return;
        const act = b.dataset.act;
        if (act === "flag") {
          if (inp.classList.contains("sc-flagged")) { inp.classList.remove("sc-flagged"); inp.value = ""; writeHole(n, null); }
          else { inp.classList.add("sc-flagged"); inp.value = "X"; writeHole(n, "X"); }
          b.classList.toggle("on");
          recompute();
          return;
        }
        if (inp.classList.contains("sc-flagged")) {
          inp.classList.remove("sc-flagged");
          inp.value = "";
          const fb = document.querySelector('#sc-table button[data-act="flag"][data-n="' + n + '"]');
          if (fb) fb.classList.remove("on");
          writeHole(n, null);
        }
        let v = Number(inp.value || 0) || 0;
        v = act === "inc" ? v + 1 : v - 1;
        if (v < 1) v = 1;
        if (v > 15) v = 15;
        inp.value = v;
        writeHole(n, v);
        recompute();
      });
    });
    const sign = $("#b-sign");
    if (sign) sign.addEventListener("click", () => {
      const markerSel = $("#marker");
      const ok = $("#player-ok");
      if (!ok || !ok.checked) { alert("Нужно подтверждение игрока (чекбокс)"); return; }
      const marker = markerSel ? (markerSel.options[markerSel.selectedIndex] || {}).text || "— " : "—";
      APP.set(base + "/signed", { marker: marker, player: p.lastName + " " + p.firstName, at: new Date().toISOString() });
    });
    const reopen = $("#b-reopen");
    if (reopen) reopen.addEventListener("click", () => {
      if (confirm("Открыть карточку для правок? Подпись будет снята.")) APP.set(base + "/signed", null);
    });
  }

  // ---------- печать бумажной скоркарты ----------
  function buildPrint() {
    const m = APP.meta();
    const ti = teeInfo();
    const holes = APP.holes();
    const sc = APP.scorecard(pid, rno) || {};
    const vals = {};
    (sc.holes || {}).forEach((v, k) => { vals[k] = v; });

    const row = (label, fn) => {
      let r = "<tr><td class='l'><b>" + label + "</b></td>";
      for (let i = 0; i < 18; i++) r += "<td>" + fn(holes[i], i) + "</td>";
      return r + "</tr>";
    };

    let par = "", yd = "", si = "", gross = "", net = "", stable = "";
    let sPar = [0, 0], sYd = [0, 0];
    holes.forEach((h, i) => {
      par += "<td>" + h.par + "</td>";
      yd += "<td>" + h.m + "</td>";
      si += "<td>" + h.si + (ti.strokes.has(i) ? " ★" : "") + "</td>";
      const v = vals[h.n];
      const isNum = typeof v === "number";
      gross += "<td>" + (v == null ? "" : v) + "</td>";
      if (isNum) {
        const stroke = ti.strokes.has(i) ? 1 : 0;
        let n = v - stroke;
        if (n > GolfCalc.netDoubleBogey(h.par, stroke)) n = GolfCalc.netDoubleBogey(h.par, stroke);
        net += "<td>" + n + "</td>";
        stable += "<td>" + GolfCalc.stablefordPoints(n - h.par) + "</td>";
      } else { net += "<td>—</td>"; stable += "<td>—</td>"; }
      sPar[i < 9 ? 0 : 1] += h.par;
      sYd[i < 9 ? 0 : 1] += h.m;
    });
    const gTot = (r) => { let s = 0; holes.forEach((h, i) => { const v = vals[h.n]; if (typeof v === "number") s += (i < r ? 0 : r ? v : v); }); return s; };

    $("#print-area").innerHTML =
      '<div class="doc"><div class="doc-header"><div><h1>' + UI.esc(m.name) + " · Скоркарта · Раунд " + rno + "</h1>" +
      "<div class='doc-sub'>" + UI.esc(p.lastName + " " + p.firstName) + " · " + UI.esc(p.club || "") + " · " + UI.fmtDate((m.dates || {}).round1) +
      " · " + (ti.tee ? ti.tee.label + " (CR " + ti.tee.cr + " / Slope " + ti.tee.slope + ")" : "") + "</div></div>" +
      '<div class="doc-logo">Playing HCP: ' + (ti.ph != null ? ti.ph : "—") + "<br>⛳ Live Scoring</div></div>" +
      "<table><thead><tr><td class='l'>Лунка</td>" +
      holes.slice(0, 9).map((h) => "<td>" + h.n + "</td>").join("") +
      "<td>OUT</td>" + holes.slice(9).map((h) => "<td>" + h.n + "</td>").join("") + "<td>IN</td><td>Σ</td></tr></thead><tbody>" +
      "<tr><td class='l'>Par</td>" + par + "<td>" + sPar[0] + "</td><td>" + sPar[1] + "</td><td>" + (sPar[0] + sPar[1]) + "</td></tr>" +
      "<tr><td class='l'>Длина (м)</td>" + yd + "<td>" + sYd[0] + "</td><td>" + sYd[1] + "</td><td>" + (sYd[0] + sYd[1]) + "</td></tr>" +
      "<tr><td class='l'>SI ★</td>" + si + "<td></td><td></td><td></td></tr>" +
      "<tr><td class='l'>Gross</td>" + gross + "<td id='pg-o'></td><td id='pg-i'></td><td><b id='pg-t'></b></td></tr>" +
      "<tr><td class='l'>Net</td>" + net + "<td id='pn-o'></td><td id='pn-i'></td><td id='pn-t'></td></tr>" +
      "<tr><td class='l'>Stableford</td>" + stable + "<td id='ps-o'></td><td id='ps-i'></td><td id='ps-t'></td></tr>" +
      "</tbody></table>" +
      '<div class="doc-watermark">SCORECARD</div>' +
      '<div class="doc-footer">' +
      '<div class="sign">Подпись игрока: ____________________</div>' +
      '<div class="sign">Подпись маркера: ____________________</div>' +
      '<div class="sign">Судья: ____________________</div>' +
      '<div class="qr"><div id="pp-q1"></div>Цифровая карта</div>' +
      '<div class="qr"><div id="pp-q2"></div>Лидерборд</div></div></div>';

    const q1 = $("#pp-q1"), q2 = $("#pp-q2");
    UI.makeQR(q1, APP.url("scorecard.html", { id: pid, round: String(rno) }), 66);
    UI.makeQR(q2, APP.url("leaderboard.html"), 66);
    // итоги для печати (внестраничный script выше может не успеть — считаем сразу здесь)
    const sumRow = (fn) => {
      let a = [0, 0], t = 0;
      holes.forEach((h, i) => {
        const x = vals[h.n];
        if (typeof x === "number") { const v = fn(x, i); a[i < 9 ? 0 : 1] += v; t += v; }
      });
      return [a[0], a[1], t];
    };
    const setIds = (pre, a) => {
      const o = document.getElementById(pre + "-o"), ii = document.getElementById(pre + "-i"), tt = document.getElementById(pre + "-t");
      if (o) o.textContent = a[0] || "";
      if (ii) ii.textContent = a[1] || "";
      if (tt) tt.textContent = a[2] || "";
    };
    const parArr = holes.map((h) => h.par);
    const strokeArr = Array.from(ti.strokes);
    const gSum = sumRow((x) => x);
    const nSum = sumRow((x, i) => {
      const st = strokeArr.indexOf(i) >= 0 ? 1 : 0;
      let n = x - st;
      if (n > 2 * parArr[i] - st) n = 2 * parArr[i] - st;
      return n;
    });
    const sSum = sumRow((x, i) => {
      const st = strokeArr.indexOf(i) >= 0 ? 1 : 0;
      let n = x - st;
      if (n > 2 * parArr[i] - st) n = 2 * parArr[i] - st;
      const d = n - parArr[i];
      return d <= 0 ? 5 : d === 1 ? 4 : d === 2 ? 3 : d === 3 ? 2 : d === 4 ? 1 : 0;
    });
    setIds("pg", gSum); setIds("pn", nSum); setIds("ps", sSum);
  }

  function render(st) {
    const m = APP.meta();
    if (!m) return;
    p = APP.player(pid);
    if (!p) {
      $("#sc-main").innerHTML = '<section class="card"><h2>Игрок не найден</h2><p class="muted">Укажите ?id=… · все игроки — в <a href="startlist.html">стартовом листе</a></p></section>';
      return;
    }
    renderHead();
    bindInputs();
    recompute();
    const printBtn = $("#b-print-sc");
    if (printBtn) printBtn.addEventListener("click", () => { buildPrint(); window.print(); }, { once: true });
  }

  APP.subscribe(render);
})();
