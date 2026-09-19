/* ClubScore Live «Пестово» — глобальные дефолты (§2, §4.1).
   Курс/настройки живут в БД (settings/*); это — seed-значения и при реал-БД,
   и в демо-режиме. Версия сайта — в подвале (§12). */
(function () {
  'use strict';

  // 18 лунок, Par 72. p=par, hcp=stroke index, bk/bl/wh/rd — метры (чёрный/синий/белый/красный)
  var HOLES = [
    { p: 4, hcp: 6, bk: 356, bl: 338, wh: 320, rd: 265 },
    { p: 4, hcp: 12, bk: 377, bl: 355, wh: 332, rd: 287 },
    { p: 3, hcp: 18, bk: 127, bl: 117, wh: 107, rd: 95 },
    { p: 5, hcp: 2, bk: 521, bl: 500, wh: 477, rd: 444 },
    { p: 4, hcp: 10, bk: 390, bl: 368, wh: 346, rd: 302 },
    { p: 3, hcp: 16, bk: 173, bl: 155, wh: 139, rd: 124 },
    { p: 5, hcp: 8, bk: 516, bl: 493, wh: 469, rd: 433 },
    { p: 4, hcp: 14, bk: 341, bl: 319, wh: 297, rd: 259 },
    { p: 4, hcp: 4, bk: 421, bl: 398, wh: 375, rd: 334 },
    { p: 4, hcp: 5, bk: 383, bl: 360, wh: 336, rd: 299 },
    { p: 5, hcp: 1, bk: 534, bl: 510, wh: 485, rd: 449 },
    { p: 4, hcp: 13, bk: 356, bl: 332, wh: 308, rd: 268 },
    { p: 3, hcp: 17, bk: 159, bl: 143, wh: 127, rd: 110 },
    { p: 4, hcp: 9, bk: 392, bl: 369, wh: 346, rd: 305 },
    { p: 5, hcp: 3, bk: 529, bl: 506, wh: 482, rd: 446 },
    { p: 4, hcp: 15, bk: 344, bl: 321, wh: 299, rd: 261 },
    { p: 3, hcp: 11, bk: 186, bl: 168, wh: 149, rd: 129 },
    { p: 4, hcp: 7, bk: 408, bl: 385, wh: 361, rd: 319 }
  ];

  // Тайминги pace-of-play по лункам (мин) — §4.1
  var TIMINGS = {
    1: 15, 2: 15, 3: 20, 4: 12, 5: 15, 6: 15, 7: 15, 8: 12, 9: 20,
    10: 20, 11: 15, 12: 15, 13: 12, 14: 15, 15: 20, 16: 15, 17: 12, 18: 15
  };

  // Course/Slope Rating (WHS) — §4.1
  var RATINGS = {
    men:   { bk: { cr: 76.0, sr: 144 }, bl: { cr: 73.8, sr: 137 }, wh: { cr: 72.0, sr: 135 }, rd: { cr: 69.2, sr: 134 } },
    women: { bl: { cr: 80.8, sr: 153 }, wh: { cr: 78.6, sr: 143 }, rd: { cr: 75.2, sr: 136 } }
  };

  window.APP_CONFIG = {
    siteName: 'ГК «Пестово» · Live Scoring',
    siteVersion: '3.0.0-alpha',
    club: { name: 'Гольф-клуб «Пестово»', nameEn: 'Pestovo Golf Club', city: 'Московская обл., дер. Пестово', lat: 56.056, lon: 37.616 },
    course: { name: 'Пестово', nameEn: 'Pestovo', par: 72, holesCount: 18, holes: HOLES, timings: TIMINGS, ratings: RATINGS, holeSponsors: {} },
    tees: { bk: { ru: 'Чёрный', en: 'Black' }, bl: { ru: 'Синий', en: 'Blue' }, wh: { ru: 'Мужской белый', en: 'White' }, rd: { ru: 'Красный', en: 'Red' } },
    defaultTee: { men: 'wh', women: 'rd' },
    weather: { refreshMin: 15, timeoutMs: 6000 },
    pagination: { roundsPerPage: 30 },
    pace: { warnUpToMeanPct: 15, tickMs: 30000 },
    design: { templates: 6 }, // §9
    assistant: { maxChunks: 5, maxAnswerChars: 900 },
    rusgolfProxy: 'https://your-proxy.example/?target={url}',
    // УКАЗАТЬ ДЛЯ ПРОДАКШЕНА: замените window.FIREBASE_CONFIG на реальные ключи (js/firebase-config.js)
    // При отсутствии конфига работает встроенный demo-backend на том же контракте API.
    dbSeed: {
      demoPlayerIds: 200 // сид-масса каталога (не «реальные» люди, см. USER_FLOWS)
    }
  };
})();
