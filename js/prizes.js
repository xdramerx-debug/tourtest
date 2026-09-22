// Специальные призы: Longest Drive, Closest to the Pin, Hole-in-One.
// Live-лидерборды + формы ввода для маршалов (QR на ти-боксах).
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;
  const $$ = UI.$$;

  function entriesOf(obj) {
    return Object.values(obj || {});
  }

  function playerOptions(sel) {
    return APP.players()
      .filter((p) => p.status !== "cancelled")
      .map((p) => '<option value="' + p.id + '"' + (sel === p.id ? " selected" : "") + ">" + UI.esc(p.lastName + " " + p.firstName) + "</option>")
      .join("");
  }

  function leaderBlock(e, p) {
    if (!e) return "<p class='muted'>Пока нет результатов</p>";
    const pl = APP.player(e.playerId);
    return (
      '<div class="leader">' + UI.avatarHtml(pl || {}) +
      "<div><b>" + UI.esc(pl ? pl.lastName + " " + pl.firstName : e.playerId) + "</b>" +
      '<div class="muted small">' + UI.esc((pl && pl.club) || "") + "</div></div>" +
      '<span class="val">' + e.distance + (e.distance > 100 ? " м" : " м") + "</span></div>"
    );
  }

  function listHtml(es, i) {
    if (!es.length) return "";
    return "<ol class='muted small' style='padding-left:20px;margin:8px 0 0'>" + es.map((e) => {
      const p = APP.player(e.playerId);
      return "<li>" + UI.esc(p ? p.lastName + " " + p.firstName : e.playerId) + " — <b>" + e.distance + " м</b></li>";
    }).join("") + "</ol>";
  }

  function render() {
    const m = APP.meta();
    const c = APP.config();
    if (!m) return;
    $("#f-name").textContent = m.name + " · Призы";
    const pz = c.prizes || {};
    const P = (APP.data() || {}).prizes || {};
    const ld = P.longestDrive || {};
    const cp = P.closestPin || {};
    const ho = P.holeInOne || {};

    const ldE = entriesOf(ld.entries).sort((a, b) => b.distance - a.distance);
    const cpE = entriesOf(cp.entries);
    const cpByHole = {};
    (cp.holes || []).forEach((h) => { cpByHole[h] = cpE.filter((e) => e.hole === h).sort((a, b) => a.distance - b.distance); });
    const hoE = entriesOf(ho.entries);

    $("#pr-main").innerHTML =
      '<div class="grid grid-3">' +
      '<section class="card prize-card"><h2>🏌️ Longest Drive</h2>' +
      '<p class="muted small">Лунка ' + (pz.longestDrive ? pz.longestDrive.hole : "—") + " (par " + (APP.holes()[pz.longestDrive ? pz.longestDrive.hole - 1 : 0] ? APP.holes()[pz.longestDrive ? pz.longestDrive.hole - 1 : 0].par : "—") + ") · мяч должен быть на фервее · замер лазерным дальномером</p>" +
      leaderBlock(ldE[0]) + listHtml(ldE.slice(1, 5), 1) +
      '<h3>Ввод результата (маршал)</h3>' +
      '<form data-form="ld"><div class="form-grid">' +
      '<label class="field full"><span>Игрок</span><select data-k="playerId">' + playerOptions() + "</select></label>" +
      '<label class="field"><span>Расстояние, м *</span><input data-k="distance" type="number" min="0" max="400" required></label>' +
      '<div class="full"><button class="btn btn-sm btn-primary" type="submit">Сохранить</button></div>' +
      "</div></form></section>" +

      '<section class="card prize-card"><h2>📍 Closest to the Pin</h2>' +
      '<p class="muted small">Лунки ' + (cp.holes || []).join(", ") + " (par 3) · замер рулеткой до центра лунки</p>" +
      (cp.holes || []).map((h) => {
        const top = cpByHole[h][0];
        const pl = top && APP.player(top.playerId);
        return "<h3>Лунка " + h + "</h3>" +
          (top ? '<div class="leader">' + UI.avatarHtml(pl || {}) + "<b>" + UI.esc(pl ? pl.lastName + " " + pl.firstName : "") + '</b><span class="val">' + top.distance + " м</span></div>" + listHtml(cpByHole[h].slice(1, 4)) : "<p class='muted'>Нет замеров</p>");
      }).join("") +
      '<h3>Ввод замера (маршал)</h3>' +
      '<form data-form="ctp"><div class="form-grid">' +
      '<label class="field full"><span>Игрок</span><select data-k="playerId">' + playerOptions() + "</select></label>" +
      '<label class="field"><span>Лунка</span><select data-k="hole">' + (cp.holes || []).map((h) => '<option value="' + h + '">Лунка ' + h + "</option>").join("") + "</select></label>" +
      '<label class="field"><span>Расстояние, м *</span><input data-k="distance" type="number" step="0.1" min="0" max="100" required></label>' +
      '<div class="full"><button class="btn btn-sm btn-primary" type="submit">Сохранить</button></div>' +
      "</div></form></section>" +

      '<section class="card prize-card"><h2>🎯 Hole-in-One</h2>' +
      '<p class="muted small">Лунка ' + (pz.holeInOne ? pz.holeInOne.hole : "—") + " · приз: " + UI.esc(ho.prize || (pz.holeInOne && pz.holeInOne.prize) || "—") + "</p>" +
      (hoE.length
        ? hoE.map((e) => { const p = APP.player(e.playerId); return '<div class="leader">' + UI.avatarHtml(p || {}) + "<b>" + UI.esc(p ? p.lastName + " " + p.firstName : e.playerId) + "</b><span class='val'>🏆</span></div>"; }).join("")
        : "<p class='muted'>Пока никто — лунка жива. Удачи!</p>") +
      "<h3>Порядок фиксации</h3>" +
      '<ul class="muted small" style="padding-left:18px;margin:4px 0 10px"><li>Два свидетеля + видеозапись</li><li>Подпись судьи на месте</li><li>Протокол генерируется автоматически (V2)</li></ul>' +
      '<h3>Сообщить о hole-in-one</h3>' +
      '<form data-form="hoi"><div class="form-grid">' +
      '<label class="field full"><span>Игрок</span><select data-k="playerId">' + playerOptions() + "</select></label>" +
      '<label class="field"><span>Свидетель 1</span><input data-k="w1"></label>' +
      '<label class="field"><span>Свидетель 2</span><input data-k="w2"></label>' +
      '<div class="full"><button class="btn btn-sm btn-primary" type="submit">Внести</button></div>' +
      "</div></form></section>" +
      "</div>" +
      '<section class="card" style="margin-top:18px"><h2>QR для ти-боксов</h2>' +
      "<div class='qr-row'>" +
      '<div class="qr-block"><div id="pr-qr-ld"></div><span class="qr-cap">Ввод Longest Drive (ти лунки)</span></div>' +
      '<div class="qr-block"><div id="pr-qr-ctp"></div><span class="qr-cap">Ввод Closest to the Pin (у грина)</span></div>' +
      "</div></section>";

    UI.makeQR($("#pr-qr-ld"), APP.url("prizes.html", { form: "ld" }), 110);
    UI.makeQR($("#pr-qr-ctp"), APP.url("prizes.html", { form: "ctp" }), 110);

    // формы
    $$("form[data-form]").forEach((f) => {
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const kind = f.dataset.form;
        const get = (k) => (f.querySelector("[data-k='" + k + "']") || {}).value;
        const now = { at: new Date().toISOString() };
        if (kind === "ld") {
          APP.push("prizes/longestDrive/entries", Object.assign({ playerId: get("playerId"), distance: Number(get("distance")) }, now));
        } else if (kind === "ctp") {
          APP.push("prizes/closestPin/entries", Object.assign({ playerId: get("playerId"), hole: Number(get("hole")), distance: Number(get("distance")) }, now));
        } else if (kind === "hoi") {
          APP.push("prizes/holeInOne/entries", Object.assign({ playerId: get("playerId"), w1: get("w1"), w2: get("w2") }, now));
        }
        f.reset();
      });
    });
  }

  APP.subscribe(render);
})();
