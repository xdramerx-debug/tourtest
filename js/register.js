// Регистрация участника: форма, валидация, сохранение заявки (статус pending),
// экран успеха с QR для check-in.
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;

  function formHtml(m) {
    const f = m.fees || {};
    const cats = (m.categories || []).map((c) => '<option value="' + c.id + '">' + UI.esc(c.label) + "</option>").join("");
    const tees = Object.keys(m.tees || {}).map((t) => '<option value="' + t + '">' + UI.esc(m.tees[t].label) + "</option>").join("");
    return (
      '<section class="card"><h2>Регистрация на турнир</h2>' +
      '<p class="muted small">Взнос: Early Bird ' + UI.fmtMoney(f.early) + " · Standard " + UI.fmtMoney(f.standard) + " · Late " + UI.fmtMoney(f.late) +
      ". Оплата — организатору (рецепт придёт на email после подтверждения). Поля со * обязательны.</p>" +
      "<form id='reg-form'>" +
      "<h3>Персональные данные</h3>" +
      '<div class="form-grid">' +
      field("lastName", "Фамилия *", "text", "Иванов", true) +
      field("firstName", "Имя *", "text", "Иван", true) +
      field("mi", "Отчество", "text", "Иванович") +
      field("born", "Дата рождения *", "date", "", true) +
      '<label class="field"><span>Пол *</span><select id="f-gender" required><option value="m">Мужской</option><option value="f">Женский</option></select></label>' +
      field("nationality", "Национальность", "text", "Россия") +
      field("email", "Email *", "email", "you@example.com", true) +
      field("phone", "Телефон (WhatsApp/Telegram) *", "tel", "+7 9xx xxx-xx-xx", true) +
      field("instagram", "Instagram (для отметок на фото)", "text", "@nickname") +
      "</div>" +
      "<h3>Гольф-данные</h3>" +
      '<div class="form-grid">' +
      field("club", "Домашний гольф-клуб *", "text", "Пестово ГК", true) +
      field("hcp", "Handicap Index * (0–36)", "number", "18.4", true) +
      '<div style="grid-column:1/-1" class="muted small">Формат: 0.0 – 36.0, одна цифра после запятой. Карта гандикапа должна быть активной в федеральной системе.</div>' +
      '<label class="field"><span>Preferred Tee</span><select id="f-tee">' + tees + "</select></label>" +
      field("cardNo", "Номер гандикап-карты / ID в федерации", "text", "—") +
      "</div>" +
      "<h3>Логистика</h3>" +
      '<div class="form-grid">' +
      '<label class="field"><span>Гольф-кар</span><select id="f-cart"><option value="shared">Shared (2 игрока) — включён</option><option value="individual">Индивидуальный (+1 500 ₽)</option><option value="no">Без кара</option></select></label>' +
      '<label class="field"><span>Кедди</span><select id="f-caddie"><option value="no">Не нужен</option><option value="hire">Арендовать (+2 000 ₽)</option><option value="own">Свой</option></select></label>' +
      field("dietary", "Диета / аллергии (для питания)", "text", "—") +
      field("shirt", "Размер мерча (S/M/L/XL/XXL)", "text", "L") +
      "</div>" +
      "<h3>Соревновательное</h3>" +
      '<div class="form-grid">' +
      '<label class="field"><span>Категория участия *</span><select id="f-category" required>' + cats + "</select></label>" +
      '<div class="full" style="display:flex;gap:18px;flex-wrap:wrap;padding-top:14px">' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="f-contest-ld"> Longest Drive</label>' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="f-contest-ctp"> Closest to the Pin</label>' +
      "</div>" +
      "</div>" +
      "<h3>Согласия *</h3>" +
      consent("c-rules", "Принимаю правила турнира и Conditions of Competition") +
      consent("c-privacy", "Согласен на обработку персональных данных") +
      consent("c-photo", "Согласен на использование моих фото/видео в материалах турнира") +
      consent("c-health", "Подтверждаю, что мой состояние здоровья допускает участие в соревновании") +
      consent("c-conduct", "Принимаю Code of Conduct") +
      '<div class="full" style="margin-top:6px"><button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">Отправить заявку</button></div>' +
      "</form></section>"
    );
  }

  function field(id, label, type, ph, req) {
    return '<label class="field"><span>' + label + "</span><input id='f-" + id + "' type='" + type + "' placeholder='" + UI.esc(ph || "") + "'" +
      (req ? " required" : "") + (type === "number" ? ' step="0.1" min="0" max="36"' : "") + "></label>";
  }

  function consent(id, text) {
    return '<label class="field full" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" id="' + id + '" required>' +
      '<span style="font-size:14px">' + UI.esc(text) + "</span></label>";
  }

  function successHtml(id, name) {
    return (
      '<section class="card" style="text-align:center"><h2>✓ Заявка отправлена</h2>' +
      "<p>Заявка <b>" + UI.esc(name) + "</b> получена и находится в статусе <span class='st st-ip'>ожидает подтверждения</span>. " +
      "Комитет проверит гандикап и напишет на email. После подтверждения придут: квитанция, стартовый лист и QR для check-in.</p>" +
      '<div class="qr-row" style="justify-content:center;margin-top:16px">' +
      '<div class="qr-block"><div id="ok-qr"></div><span class="qr-cap">Покажите на стойке check-in (за 15 мин до старта)</span></div>' +
      "</div>" +
      '<div class="hero-cta" style="justify-content:center;margin-top:18px">' +
      '<a class="btn" href="index.html">На главную</a><a class="btn" href="leaderboard.html">Лидерборд</a></div>' +
      "<p class='muted small' id='demo-note'></p></section>"
    );
  }

  function submit(e) {
    e.preventDefault();
    const v = (id) => ($("#f-" + id) || {}).value || "";
    const lastName = v("lastName").trim(), firstName = v("firstName").trim();
    const hcp = parseFloat(v("hcp").replace(",", "."));
    if (isNaN(hcp) || hcp < 0 || hcp > 36) { alert("Handicap Index: число от 0 до 36"); return; }
    const id = "p" + Date.now().toString(36);
    APP.set("players/" + id, {
      id: id,
      lastName: lastName,
      firstName: firstName,
      mi: v("mi").trim(),
      born: v("born"),
      gender: $("#f-gender").value,
      nationality: v("nationality") || "Россия",
      country: "ru",
      club: v("club").trim(),
      hcpIndex: hcp,
      hcpUpdated: new Date().toISOString().slice(0, 10),
      hcpCardNo: v("cardNo").trim(),
      preferredTee: v("tee"),
      category: $("#f-category").value,
      cart: $("#f-cart").value,
      caddie: $("#f-caddie").value,
      phone: v("phone").trim(),
      email: v("email").trim(),
      instagram: v("instagram").trim(),
      dietary: v("dietary").trim(),
      shirt: v("shirt").trim(),
      contests: { longestDrive: $("#f-contest-ld").checked, closestPin: $("#f-contest-ctp").checked },
      status: "pending",
      photo: null,
      checkIn: { arrived: false, at: null },
      registeredAt: new Date().toISOString()
    });
    $("#reg-main").innerHTML = successHtml(id, lastName + " " + firstName);
    UI.makeQR($("#ok-qr"), APP.url("player.html", { id: id }), 150);
    $("#demo-note").textContent = APP.state.demo
      ? "⚠ Демо-режим: заявка сохранена локально в браузере (база пуста). В боевом режиме запись уйдёт в Firebase."
      : "";
  }

  function render(st) {
    const m = APP.meta();
    if (!m) return;
    $("#f-name").textContent = m.name;
    if (!$("#reg-form")) $("#reg-main").innerHTML = formHtml(m);
  }

  // submit bubbles до #reg-main — один слушатель на всю жизнь
  $("#reg-main").addEventListener("submit", submit);
  APP.subscribe(render);
})();
