// Карточка игрока (?id=) и цифровая группа (?group=):
// старт, группа, Playing HCP, QR, check-in, печать A6-карточки
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;
  const params = new URLSearchParams(location.search);
  const pid = params.get("id");
  const gid = params.get("group");

  function findGroup(playerId) {
    return APP.groups().find((g) => (g.players || []).includes(playerId)) || null;
  }

  function teeInfo(p) {
    const m = APP.meta(), c = APP.config();
    const teeId = (m && m.tees) ? (c.tee || Object.keys(m.tees)[0]) : null;
    const isLadies = p.gender === "f" && m.tees && m.tees.ladies;
    const tee = isLadies ? m.tees.ladies : (m.tees && m.tees[teeId]) || null;
    const ph = tee ? GolfCalc.playingHandicap(p.hcpIndex, tee.slope, tee.cr, tee.par, (c.scoring || {}).playingHandicapAllowancePct) : null;
    const strokeSet = ph ? GolfCalc.strokeHoleSet(APP.holes(), ph) : new Set();
    const strokeHoles = APP.holes().filter((h, i) => strokeSet.has(i)).map((h) => h.n).sort((a, b) => a - b);
    return { tee: tee, ph: ph, strokeHoles: strokeHoles };
  }

  function startInfo(p) {
    const g = findGroup(p.id);
    return g || null;
  }

  function scoreLine(p) {
    const m = APP.meta();
    const rs = Object.keys((m && m.roundStarts) || {}).sort();
    let html = "";
    rs.forEach((n) => {
      const r = APP.roundOf(p.id, n);
      html += "<div style='margin:4px 0'>Раунд " + n + ": " +
        (r.totalGross != null ? "Gross <b>" + r.totalGross + "</b> · Net <b>" + r.totalNet + "</b> " : "не начат") +
        (r.thru ? " · thru " + (r.thru >= 18 ? "F" : r.thru + " th") : "") + " " + UI.rowStatusHtml(r.status) + "</div>";
    });
    return html;
  }

  function renderPlayer(p) {
    const m = APP.meta();
    const g = startInfo(p);
    const ti = teeInfo(p);
    const arrived = p.checkIn && p.checkIn.arrived;

    $("#p-main").innerHTML =
      '<section class="card">' +
      '<div class="p-head">' + UI.avatarHtml(p, "lg") +
      "<div><div class='p-name'>" + UI.esc(p.lastName + " " + p.firstName + " " + (p.mi || "")) + "</div>" +
      "<div class='muted'>" + UI.esc(p.club || "") + " · " + UI.esc(p.nationality || "") + "</div>" +
      "<div style='margin-top:6px'>" + UI.catChip(p.category) +
      (arrived ? ' <span class="st st-f">✓ прибыл' + (p.checkIn.at ? " " + new Date(p.checkIn.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "") + "</span>" : ' <span class="st st-ns">не отметился</span>') +
      "</div></div>" +
      "<div style='margin-left:auto;display:flex;gap:8px;flex-wrap:wrap'>" +
      '<button class="btn btn-sm" id="b-checkin">' + (arrived ? "Снять отметку" : "✓ Отметить прибытие (check-in)") + "</button>" +
      '<button class="btn btn-sm" id="b-print">🖨 Карточка A6</button>' +
      "</div></div>" +
      "<dl class='kv' style='margin-top:16px'>" +
      kv("Handicap Index", p.hcpIndex != null ? p.hcpIndex.toFixed(1) + " (от " + (p.hcpUpdated || "—") + ")" : "—") +
      kv("Playing Handicap", ti.ph != null ? ti.ph : "—") +
      kv("Ти", ti.tee ? ti.tee.label + " · CR " + ti.tee.cr + " · Slope " + ti.tee.slope : "—") +
      kv("Гандикап-удары (по лункам)", ti.strokeHoles.length ? ti.strokeHoles.join(", ") : "нет") +
      kv("Гольф-кар", p.cart || "—") +
      kv("Телефон", p.phone || "—") +
      "</dl></section>" +

      '<div class="grid grid-2" style="margin-top:18px">' +
      '<section class="card"><h2>Старт</h2>' +
      (g
        ? '<div class="big-time">' + UI.esc(g.time) + '</div>' +
          "<div class='muted'>Группа " + g.number + " · с " + UI.esc(g.tee || 1) + "-й ти</div>" +
          "<h3>Состав группы</h3>" +
          g.players.map((id) => {
            const q = APP.player(id);
            if (!q) return "";
            return "<div style='display:flex;gap:10px;align-items:center;padding:5px 0'>" +
              UI.avatarHtml(q, "sm") +
              "<a href='player.html?id=" + q.id + "'>" + UI.esc(q.lastName + " " + q.firstName) + "</a>" +
              "<span class='muted small'>" + (q.hcpIndex != null ? "HI " + q.hcpIndex.toFixed(1) : "") + "</span></div>";
          }).join("")
        : '<p class="muted">Игрок пока не распределён в группы (см. стартовый лист).</p>') +
      "</section>" +
      '<section class="card"><h2>Счёт</h2>' + scoreLine(p) +
      '<a class="btn btn-primary" style="margin-top:10px" href="scorecard.html?id=' + p.id + '">Ввод / цифровая скоркарта</a>' +
      "</section></div>" +

      '<section class="card" style="margin-top:18px"><h2>QR-коды</h2>' +
      '<div class="qr-row">' +
      '<div class="qr-block"><div id="qr-sc"></div><span class="qr-cap">Цифровая скоркарта (ввод результатов)</span></div>' +
      '<div class="qr-block"><div id="qr-lb"></div><span class="qr-cap">Лидерборд</span></div>' +
      '<div class="qr-block"><div id="qr-rules"></div><span class="qr-cap">Local Rules</span></div>' +
      '<div class="qr-block"><div id="qr-self"></div><span class="qr-cap">Эта карточка (для бейджа)</span></div>' +
      "</div></section>";

    UI.makeQR($("#qr-sc"), APP.url("scorecard.html", { id: p.id, round: "1" }), 110);
    UI.makeQR($("#qr-lb"), APP.url("leaderboard.html"), 110);
    UI.makeQR($("#qr-rules"), APP.url("rules.html"), 110);
    UI.makeQR($("#qr-self"), APP.url("player.html", { id: p.id }), 110);

    $("#b-checkin").addEventListener("click", () => {
      if (p.checkIn && p.checkIn.arrived) {
        APP.set("players/" + p.id + "/checkIn", { arrived: false, at: null });
      } else {
        APP.set("players/" + p.id + "/checkIn", { arrived: true, at: new Date().toISOString() });
      }
    });
    $("#b-print").addEventListener("click", () => { buildPrint(p, g, ti); window.print(); });
  }

  function kv(k, v) {
    return "<dt>" + UI.esc(k) + "</dt><dd>" + (typeof v === "string" ? UI.esc(v) : v) + "</dd>";
  }

  function renderGroup(g) {
    const m = APP.meta();
    $("#p-main").innerHTML =
      '<section class="card"><h2>Группа ' + g.number + " · старт " + UI.esc(g.time) + " · " + UI.esc(g.tee || 1) + "-я ти</h2>" +
      "<div class='table-wrap'><table class='tbl'><thead><tr><th>Игрок</th><th>Категория</th><th>HI</th><th>PH</th><th>Карточка</th></tr></thead><tbody>" +
      g.players.map((id) => {
        const p = APP.player(id);
        if (!p) return "";
        const ti = teeInfo(p);
        return "<tr><td><div class='player-cell'>" + UI.avatarHtml(p) + "<div class='pname'>" + UI.esc(p.lastName + " " + p.firstName) + "</div></div></td>" +
          "<td>" + UI.catChip(p.category) + "</td>" +
          "<td class='num'>" + (p.hcpIndex != null ? p.hcpIndex.toFixed(1) : "—") + "</td>" +
          "<td class='num'>" + (ti.ph != null ? ti.ph : "—") + "</td>" +
          "<td><a class='btn btn-sm btn-ghost' href='player.html?id=" + p.id + "'>QR →</a></td></tr>";
      }).join("") +
      "</tbody></table></div>" +
      "<h3>QR группы</h3><div class='qr-row'>" +
      '<div class="qr-block"><div id="qr-self"></div><span class="qr-cap">Группа (цифровая скоркарта и состав)</span></div>' +
      '<div class="qr-block"><div id="qr-lb"></div><span class="qr-cap">Лидерборд</span></div>' +
      '<div class="qr-block"><div id="qr-rules"></div><span class="qr-cap">Local Rules</span></div>' +
      "</div></section>";
    UI.makeQR($("#qr-self"), APP.url("player.html", { group: g.id }), 120);
    UI.makeQR($("#qr-lb"), APP.url("leaderboard.html"), 120);
    UI.makeQR($("#qr-rules"), APP.url("rules.html"), 120);
  }

  // ---------- печать A6 ----------
  function buildPrint(p, g, ti) {
    const m = APP.meta();
    $("#print-area").innerHTML =
      '<div class="doc"><div class="doc-header"><div><h1 style="font-size:15px">' + UI.esc(p.lastName + " " + p.firstName) + "</h1>" +
      "<div class='doc-sub'>" + UI.esc(m.name) + " · " + UI.esc(m.subtitle || "") + "</div></div>" +
      '<div class="doc-logo">⛳<br>Live Scoring</div></div>' +
      '<table><tbody>' +
      "<tr><td class='l'>Клуб</td><td class='l'>" + UI.esc(p.club || "—") + "</td></tr>" +
      "<tr><td class='l'>Категория</td><td class='l'>" + UI.esc(UI.catLabel(p.category)) + "</td></tr>" +
      "<tr><td class='l'>Handicap Index</td><td class='l'>" + (p.hcpIndex != null ? p.hcpIndex.toFixed(1) : "—") + "</td></tr>" +
      "<tr><td class='l'>Playing HCP</td><td class='l'>" + (ti.ph != null ? ti.ph : "—") + "</td></tr>" +
      "<tr><td class='l'>Ти</td><td class='l'>" + (ti.tee ? ti.tee.label : "—") + "</td></tr>" +
      (g ? "<tr><td class='l'>Старт</td><td class='l'><b>" + UI.esc(g.time) + "</b> · группа " + g.number + " · " + UI.esc(g.tee || 1) + "-я ти</td></tr>" : "") +
      "<tr><td class='l'>Удары по лункам</td><td class='l'>" + (ti.strokeHoles.length ? ti.strokeHoles.join(", ") : "нет") + "</td></tr>" +
      (g ? "<tr><td class='l'>Группа</td><td class='l'>" + g.players.map((id) => { const q = APP.player(id); return q ? q.lastName + " " + q.firstName : ""; }).join(" · ") + "</td></tr>" : "") +
      "</tbody></table>" +
      '<div style="display:flex;gap:10px;justify-content:space-around;margin-top:12px">' +
      '<div class="qr"><div id="pp-qr1"></div>Скоркарта</div>' +
      '<div class="qr"><div id="pp-qr2"></div>Лидерборд</div>' +
      '<div class="qr"><div id="pp-qr3"></div>Правила</div></div>' +
      '<div class="doc-footer" style="margin-top:12px"><div class="sign">Сгенерировано: ' + new Date().toLocaleString("ru-RU") + "</div></div></div>";
    UI.makeQR($("#pp-qr1"), APP.url("scorecard.html", { id: p.id, round: "1" }), 66);
    UI.makeQR($("#pp-qr2"), APP.url("leaderboard.html"), 66);
    UI.makeQR($("#pp-qr3"), APP.url("rules.html"), 66);
  }

  function render(st) {
    const m = APP.meta();
    if (!m) return;
    $("#f-name").textContent = m.name;
    if (gid) {
      const g = APP.group(gid);
      if (g) { renderGroup(g); return; }
    }
    if (pid) {
      const p = APP.player(pid);
      if (p) { renderPlayer(p); return; }
    }
    $("#p-main").innerHTML =
      '<section class="card"><h2>Игрок не найден</h2>' +
      "<p class='muted'>Укажите <code>?id=…</code> (игрок) или <code>?group=…</code> (группа). Все игроки — в <a href='startlist.html'>стартовом листе</a>.</p></section>";
  }

  APP.subscribe(render);
})();
