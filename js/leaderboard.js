// Лидерборд: real-time, фильтры, hole-by-hole, TV-режим, PDF (печать)
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;
  const $$ = UI.$$;
  const state = {
    round: String(SITE_CONFIG.defaultRound || ""),
    cat: "", q: "", top: 0, metric: "net",
    detail: null, hole: null, tvCat: ""
  };
  let prevPos = {};
  try { prevPos = JSON.parse(sessionStorage.getItem("lb_prev") || "{}"); } catch (e) { prevPos = {}; }
  let tvTimers = [];

  // ---------- данные ----------
  function filteredRows() {
    let rows = APP.board(state.round ? Number(state.round) : 0);
    if (state.cat) rows = rows.filter((r) => r.player.category === state.cat);
    if (state.q) {
      const q = state.q.toLowerCase();
      rows = rows.filter((r) => (r.player.lastName + " " + r.player.firstName).toLowerCase().includes(q));
    }
    if (state.top) rows = rows.slice(0, state.top);
    return rows;
  }

  function roundCells(r, useTotal) {
    const rs = useTotal ? r.perRound : [r];
    return rs.map((x) => "<td class='num'>" + (x.totalNet != null ? x.totalNet : "—") + "</td>").join("");
  }

  function toParOf(r, useTotal) {
    if (r.totalToParNet != null) return r.totalToParNet;
    if (r.totalNet == null) return null;
    const m = APP.meta();
    return r.totalNet - (m.courseTotal.par || 72) * (useTotal ? (m.rounds || 1) : 1);
  }

  // ---------- основная таблица ----------
  function renderBoard() {
    const rows = filteredRows();
    const useTotal = !state.round;
    const m = APP.meta();
    const newPrev = {};

    let head = "<thead><tr><th>Pos</th><th></th><th>Игрок</th><th>Категория</th><th>HI</th><th>PH</th>";
    if (useTotal) {
      Object.keys(m.roundStarts || {}).sort().forEach((n) => { head += "<th>R" + n + "</th>"; });
      head += "<th>Σ Net</th>";
    }
    head += "<th>To Par</th><th>Stable</th><th>Thru</th><th>Статус</th></tr></thead><tbody>";

    let body = "";
    rows.forEach((r) => {
      const p = r.player;
      const prev = prevPos[p.id];
      let dHtml = "";
      if (r.pos != null) newPrev[p.id] = r.pos;
      if (r.pos != null && prev != null) {
        const d = prev - r.pos;
        dHtml = d > 0 ? '<span class="delta-up">▲' + d + "</span>"
          : d < 0 ? '<span class="delta-down">▼' + (-d) + "</span>"
          : '<span class="delta-same">—</span>';
      }
      body += "<tr class='clickable' data-id='" + p.id + "'>" +
        "<td class='pos'>" + (r.pos == null ? "—" : (r.tied ? "T" + r.pos : r.pos)) + "</td>" +
        "<td>" + dHtml + "</td>" +
        "<td><div class='player-cell'>" + UI.avatarHtml(p) +
          "<div><div class='pname'>" + UI.esc(p.lastName + " " + p.firstName) + "</div>" +
          "<div class='pclub'>" + UI.esc(p.club || "") + "</div></div></div></td>" +
        "<td>" + UI.catChip(p.category) + "</td>" +
        "<td class='num'>" + (p.hcpIndex != null ? p.hcpIndex.toFixed(1) : "—") + "</td>" +
        "<td class='num'>" + (r.ph != null ? r.ph : "—") + "</td>" +
        roundCells(r, useTotal) +
        "<td class='num'>" + UI.fmtToPar(toParOf(r, useTotal)) + "</td>" +
        "<td class='num'>" + (r.stableford != null ? r.stableford : "—") + "</td>" +
        "<td class='num'>" + (r.thru ? (r.thru >= 18 ? "F" : r.thru + " th") : "—") + "</td>" +
        "<td>" + UI.rowStatusHtml(r.status) + "</td></tr>";
    });

    $("#lb-table").innerHTML = head + body + "</tbody>";
    $("#lb-count").textContent = rows.length + " игроков";
    $("#f-name").textContent = (m && m.name) || "";

    // позиция для сравнения на следующем обновлении
    setTimeout(() => {
      Object.keys(newPrev).forEach((k) => { prevPos[k] = newPrev[k]; });
      sessionStorage.setItem("lb_prev", JSON.stringify(prevPos));
    }, 80);

    $$("#lb-table tr.clickable").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest("[data-hole]")) return;
        openDetail(tr.dataset.id, null);
      });
    });
  }

  // ---------- hole-by-hole ----------
  function detailRoundNo() {
    const m = APP.meta();
    if (state.round) return Number(state.round);
    // total → последний раунд, где есть данные
    const rs = Object.keys(m.roundStarts || {}).sort().reverse();
    for (const n of rs) {
      if (APP.board(n).some((r) => r.totalGross != null)) return Number(n);
    }
    return rs.length ? Number(rs[rs.length - 1]) : 1;
  }

  function openDetail(pid, holeN) {
    state.detail = pid;
    state.hole = holeN || null;
    const p = APP.player(pid);
    if (!p) return;
    const rno = detailRoundNo();
    const rd = APP.roundOf(pid, rno);
    if (!rd) return;
    const strokes = GolfCalc.strokeHoleSet(APP.holes(), rd.ph);

    const cell = (row, i) => {
      const h = APP.holes()[i];
      const v = row.gross;
      const cls = GolfCalc.scoreClass(v, h.par);
      const holeAttr = "data-hole='" + h.n + "' style='cursor:pointer'";
      const star = row.stroke ? " <span class='stroke-dot' title='Гандикап-удар'>★</span>" : "";
      return "<div class='hg-cell " + cls + "'" + holeAttr + " title='Лунка " + h.n + " · par " + h.par + (row.stroke ? " · удар" : "") + "'>" +
        (v == null ? (row.flag ? row.flag : "·") : v) + "</div>";
    };

    let nums = "", pars = "", out = "", inn = "";
    for (let i = 0; i < 18; i++) {
      const h = APP.holes()[i];
      nums += "<div class='hg-n'>" + h.n + (strokes.has(i) ? " <span class='stroke-dot'>★</span>" : "") + "</div>";
      pars += "<div class='hg-par'>" + h.par + "</div>";
      if (i < 9) out += cell(rd.rows[i], i);
      else inn += cell(rd.rows[i], i);
    }

    const m = APP.meta();
    const holeStatsHtml = state.hole
      ? holeStatsBlock(state.hole, rno)
      : "<p class='muted small'>Кликните по номеру/значению лунки — статистика лунки по турниру.</p>";

    $("#lb-detail").style.display = "";
    $("#lb-detail").innerHTML =
      "<div class='detail-head'>" + UI.avatarHtml(p, "lg") +
      "<div><div style='font-size:17px;font-weight:700'>" + UI.esc(p.lastName + " " + p.firstName + " " + (p.mi || "")) + "</div>" +
      "<div class='muted small'>" + UI.esc(p.club || "") + " · HI " + (p.hcpIndex != null ? p.hcpIndex.toFixed(1) : "—") + " · Playing HCP " + (rd.ph != null ? rd.ph : "—") + " · ★ — удар</div></div>" +
      "<div style='margin-left:auto;display:flex;gap:8px'>" +
      "<a class='btn btn-sm' href='player.html?id=" + p.id + "'>Карточка</a>" +
      "<a class='btn btn-sm btn-primary' href='scorecard.html?id=" + p.id + "&round=" + rno + "'>Скоркарта</a></div></div>" +
      "<div style='overflow-x:auto'><div class='hole-grid'>" +
      "<div class='hg-n'>OUT →</div>" + out +
      "<div class='hg-cell sc-par'>OUT " + (rd.outGross || "—") + "</div>" +
      inn +
      "<div class='hg-cell sc-par'>IN " + (rd.inGross || "—") + "</div>" +
      "<div class='hg-cell sc-eb'>Σ " + (rd.totalGross != null ? rd.totalGross : "—") + "</div>" +
      "<div class='hg-n'>Hole</div>" + nums +
      "<div class='hg-par'>Par</div>" + pars +
      "<div class='hg-par' style='padding:6px 2px'></div><div class='hg-par' style='padding:6px 2px'></div><div class='hg-par' style='padding:6px 2px'></div>" +
      "</div></div>" +
      "<div style='margin-top:12px'>" + holeStatsHtml + "</div>";

    $$("#lb-detail .hg-cell[data-hole]").forEach((c) => {
      c.addEventListener("click", () => openDetail(pid, Number(c.dataset.hole)));
    });

    // подписка для live-обновления детали
  }

  function holeStatsBlock(holeN, rno) {
    const h = APP.holes()[holeN - 1];
    const s = GolfCalc.holeStats(APP.data(), rno, holeN);
    if (!s) return "<p class='muted small'>Лунка " + holeN + " (par " + (h ? h.par : "—") + "): пока нет результатов.</p>";
    return "<p class='muted small'>Лунка " + holeN + " · par " + (h ? h.par : "—") + " · SI " + (h ? h.si : "—") + ": " +
      "средний <b>" + s.avg + "</b> (" + s.count + " игроков) · лучший результат <b>" + s.best + "</b></p>";
  }

  // ---------- TV ----------
  function enterTV(withFs) {
    document.body.classList.add("tv");
    if (withFs) document.documentElement.requestFullscreen().catch(() => {});
    const clock = () => { $("#tv-clock").textContent = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
    clock();
    tvTimers.push(setInterval(clock, 1000));
    tvTimers.push(setInterval(() => {
      const cats = ["", ...((APP.meta() && APP.meta().categories) || []).map((c) => c.id)];
      state.tvCat = cats[(cats.indexOf(state.tvCat) + 1) % cats.length];
      renderTV();
    }, 12000));
    renderTV();
  }
  function exitTV() {
    tvTimers.forEach(clearInterval);
    tvTimers = [];
    document.body.classList.remove("tv");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  function renderTV() {
    if (!document.body.classList.contains("tv")) return;
    const m = APP.meta();
    $("#tv-title").textContent = m.name;
    const rl = state.round ? "Раунд " + state.round : "Total";
    const cl = state.tvCat ? UI.catLabel(state.tvCat) : "Все категории";
    $("#tv-sub").textContent = rl + " · " + cl + " · Live";
    $("#tv-cat").textContent = cl;
    let rows = APP.board(state.round ? Number(state.round) : 0);
    if (state.tvCat) rows = rows.filter((r) => r.player.category === state.tvCat);
    rows = rows.slice(0, 10);
    const useTotal = !state.round;
    let html = "<thead><tr><th>Pos</th><th>Игрок</th><th>Клуб</th>";
    if (useTotal) Object.keys(m.roundStarts || {}).sort().forEach((n) => { html += "<th>R" + n + "</th>"; });
    html += "<th>Σ Net</th><th>To Par</th><th>Thru</th></tr></thead><tbody>";
    rows.forEach((r) => {
      html += "<tr><td class='pos'>" + (r.pos == null ? "—" : (r.tied ? "T" + r.pos : r.pos)) + "</td>" +
        "<td>" + UI.esc(r.player.lastName + " " + r.player.firstName) + "</td>" +
        "<td class='muted'>" + UI.esc(r.player.club || "") + "</td>" +
        roundCells(r, useTotal) +
        "<td class='num'><b>" + (r.totalNet != null ? r.totalNet : "—") + "</b></td>" +
        "<td class='num'>" + UI.fmtToPar(toParOf(r, useTotal)) + "</td>" +
        "<td class='num'>" + (r.thru ? (r.thru >= 18 ? "F" : r.thru + " th") : "—") + "</td></tr>";
    });
    $("#tv-table").innerHTML = html + "</tbody>";
  }

  // ---------- печать ----------
  function buildPrint() {
    const m = APP.meta();
    const rows = APP.board(state.round ? Number(state.round) : 0);
    const useTotal = !state.round;
    const rl = useTotal ? "Total" : "Раунд " + state.round;
    let head = "<tr><th>Pos</th><th>Игрок</th><th>Клуб</th><th>HI</th><th>PH</th>";
    if (useTotal) Object.keys(m.roundStarts || {}).sort().forEach((n) => { head += "<th>R" + n + " Net</th>"; });
    head += "<th>Σ Net</th><th>To Par</th><th>Thru</th><th>Статус</th></tr>";
    let body = "";
    rows.forEach((r) => {
      body += "<tr><td>" + (r.pos == null ? "—" : (r.tied ? "T" + r.pos : r.pos)) + "</td>" +
        "<td class='l'>" + UI.esc(r.player.lastName + " " + r.player.firstName) + "</td>" +
        "<td class='l'>" + UI.esc(r.player.club || "") + "</td>" +
        "<td>" + (r.player.hcpIndex != null ? r.player.hcpIndex.toFixed(1) : "—") + "</td>" +
        "<td>" + (r.ph != null ? r.ph : "—") + "</td>" + roundCells(r, useTotal) +
        "<td><b>" + (r.totalNet != null ? r.totalNet : "—") + "</b></td>" +
        "<td>" + UI.fmtToPar(toParOf(r, useTotal)) + "</td>" +
        "<td>" + (r.thru ? (r.thru >= 18 ? "F" : r.thru) : "—") + "</td>" +
        "<td>" + (r.status === "finished" ? "F" : r.status) + "</td></tr>";
    });
    $("#print-area").innerHTML =
      '<div class="doc"><div class="doc-header"><div><h1>' + UI.esc(m.name) + " — " + rl + "</h1>" +
      "<div class='doc-sub'>Лидерборд · " + UI.esc(m.subtitle || "") + " · " + new Date().toLocaleString("ru-RU") + "</div></div>" +
      '<div class="doc-logo">' + UI.esc((m.sponsor && m.sponsor.title) || "") + "<br>LIVE SCORING · ПЕСТОВО</div></div>" +
      "<table><thead>" + head + "</thead><tbody>" + body + "</tbody></table>" +
      '<div class="doc-watermark">LIVE</div>' +
      '<div class="doc-footer"><div class="sign">Главный судья: ____________________</div>' +
      '<div class="sign">Время публикации: ' + new Date().toLocaleTimeString("ru-RU") + "</div>" +
      '<div class="qr"><div id="print-qr"></div>Цифровая версия</div></div></div>';
    UI.makeQR($("#print-qr"), APP.url("leaderboard.html"), 72);
  }

  // ---------- init ----------
  function render(st) {
    const m = APP.meta();
    if (!m) return;
    const rs = $("#f-round");
    if (!rs.dataset.init) {
      rs.innerHTML = '<option value="">Total</option>' +
        Object.keys(m.roundStarts || {}).sort().map((n) =>
          '<option value="' + n + '"' + (n === state.round ? " selected" : "") + ">Раунд " + n + "</option>").join("");
      rs.dataset.init = "1";
    }
    const fc = $("#f-cat");
    if (!fc.dataset.init) {
      fc.innerHTML = '<option value="">Все категории</option>' +
        (m.categories || []).map((c) => '<option value="' + c.id + '">' + UI.esc(c.label) + "</option>").join("");
      fc.dataset.init = "1";
    }
    renderBoard();
    if (state.detail) openDetail(state.detail, state.hole);
    renderTV();
  }

  $("#f-round").addEventListener("change", (e) => { state.round = e.target.value; prevPos = {}; render(APP.state); });
  $("#f-cat").addEventListener("change", (e) => { state.cat = e.target.value; render(APP.state); });
  $("#f-top").addEventListener("change", (e) => { state.top = Number(e.target.value); render(APP.state); });
  $("#f-metric").addEventListener("change", (e) => { state.metric = e.target.value; render(APP.state); });
  $("#f-q").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(APP.state); });
  $("#b-print").addEventListener("click", () => { buildPrint(); window.print(); });
  $("#b-tv").addEventListener("click", () => enterTV(true));
  $("#tv-exit").addEventListener("click", exitTV);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && document.body.classList.contains("tv")) exitTV();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("tv")) exitTV();
  });

  // QR на лидерборд
  const qrBox = $("#lb-qr");
  qrBox.innerHTML = '<div class="qr-block"><div id="lb-qr-code"></div><span class="qr-cap">Лидерборд (мобильная версия)</span></div>' +
    '<div class="qr-block"><div id="lb-qr-tv"></div><span class="qr-cap">TV-режим для экранов клуба</span></div>';
  UI.makeQR($("#lb-qr-code"), APP.url("leaderboard.html"), 120);
  UI.makeQR($("#lb-qr-tv"), APP.url("leaderboard.html", { tv: "1" }), 120);

  APP.subscribe(render);

  if (new URLSearchParams(location.search).get("tv") === "1") enterTV(false);
})();
