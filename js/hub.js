// Страница турнира (Tournament Hub)
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;

  function kv(k, v) {
    return "<dt>" + UI.esc(k) + "</dt><dd>" + (typeof v === "string" ? UI.esc(v) : v) + "</dd>";
  }

  function render(st) {
    const m = APP.meta();
    const c = APP.config();
    if (!m) return;

    // hero
    $("#h-name").textContent = m.name;
    $("#h-subtitle").textContent = m.subtitle || "";
    $("#h-edition").textContent = m.edition || "";
    $("#h-status").innerHTML = UI.statusPill(m.status);
    const d = m.dates || {};
    const startAt = (m.roundStarts || {})["1"];
    $("#h-dates").textContent =
      "Practice day: " + UI.fmtDate(d.practiceDay) +
      " · Раунд 1: " + UI.fmtDate(d.round1) +
      (d.round2 ? " · Раунд 2: " + UI.fmtDate(d.round2) : "") +
      (startAt ? " · старт " + new Date(startAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "");

    const nr = UI.nextRoundStart(m);
    $("#cd-label").textContent = nr ? "До старта раунда " + nr.no + ":" : "";
    if (nr) UI.countdownTo(nr.at, $("#cd-live"));
    else $("#cd-live").innerHTML = '<span class="cd-zero">Все раунды завершены</span>';

    const sp = m.sponsor || {};
    $("#h-sponsors").innerHTML =
      (sp.title ? '<span class="sponsor-logo">' + UI.esc(sp.title) + "</span>" : "") +
      (sp.partners && sp.partners.length
        ? '<span>Партнёры: ' + sp.partners.map(UI.esc).join(" · ") + "</span>"
        : "");

    // формат
    const teeId = c.tee;
    const teeLbl = m.tees && m.tees[teeId] ? m.tees[teeId].label : "—";
    $("#c-format").innerHTML =
      kv("Формат", m.formatLabel || m.formatType) +
      kv("Раунды / лунок", (m.rounds || 1) + " × 18") +
      kv("Тип старта", m.startType === "tee_times" ? "Tee Times (с " + (m.firstTee || 1) + "-й ти), интервал " + (m.intervalMin || "—") + " мин" : "Shotgun Start") +
      kv("Используемые ти", teeLbl) +
      kv("Организатор", m.club ? m.club.name : "—");

    // ти
    let th = "<thead><tr><th>Ти</th><th>Par</th><th>CR</th><th>Slope</th><th></th></tr></thead><tbody>";
    Object.keys(m.tees || {}).forEach((tid) => {
      const t = m.tees[tid];
      th += "<tr><td>" + UI.esc(t.label) + "</td><td class='num'>" + t.par + "</td><td class='num'>" + t.cr + "</td><td class='num'>" + t.slope + "</td>" +
        "<td>" + (tid === teeId ? '<span class="st st-f">играем</span>' : "") + "</td></tr>";
    });
    $("#c-tees").innerHTML = th + "</tbody>";

    // клуб
    const ct = m.courseTotal || {};
    $("#c-club").innerHTML =
      kv("Гольф-клуб", m.club ? m.club.name : "—") +
      kv("Адрес", m.club ? m.club.address : "—") +
      (m.club && m.club.coords
        ? '<dt>GPS</dt><dd><a href="https://yandex.ru/maps/?ll=' + m.club.coords[1] + "%2C" + m.club.coords[0] + '&z=16" target="_blank" rel="noopener">' + m.club.coords.join(", ") + " ↗</a></dd>"
        : "") +
      kv("Поле (Par / длина)", (ct.par || "—") + " · " + (ct.m || "—") + " м (" + (ct.yd || "—") + " ярд)") +
      kv("Покрытие грина", m.green ? m.green.surface || "—" : "—") +
      kv("Скорость гринов", m.green ? m.green.stimp || "—" : "—");

    // категории
    let ch = "<thead><tr><th>Категория</th><th>Описание</th><th>Лимит</th></tr></thead><tbody>";
    (m.categories || []).forEach((cat) => {
      ch += "<tr><td>" + UI.catChip(cat.id) + "</td><td>" + UI.esc(cat.note || "—") + "</td><td class='num'>" + (m.limits ? m.limits.perCategory : "—") + "</td></tr>";
    });
    ch += "</tbody>";
    if (m.limits) ch = "<tr><td colspan='3' class='muted small'>Общий лимит участников: " + m.limits.total + "</td></tr>" + ch;
    $("#c-cats").innerHTML = ch;

    // цены
    const f = m.fees || {};
    $("#c-fees").innerHTML =
      '<div class="fee-card"><b>' + UI.fmtMoney(f.early) + "</b><span>Early Bird</span></div>" +
      '<div class="fee-card hl"><b>' + UI.fmtMoney(f.standard) + "</b><span>Standard</span></div>" +
      '<div class="fee-card"><b>' + UI.fmtMoney(f.late) + "</b><span>Late</span></div>";
    $("#c-included").innerHTML = (m.included || []).map((x) => "<li>" + UI.esc(x) + "</li>").join("");
    let oh = "<thead><tr><th>Опция</th><th>Цена</th></tr></thead><tbody>";
    (m.feeOptions || []).forEach((o) => { oh += "<tr><td>" + UI.esc(o[0]) + "</td><td class='num'>" + UI.fmtMoney(o[1]) + "</td></tr>"; });
    $("#c-options").innerHTML = oh + "</tbody>";

    // таймлайн
    const now = new Date();
    const today = m.status === "live" && d.round1 ? new Date(d.round1 + "T00:00:00") : null;
    let tl = "";
    (c.timeline || []).forEach((t) => {
      const [time, title, loc] = t;
      let cls = "";
      if (today) {
        const itemAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), time.slice(0, 2), time.slice(3, 5));
        const diffMin = (now - itemAt) / 60000;
        if (diffMin > 0 && diffMin < 60) cls = "now";
        else if (diffMin >= 60) cls = "past";
      }
      tl += '<li class="' + cls + '"><span class="t-time">' + time + '</span><span class="t-dot"></span><div class="t-title">' + UI.esc(title) + '</div><div class="t-loc">' + UI.esc(loc || "") + "</div></li>";
    });
    $("#c-timeline").innerHTML = tl;

    // QR
    const qr = $("#c-qr");
    qr.innerHTML =
      '<div class="qr-block"><div data-qr="1"></div><span class="qr-cap">Лидерборд</span></div>' +
      '<div class="qr-block"><div data-qr="2"></div><span class="qr-cap">Стартовый лист</span></div>' +
      '<div class="qr-block"><div data-qr="3"></div><span class="qr-cap">Регистрация</span></div>' +
      '<div class="qr-block"><div data-qr="4"></div><span class="qr-cap">Правила</span></div>';
    UI.makeQR(qr.querySelector('[data-qr="1"]'), APP.url("leaderboard.html"), 110);
    UI.makeQR(qr.querySelector('[data-qr="2"]'), APP.url("startlist.html"), 110);
    UI.makeQR(qr.querySelector('[data-qr="3"]'), APP.url("register.html"), 110);
    UI.makeQR(qr.querySelector('[data-qr="4"]'), APP.url("rules.html"), 110);

    // комитет
    const cm = c.committee || {};
    $("#c-committee").innerHTML =
      kv("Комитет", cm.chair || "—") +
      kv("Главный судья", cm.referee || "—") +
      kv("Стартёры", (cm.starters || []).join(" · ")) +
      kv("Скоринг", (cm.scoring || []).join(" · ")) +
      kv("Маршалы", cm.marshals || "—");
    const pp = c.paceOfPlay || {};
    $("#c-pace").innerHTML =
      kv("18 лунок", pp.total18 || "—") +
      kv("Контрольная точка", pp.check9 || "—") +
      kv("Темп", pp.perHole || "—") +
      kv("Штрафы", pp.warnings || "—");

    $("#f-name").textContent = m.name + " · " + (m.dates && m.dates.round1 || "");
  }

  APP.subscribe(render);
})();
