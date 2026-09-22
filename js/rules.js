// Правила: Conditions of Competition, Local Rules, Pace of Play + печать PDF
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;

  function render() {
    const m = APP.meta();
    const c = APP.config();
    if (!m) return;
    $("#f-name").textContent = m.name + " · Правила";

    const conds = (c.conditions || []).map((x) =>
      '<div class="cond"><h3>' + UI.esc(x[0]) + "</h3><p>" + UI.esc(x[1]) + "</p></div>").join("");

    const lr = "<div class='table-wrap'><table class='tbl'><thead><tr><th>Код</th><th>Правило</th><th>Текст</th></tr></thead><tbody>" +
      (c.localRules || []).map((r) => "<tr><td><b>" + UI.esc(r.code) + "</b></td><td>" + UI.esc(r.title) + "</td><td class='muted'>" + UI.esc(r.text) + "</td></tr>").join("") +
      "</tbody></table></div>";

    const pp = c.paceOfPlay || {};
    const pace = "<dl class='kv'>" +
      kv("Лимит 18 лунок", pp.total18) + kv("Контрольная точка", pp.check9) + kv("Темп по лункам", pp.perHole) + kv("Штрафная лестница", pp.warnings) + "</dl>";

    $("#rules-main").innerHTML =
      "<h2>Условия соревнования (Conditions of Competition)</h2>" + conds +
      "<h2 style='margin-top:22px'>Local Rules</h2>" + lr +
      "<h2 style='margin-top:22px'>Pace of Play Policy</h2>" + pace;

    function kv(k, v) { return "<dt>" + UI.esc(k) + "</dt><dd>" + UI.esc(v || "—") + "</dd>"; }
  }

  function buildPrint() {
    const m = APP.meta();
    const c = APP.config();
    const conds = (c.conditions || []).map((x) => "<h3>" + UI.esc(x[0]) + "</h3><p>" + UI.esc(x[1]) + "</p>").join("");
    const lr = "<table><thead><tr><th>Код</th><th>Правило</th><th>Текст</th></tr></thead><tbody>" +
      (c.localRules || []).map((r) => "<tr><td>" + UI.esc(r.code) + "</td><td class='l'>" + UI.esc(r.title) + "</td><td class='l'>" + UI.esc(r.text) + "</td></tr>").join("") +
      "</tbody></table>";
    const pp = c.paceOfPlay || {};
    $("#print-area").innerHTML =
      '<div class="doc"><div class="doc-header"><div><h1 style="font-size:18px">' + UI.esc(m.name) + " — Условия соревнования и Local Rules</h1>" +
      "<div class='doc-sub'>" + UI.esc(m.subtitle || "") + " · " + UI.fmtDate((m.dates || {}).round1) + "</div></div>" +
      '<div class="doc-logo">LIVE SCORING · ПЕСТОВО</div></div>' +
      "<h3>Conditions of Competition</h3>" + conds +
      "<h3>Local Rules</h3>" + lr +
      "<h3>Pace of Play</h3><p>18 лунок: " + UI.esc(pp.total18 || "") + ". " + UI.esc(pp.check9 || "") + ". " + UI.esc(pp.perHole || "") + ". Штрафы: " + UI.esc(pp.warnings || "") + "</p>" +
      '<div class="doc-footer"><div class="sign">Главный судья: ' + UI.esc(((c.committee || {}).referee) || "____________") + "</div>" +
      '<div class="sign">Подписано: ' + new Date().toLocaleString("ru-RU") + "</div>" +
      '<div class="qr"><div id="pr-qr"></div>Цифровая версия</div></div></div>';
    UI.makeQR($("#pr-qr"), APP.url("rules.html"), 66);
  }

  $("#b-print").addEventListener("click", () => { buildPrint(); window.print(); });

  const qrBox = $("#r-qr");
  UI.makeQR(qrBox, APP.url("rules.html"), 120);

  APP.subscribe(render);
})();
