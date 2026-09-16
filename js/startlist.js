// Стартовый лист: таблица, поиск, QR на группы, печать PDF (A4 альбом)
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;
  let q = "";

  function list() {
    return APP.groups().map((g) => ({
      g: g,
      members: (g.players || []).map((id) => APP.player(id)).filter(Boolean)
    }));
  }

  function render() {
    const m = APP.meta();
    if (!m) return;
    $("#f-name").textContent = m.name + " · Стартовый лист";

    const pub = m.startlistPublished;
    $("#sl-published").textContent = pub
      ? "Опубликован: " + new Date(pub).toLocaleString("ru-RU")
      : "Черновик (не опубликован)";

    let items = list();
    if (q) {
      const s = q.toLowerCase();
      items = items.filter((x) =>
        x.g.time.toLowerCase().includes(s) ||
        String(x.g.number) === s ||
        x.members.some((p) => (p.lastName + " " + p.firstName).toLowerCase().includes(s))
      );
    }

    let html =
      "<thead><tr><th>Время</th><th>Ти</th><th>Группа</th><th>Состав</th><th>QR</th></tr></thead><tbody>";
    items.forEach((x) => {
      html += "<tr>" +
        "<td class='num' style='font-size:16px'><b>" + UI.esc(x.g.time) + "</b></td>" +
        "<td class='num'>" + UI.esc(x.g.tee || "—") + "</td>" +
        "<td class='num'>" + x.g.number + "</td>" +
        "<td style='min-width:420px'><div style='display:flex;gap:16px;flex-wrap:wrap'>" +
        x.members.map((p) =>
          "<a class='sl-player' href='player.html?id=" + p.id + "' title='Карточка игрока'>" +
          UI.avatarHtml(p, "sm") +
          "<span><span class='pname'>" + UI.esc(p.lastName + " " + p.firstName) + "</span> " +
          "<span class='muted small'>" + (p.hcpIndex != null ? "HI " + p.hcpIndex.toFixed(1) : "") + "</span> " +
          UI.catChip(p.category) + "</span></a>"
        ).join("") +
        "</div></td>" +
        "<td><a class='btn btn-sm btn-ghost' href='player.html?group=" + x.g.id + "'>QR группы</a></td>" +
        "</tr>";
    });
    if (!items.length) html += "<tr><td colspan='5' class='muted'>Ничего не найдено</td></tr>";
    $("#sl-table").innerHTML = html + "</tbody>";
  }

  // ---------- печать ----------
  function buildPrint() {
    const m = APP.meta();
    const items = list();
    let body = "";
    items.forEach((x) => {
      body += "<tr><td>" + UI.esc(x.g.time) + "</td><td>" + UI.esc(x.g.tee || "—") + "</td><td>" + x.g.number + "</td>" +
        "<td class='l'>" +
        x.members.map((p) => UI.esc(p.lastName + " " + p.firstName) + " (" + (p.hcpIndex != null ? p.hcpIndex.toFixed(1) : "—") + ")").join(" · ") +
        "</td><td style='width:86px'><div class='pqr' data-g='" + x.g.id + "'></div></td></tr>";
    });
    const pub = m.startlistPublished;
    $("#print-area").innerHTML =
      '<div class="doc"><div class="doc-header">' +
      "<div><h1>" + UI.esc(m.name) + " — Стартовый лист</h1>" +
      "<div class='doc-sub'>" + UI.esc(m.subtitle || "") + " · " + UI.fmtDate((m.dates || {}).round1) +
      " · интервал " + (m.intervalMin || "—") + " мин · старт с " + (m.firstTee || 1) + "-й ти</div></div>" +
      '<div class="doc-logo">' + UI.esc((m.sponsor && m.sponsor.title) || "") + "<br>⛳ Live Scoring</div></div>" +
      '<table><thead><tr><th>Время</th><th>Ти</th><th>Группа</th><th class="l">Состав (HI)</th><th>QR группы</th></tr></thead><tbody>' +
      body + "</tbody></table>" +
      '<div class="doc-watermark">START LIST</div>' +
      '<div class="doc-footer">' +
      '<div class="sign">Главный судья: ' + UI.esc(((APP.config().committee || {}).referee) || "____________") + "</div>" +
      '<div class="sign">' + (pub ? "Опубликован: " + new Date(pub).toLocaleString("ru-RU") : "ДРАФТ — не для публикации") + "</div>" +
      '<div class="qr"><div id="print-qr-lb"></div>Лидерборд</div>' +
      '<div class="qr"><div id="print-qr-si"></div>Стартовый лист</div>' +
      "</div></div>";
    items.forEach((x) => {
      const cell = document.querySelector(".pqr[data-g='" + x.g.id + "']");
      if (cell) UI.makeQR(cell, APP.url("player.html", { group: x.g.id }), 62);
    });
    UI.makeQR($("#print-qr-lb"), APP.url("leaderboard.html"), 62);
    UI.makeQR($("#print-qr-si"), APP.url("startlist.html"), 62);
  }

  $("#f-q").addEventListener("input", (e) => { q = e.target.value.trim(); render(); });
  $("#b-print").addEventListener("click", () => { buildPrint(); window.print(); });

  const qrBox = $("#sl-qr");
  qrBox.innerHTML =
    '<div class="qr-block"><div id="sl-qr-1"></div><span class="qr-cap">Стартовый лист (общий)</span></div>' +
    '<div class="qr-block"><div id="sl-qr-2"></div><span class="qr-cap">Лидерборд</span></div>' +
    '<div class="qr-block"><div id="sl-qr-3"></div><span class="qr-cap">Local Rules</span></div>';
  UI.makeQR($("#sl-qr-1"), APP.url("startlist.html"), 120);
  UI.makeQR($("#sl-qr-2"), APP.url("leaderboard.html"), 120);
  UI.makeQR($("#sl-qr-3"), APP.url("rules.html"), 120);

  APP.subscribe(render);
})();
