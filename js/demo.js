// ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ.
// Используются, пока в Realtime Database нет данных по пути tournaments/.
// Как только ты (или система) создаст там первый турнир — сайт автоматически
// переключится на живые данные. Демо-правки сохраняются в localStorage.
(function () {
  "use strict";

  const H = (n, par, si, m) => ({ n: n, par: par, si: si, m: m, yd: Math.round(m / 0.9144) });
  const holes = [
    H(1, 4, 11, 382), H(2, 5, 2, 512), H(3, 3, 17, 156), H(4, 4, 9, 348), H(5, 4, 4, 366),
    H(6, 3, 15, 142), H(7, 4, 6, 391), H(8, 4, 13, 374), H(9, 5, 1, 528),
    H(10, 4, 8, 372), H(11, 4, 3, 358), H(12, 5, 5, 486), H(13, 3, 16, 148),
    H(14, 4, 7, 385), H(15, 4, 12, 361), H(16, 3, 10, 152), H(17, 5, 14, 505), H(18, 4, 18, 412)
  ];

  const P = (id, ln, fn, mi, born, g, club, hi, cat, tee, cart) => ({
    id: id, lastName: ln, firstName: fn, mi: mi, born: born, gender: g,
    nationality: "Россия", country: "ru", club: club, hcpIndex: hi,
    hcpUpdated: "2026-08-30", category: cat, preferredTee: tee, cart: cart,
    phone: "+7 921 000-00-" + id.slice(1), email: id + "@example.com",
    instagram: "@" + ln.toLowerCase(), status: "confirmed", photo: null,
    checkIn: { arrived: false, at: null }
  });

  const players = {
    p01: P("p01", "Фёдоров", "Николай", "А.", "1988-04-12", "m", "Гольф Клуб Волга", 1.2, "open", "championship", "individual"),
    p02: P("p02", "Иванов", "Алексей", "С.", "1979-11-03", "m", "Пестово ГК", 3.4, "open", "back", "shared"),
    p03: P("p03", "Кузнецов", "Михаил", "В.", "1991-06-25", "m", "Вологда GC", 12.5, "open", "middle", "shared"),
    p04: P("p04", "Попов", "Андрей", "И.", "1968-02-17", "m", "Пестово ГК", 8.2, "senior50", "back", "shared"),
    p05: P("p05", "Соколов", "Виктор", "П.", "1959-09-30", "m", "Кострома ГК", 15.7, "senior60", "middle", "individual"),
    p06: P("p06", "Васильев", "Сергей", "Д.", "1995-01-08", "m", "Ярославль GC", 18.3, "open", "forward", "shared"),
    p07: P("p07", "Морозов", "Павел", "А.", "2001-07-14", "m", "Пестово ГК", 21.9, "open", "forward", "shared"),
    p08: P("p08", "Григорьев", "Олег", "М.", "1983-12-01", "m", "Вологда GC", 27.4, "open", "forward", "shared"),
    p09: P("p09", "Никонова", "Анна", "В.", "1993-03-22", "f", "Москва ГК", 9.6, "ladies", "ladies", "shared"),
    p10: P("p10", "Петрова", "Елена", "С.", "1975-05-19", "f", "Пестово ГК", 14.2, "ladies", "ladies", "individual"),
    p11: P("p11", "Орлова", "Мария", "И.", "2003-10-11", "f", "СПб Гольф", 22.8, "ladies", "ladies", "shared"),
    p12: P("p12", "Смирнов", "Дмитрий", "К.", "1986-08-07", "m", "Кстово ГК", 6.8, "open", "back", "shared")
  };
  ["p01", "p02", "p03", "p04", "p12"].forEach((id, i) => {
    players[id].checkIn = { arrived: true, at: "2026-09-16T06:4" + i + ":00+03:00" };
  });
  ["p05", "p06", "p07", "p08"].forEach((id, i) => {
    players[id].checkIn = { arrived: true, at: "2026-09-16T06:5" + i + ":00+03:00" };
  });

  const SC = (arr, thru) => {
    const o = {};
    for (let i = 0; i < Math.min(thru, arr.length); i++) o[i + 1] = arr[i];
    return { holes: o };
  };

  const scorecards = {
    p01: { round1: SC([4, 3, 3, 5, 4, 3, 4, 4, 4, 4, 4, 5, 3, 4, 4, 3, 5, 3], 18) },
    p02: { round1: SC([4, 4, 3, 4, 4, 3, 5, 4, 5, 4, 3, 5, 4, 4, 4, 3, 5, 4], 18) },
    p12: { round1: SC([4, 4, 3, 4, 4, 3, 4, 4, 5, 4, 4, 5, 3, 4, 4, 3, 5, 4], 18) },
    p04: { round1: SC([4, 4, 3, 4, 4, 3, 4, 5, 5, 4, 4, 5, 3, 4, 4, 4, 5, 4], 18) },
    p03: { round1: SC([4, 5, 3, 4, 4, 4, 4, 4, 5, 5, 4, 6], 12) },
    p05: { round1: SC([4, 5, 3, 5, 4, 3, 5, 4, 5, 4, 4, 5], 12) },
    p06: { round1: SC([4, 5, 4, 4, 4, 3, 4, 4, 5, 4, 4, 5], 12) },
    p07: { round1: SC([4, 5, 3, 4, 4, 3, 4, 5, 5, 4, 4, 5], 12) },
    p08: { round1: SC([5, 5, 3, 4, 4], 5) },
    p09: { round1: SC([4, 4, 3, 4, 4], 5) },
    p10: { round1: SC([4, 4, 3, 4, 4], 5) },
    p11: { round1: SC([4, 5, 3, 4, 4], 5) }
  };

  const groups = {
    g1: { number: 1, time: "08:00", tee: 1, players: ["p01", "p02", "p12", "p04"] },
    g2: { number: 2, time: "08:08", tee: 1, players: ["p03", "p05", "p06", "p07"] },
    g3: { number: 3, time: "08:16", tee: 1, players: ["p08", "p09", "p10", "p11"] }
  };

  const prizes = {
    longestDrive: {
      hole: 2,
      entries: {
        e1: { playerId: "p03", distance: 298, at: "2026-09-16T10:12:00+03:00" },
        e2: { playerId: "p02", distance: 287, at: "2026-09-16T09:05:00+03:00" },
        e3: { playerId: "p12", distance: 291, at: "2026-09-16T09:48:00+03:00" },
        e4: { playerId: "p06", distance: 276, at: "2026-09-16T10:30:00+03:00" }
      }
    },
    closestPin: {
      holes: [6, 13],
      entries: {
        c1: { playerId: "p10", hole: 6, distance: 1.2, at: "2026-09-16T09:20:00+03:00" },
        c2: { playerId: "p09", hole: 6, distance: 2.8, at: "2026-09-16T09:26:00+03:00" },
        c3: { playerId: "p03", hole: 6, distance: 3.1, at: "2026-09-16T09:41:00+03:00" },
        c4: { playerId: "p11", hole: 6, distance: 4.5, at: "2026-09-16T10:02:00+03:00" },
        c5: { playerId: "p01", hole: 13, distance: 2.1, at: "2026-09-16T11:10:00+03:00" },
        c6: { playerId: "p10", hole: 13, distance: 5.6, at: "2026-09-16T11:24:00+03:00" }
      }
    },
    holeInOne: {
      hole: 16,
      prize: "Трофей + подарочный сертификат 50 000 ₽",
      entries: {}
    }
  };

  const meta = {
    id: "pestovo-open-2026",
    name: "Пестово Open 2026",
    subtitle: "Клубное первенство · 36 лунок",
    edition: "VII (7-й ежегодный)",
    status: "live",
    formatType: "stroke_play",
    formatLabel: "Stroke Play (gross/net) · 36 лунок · 2 раунда",
    rounds: 2,
    startType: "tee_times",
    firstTee: 1,
    intervalMin: 8,
    tee: "back",
    dates: { practiceDay: "2026-09-15", round1: "2026-09-16", round2: "2026-09-17" },
    roundStarts: { "1": "2026-09-16T08:00:00+03:00", "2": "2026-09-17T08:00:00+03:00" },
    club: {
      name: "Пестово Гольф Клуб",
      address: "Вологодская обл., г. Пестово, 1.5 км по трассе на Волгу",
      coords: [59.4789, 39.5958]
    },
    green: { surface: "Festuca rubra (фестюка)", stimp: "10.5 ft (stimpmeter, лето 2026)" },
    tees: {
      championship: { label: "Championship", par: 72, cr: 74.2, slope: 137 },
      back: { label: "Back", par: 72, cr: 72.5, slope: 132 },
      middle: { label: "Middle", par: 72, cr: 70.8, slope: 128 },
      forward: { label: "Forward", par: 72, cr: 69.4, slope: 124 },
      ladies: { label: "Ladies", par: 72, cr: 71.2, slope: 130 }
    },
    courseTotal: { par: 72, m: 6378, yd: 6975 },
    categories: [
      { id: "open", label: "Open", note: "Все игроки, HI 0–36" },
      { id: "senior50", label: "Senior Men 50+", note: "Возраст 50+" },
      { id: "senior60", label: "Senior Men 60+", note: "Возраст 60+" },
      { id: "ladies", label: "Ladies", note: "Женский флайт" }
    ],
    limits: { total: 60, perCategory: 20 },
    fees: { early: 4500, standard: 6000, late: 7500, currency: "₽" },
    included: [
      "Green fee",
      "Гольф-кар (shared, 2 игрока)",
      "Driving range — 30 мячей",
      "Welcome pack: 2 мяча, тисы, перчатка, полотенце",
      "Завтрак, обед и банкет с награждением",
      "Halfway house (лунки 9–10): напитки и снеки",
      "Страховка участника",
      "Фотограф на поле",
      "Мерч турнира"
    ],
    feeOptions: [
      ["Индивидуальный гольф-кар", 1500],
      ["Кедди", 2000],
      ["Аренда клюшек", 2500],
      ["Гостевой билет (не играющие)", 900],
      ["Мастер-класс от про", 3000],
      ["Место на банкете для +1", 2500]
    ],
    sponsor: { title: "Волга Трейд", partners: ["Пестово ГК", "Северный Свет", "ВолгаРиверБанк"] },
    announcement: null
  };

  const config = {
    active: true,
    tee: "back",
    scoring: {
      format: "stroke_play",
      playingHandicapAllowancePct: 85,
      maxScoreRule: true,
      stableford: true,
      tieBreak: "countback"
    },
    prizes: {
      longestDrive: { hole: 2, label: "Longest Drive" },
      closestPin: { holes: [6, 13], label: "Closest to the Pin" },
      holeInOne: { hole: 16, label: "Hole-in-One" }
    },
    paceOfPlay: {
      total18: "4 ч 15 мин (группа из 4)",
      check9: "2 ч 10 мин — контрольная точка на 9-й лунке",
      perHole: "Par 3 — 4 мин · Par 4 — 6 мин · Par 5 — 7 мин",
      warnings: "1-е — устное предупреждение → 2-е — письменное → штраф 1 удар → штраф 2 удара → DQ"
    },
    committee: {
      chair: "В. К. Орлов (председатель комитета)",
      referee: "А. С. Романов (главный судья)",
      starters: ["И. П. Фёдорова — 1-я ти", "Д. М. Соколов — 10-я ти"],
      scoring: ["Е. А. Ветрова", "П. П. Климов"],
      marshals: "6 маршалов: зоны 1–3, 4–6, 7–9, 10–12, 13–15, 16–18"
    },
    timeline: [
      ["05:30", "Подготовка поля: маршалы, флаги, пины", "Поле"],
      ["06:00", "Открытие driving range", "Range"],
      ["06:30", "Check-in: документы, бейджи, welcome pack", "Клубхаус, главный зал"],
      ["07:00", "Завтрак", "Ресторан"],
      ["07:15", "Открытие паттинг-грина и чиппинг-зоны", "18-й грин"],
      ["07:45", "Rules meeting (брифинг): формат, Local Rules, Pace of Play, погода", "Клубхаус, зал"],
      ["08:00", "Первый старт (tee times, 1-я ти)", "1-я ти"],
      ["10:30", "Halfway house: напитки и снеки", "Лунки 9–10"],
      ["12:30", "Приём скоркарт", "Scoring area"],
      ["13:00", "Обед", "Ресторан"],
      ["14:00", "Раунд 2 (tee times)", "1-я ти"],
      ["17:00", "Закрытие скоринга", "Scoring area"],
      ["17:30", "Публикация результатов на борде и сайте", "—"],
      ["18:00", "Церемония награждения", "Клубхаус, терраса"],
      ["19:00", "Банкет", "Ресторан"]
    ],
    localRules: [
      { code: "LR-1", title: "Водные препятствия", text: "Лунки 4, 7, 12 — жёлтые зоны. Свободный дроп в пределах 1 длины клюшки, не ближе к лунке." },
      { code: "LR-2", title: "Out of Bounds", text: "Белые колышки. Левый берег реки на лунках 14 и 15 — вне игры." },
      { code: "LR-3", title: "Drop Zones", text: "Лунки 6 и 13 — дроп-зоны с колышками (см. карту). Дроп в пределах зоны, с отступом 1 клюшки от лунки." },
      { code: "LR-4", title: "GUR (ремонт грунта)", text: "Зелёные маркеры — свободный дроп по Rule 16.1." },
      { code: "LR-5", title: "Embedded ball", text: "Допускается везде, кроме паттинг-грина (свободное снятие, Rule 16.3)." },
      { code: "LR-6", title: "Линии электропередач", text: "Лунки 2 и 17: игра под проводами только после оценки безопасности; мяч может быть снят и заменён без штрафа (Local Rule)." },
      { code: "LR-7", title: "Preferred lies", text: "Не действуют (травяной сезон)." }
    ],
    conditions: [
      ["1. Правила игры", "R&A / USGA Rules of Golf (текущая редакция)."],
      ["2. Формат и подсчёт", "Stroke Play, 36 лунок (2 раунда по 18). Классификация в категориях — по Net. Лидерборд показывает Gross и Stableford. Max Score Rule (Net Double Bogey) действует."],
      ["3. Допуск и регистрация", "Регистрация на сайте до закрытия списка. Взнос зависит от срока. Допуск подтверждает комитет; в случае превышения лимита — waitlist."],
      ["4. Гандикап", "Playing Handicap = round(HI × Slope/113 + (CR − Par) × 85%) для stroke play. Максимальный HI — 36.0. Гандикап-карта должна быть активной в федеральной системе."],
      ["5. Ти", "Men: Back (CR 72.5 / Slope 132). Ladies: Ladies (CR 71.2 / Slope 130)."],
      ["6. Мячи", "Обязательно List of Conforming Golf Balls."],
      ["7. Клюшки", "Оборудование в соответствии с Rule 4 (Conforming Equipment)."],
      ["8. Дальномеры", "Разрешены; функции slope correction — запрещены (Rule 4.3)."],
      ["9. Транспорт", "Обязательно использование гольф-кара (индивидуальный или shared на 2 игроков)."],
      ["10. Кедди", "Допускаются, по желанию (доплата 2 000 ₽)."],
      ["11. Pace of Play", "См. отдельный раздел политики темпа игры. Контрольная точка — 9-я лунка."],
      ["12. Приостановка игры", "Длинный сигнал сирены (1 мин) — немедленно остановиться. Два коротких сигнала — возобновить. Решение комитета окончательно."],
      ["13. Тай-брейк", "Countback (USGA): последние 9 лунок → последние 3 → 18-я лунка. При равенстве net-итогового результата."],
      ["14. Anti-Doping", "Турнир не находится под юрисдикцией WADA."],
      ["15. Code of Conduct", "Уважение к оппонентам, судьям, персоналу и полю. Нарушение спортивной этики — DQ."],
      ["16. Дресс-код", "Поло с воротником, гольф-брюки или юбка, гольф-обувь без металлических шипов."],
      ["17. Мобильные телефоны", "Беззвучный режим. Разговоры на поле запрещены."],
      ["18. Практика", "До раунда 1: range и паттинг-грин с 06:00, поле — не допускается. Между раундами: поле с 15:00."],
      ["19. Протесты", "Подаются в комитет не позднее 30 минут после подписания скоркарты. Депозит не требуется (клубный турнир)."]
    ]
  };

  window.DEMO = {
    id: "pestovo-open-2026",
    data: {
      meta: meta,
      config: config,
      course: { holes: holes },
      players: players,
      groups: groups,
      scorecards: scorecards,
      prizes: prizes,
      suspension: null
    }
  };
})();
