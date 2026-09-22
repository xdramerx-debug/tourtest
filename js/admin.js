// Лёгкая админка (MVP): сводка, статусы участников, check-in,
// генерация стартового листа, публикация. Полная админка — V2.
(function () {
  "use strict";
  UI.initChrome();
  const $ = UI.$;
  const $$ = UI.$$;

  function stats() {
    const ps = APP.players();
    const by = (s) => ps.filter((p) => p.status === s).length;
    const arrived = ps.filter((p) => p.checkIn && p.checkIn.arrived).length;
    const r1 = APP.board(1);
    const onCourse = r1.filter((r) => r.status === "in_progress").length;
    const finished = r1.filter((r) => r.status === "finished").length;
    const cell = (n, l) => '<div class="stat"><b>' + n + "</b><span>" + l + "</span></div>";
    $("#a-stats").innerHTML =
      cell(ps.length, "всего") + cell(by("pending"), "ожидают") + cell(by("confirmed"), "подтверждены") +
      cell(by("waitlist"), "waitlist") + cell(by("cancelled"), "отказ") + cell(arrived, "check-in") +
      cell(onCourse, "на поле (R1)") + cell(finished, "финиш (R1)");
  }

  function playersTable() {
    const ps = APP.players().sort((a, b) => (a.hcpIndex || 99) - (b.hcpIndex || 99));
    let html =
      "<thead><tr><th>Игрок</th><th>Клуб</th><th>HI</th><th>Категория</th><th>Статус</th><th>Check-in</th><th></th></tr></thead><tbody>";
    ps.forEach((p) => {
      const arrived = p.checkIn && p.checkIn.arrived;
      html +=
        "<tr>" +
        "<td><div class='player-cell'>" + UI.avatarHtml(p, "sm") + "<div class='pname'>" + UI.esc(p.lastName + " " + p.firstName) + "</div></div></td>" +
        "<td class='muted small'>" + UI.esc(p.club || "—") + "</td>" +
        "<td class='num'>" + (p.hcpIndex != null ? p.hcpIndex.toFixed(1) : "—") + "</td>" +
        "<td>" + UI.catChip(p.category) + "</td>" +
        "<td><select data-id='" + p.id + "' style='min-width:130px'>" +
        ["pending", "confirmed", "waitlist", "cancelled"].map((s) =>
          '<option value="' + s + '"' + (p.status === s ? " selected" : "") + ">" +
          { pending: "ожидаёт", confirmed: "подтверждён", waitlist: "waitlist", cancelled: "отказ" }[s] +
          "</option>").join("") +
        "</select></td>" +
        "<td><button class='btn btn-sm " + (arrived ? "" : "btn-ghost") + "' data-check='" + p.id + "'>" + (arrived ? "✓ " + new Date(p.checkIn.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—") + "</button></td>" +
        "<td><a class='btn btn-sm btn-ghost' href='scorecard.html?id=" + p.id + "'>Счёт</a></td>" +
        "</tr>";
    });
    $("#a-players").innerHTML = html + "</tbody>";

    $$("#a-players select[data-id]").forEach((sel) => {
      sel.addEventListener("change", () => APP.set("players/" + sel.dataset.id + "/status", sel.value));
    });
    $$("#a-players button[data-check]").forEach((b) => {
      b.addEventListener("click", () => {
        const p = APP.player(b.dataset.check);
        const arrived = p && p.checkIn && p.checkIn.arrived;
        APP.set(
          "players/" + b.dataset.check + "/checkIn",
          arrived ? { arrived: false, at: null } : { arrived: true, at: new Date().toISOString() }
        );
      });
    });
  }

  function startListInfo() {
    const m = APP.meta();
    const g = APP.groups();
    const pub = m.startlistPublished;
    $("#a-si-info").textContent = g.length
      ? "Групп: " + g.length + " (" + g.map((x) => x.number + ": " + x.time + " — " + (x.players || []).length + " чел").join(" · ") + ")"
      : "Группы ещё не сгенерированы.";
    const btn = $("#a-pub");
    if (pub) {
      btn.textContent = "Опубликован " + new Date(pub).toLocaleString("ru-RU") + " · снять";
      btn.onclick = () => APP.set("meta/startlistPublished", null);
    } else {
      btn.textContent = "📢 Опубликовать стартовый лист";
      btn.onclick = () => APP.set("meta/startlistPublished", new Date().toISOString());
    }
  }

  function generateStartList() {
    const m = APP.meta();
    const confirmed = APP.players()
      .filter((p) => p.status === "confirmed")
      .sort((a, b) => (a.hcpIndex == null ? 99 : a.hcpIndex) - (b.hcpIndex == null ? 99 : b.hcpIndex));
    if (!confirmed.length) {
      alert("Нет подтверждённых игроков. Сначала подтверди заявки (статус «подтверждён»).");
      return;
    }
    const size = 4;
    const interval = m.intervalMin || 8;
    let baseTime = new Date(((m.roundStarts || {})["1"]) || new Date(new Date().setHours(8, 0, 0, 0)));
    if (isNaN(baseTime)) baseTime = new Date();
    const groupsObj = {};
    for (let i = 0; i < confirmed.length; i += size) {
      const no = i / size + 1;
      const t = new Date(baseTime.getTime() + (no - 1) * interval * 60000);
      groupsObj["g" + no] = {
        number: no,
        time: t.toTimeString().slice(0, 5),
        tee: m.firstTee || 1,
        players: confirmed.slice(i, i + size).map((p) => p.id)
      };
    }
    if (confirm("Сгенерировать стартовый лист? Текущие группы будут заменены. Игроков: " + confirmed.length + " (группы по " + size + ", интервал " + interval + " мин, старт " + baseTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) + ").")) {
      APP.set("groups", groupsObj);
    }
  }

  $("#a-gen").addEventListener("click", generateStartList);
  $("#a-reset").addEventListener("click", () => {
    if (confirm("Сбросить все демо-правки (localStorage)?")) APP.resetDemo();
  });

  function render(st) {
    const m = APP.meta();
    if (!m) return;
    $("#f-name").textContent = m.name + " · Админ";
    $("#a-demo-card").style.display = st.demo ? "" : "none";
    stats();
    playersTable();
    startListInfo();
  }

  APP.subscribe(render);
})();
