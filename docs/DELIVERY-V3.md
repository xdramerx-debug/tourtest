# Пестово Live Scoring — клон (v3, vanilla PWA): чек-лист поставки по брифу #3

Коммиты: `51f6a43` (этап 1), `e31c032` (этапы 2–8), следующий — polish (этой сессии).
Сборка: `pwa/` (статика, без билдера), тесты `tests/`, CI-контракты ниже.

## §3 Модель данных
- [x] users (каталог+роли+приватность), rounds (players.scores, pause/autoClose), markers (флаг игрока),
      protocols (v2 + hash + попытка перезаписи отвергается), tournaments (players/flights/cut/tiebreak),
      broadcasts (аудитории), alerts (вызовы судьи/маршала), reactions, push_subscriptions,
      settings (design/privacy/rusgolf/course), audit — покрыто contracts + E2E.
- [x] Изоляция от бэкенда: `DB` on/get/set/update/push/remove/setWithQueue/flushQueue — одинаковый
      контракт у demo (localStorage+BroadcastChannel) и Firebase RTDB (через `js/firebase-config.js`).

## §4 WHS и гольф-логика
- [x] fieldHcp `round(exact×SR/113+CR−Par)` для M/W × bk/bl/wh/rd (+fallback женский bk → мужской),
      whsIndex 8/20 (+правило 40% при <20), stroke stableford/modified, strokesReceived (+plus-игрок отдаёт с SI18),
      countback, match-play (2&1 досрочно, AS), skins с переносом, bestball, scramble (команда = линия),
      oom 100/80/70/60/55/…/10 + 5 → `node --test tests/` = 39 проверок зелёных.

## §5 Публичные страницы (19+2)
- [x] index (иерархия 6+1: мои/live/турниры-лайв/последние/курс/цифры + tools), setup-round (автопоиск,
      гость ФИО/пол/ТИ/HCP, pace-превью, ?presel из QR), solo (пэд≤5с/лунку, офлайн-очередь, pace 30с,
      пауза/статус, pickup, stable gross+net, F9/F18, kiosk `?round=&as=`), group (мульти-выбор игроков,
      чипы по парам, авто-переход когда все внесли, финиш 9/18), referee (pace+правка любого live),
      leaderboard (поиск/фильтры/раскрытие), guide (по 4 ТИ, тайминги), handicap (калькулятор+масс-таблица
      exact→field, печать), predictor (keep/−1.0 + кривая), stats (КПИ клуба, hole-статы, топ),
      players (каталог+§11 маскировка), qr-start (api.qrserver.com, bulk), qr/TV,
      tournaments (5 видов табло: таблица/сетка/TV/карточки/компакт; 3 деления: общий/M/W; 3 состава:
      флеты/алфавит/индекс; 3 карточки: полная/9-строчная/мини; DQ/WD/DNS/DNF; публикация протокола v2),
      oom (сезон), feed (анонсы+реакции+push-PushManager/VAPID/demo-fallback), tv (полноэкран + pace + тикеры),
      assistant (BM25 extractive RAG, встроенный корпус + pdf.js из CDN офлайн-толерантно),
      auth (demo admin/admin; Firebase email/pwd ветка), offline, 404-fallback в SW.

## §6 Админка (15 вкладок одним SPA-табом, аудит в /audit)
- [x] Вызовы (троттлинг 300 мс, push-рассылка «принято», закрытие); Раунды (пауза/продолжение,
      авто-закрытие >8ч); Редактор счёта (grid 18, клэмп 0..15); Pace-контроль (обновление 30с, behind/ahead);
      Мастер турнира (10 шагов, черновик автосейв 20с, шаблоны «клубный/открытый», импорт ≤500 строк CSV
      с кавычками разделителями и дедупом, флеты, cut top-N/≤par/%, HCP-пересчёт, анонс, публикация);
      Управление турнирами (end/delete/ссылки на табло); Поле (тайминги override → settings/course → runtime-merge
      во всех страницах); Протоколы (список+guard-check на повторную публикацию); Анонсы (аудитории, TG/VK
      копипаст-шаблоны, последние); Игроки (CRUD, роли, приватность); Импорт/Экспорт (4 вида JSON + CSV-ведомости,
      импорт игроков CSV); RUSGOLF (только прокси `{url}`, scopes, token в секретном settings);
      Данные (диагностика+flush очереди+стереть всё двойным подтверждением); Дизайн (превью iframe + глобальный №);
      Помощник (self-check: engine/seed/settings/SW/localStorage).

## §9 Дизайн
- [x] 6 шаблонов токенами: 0 Classic…5 Аврора-стекло; single/mix per-блок (data-dspb-* для nav/card/buttons/
      forms/stats/tables/badges/footer/tabs/round-card), per-странице (data-dsp-page), URL ?dsp=N приоритетнее БД,
      design-preview.html с кликабельными 6+микс-чипами; печать протоколов — принудительно «Классика».

## §10 PWA
- [x] manifest (ru, standalone, 3 иконки), SW precache 42 файла + runtime-очередь SYNC_SCORES + online-flush,
      update-banner, install-подсказка, сетевые исключения (open-meteo/RTDB не кэшируются), push-handler
      (Web Push), notificationclick → /pwa/. Версионирование ?v=3.2.0.

## §11 Приватность
- [x] settings/privacy maskMode all/short/per-player; `Util.showName` единая точка; гость видит маску,
      админ — всегда полное; E2E проверка режима short.

## §12 NFR
- [x] Мобильный first (viewport-fit, big-touch targets), i18n RU/EN единым словарем + data-i18n + localStorage,
      офлайн-ввод с оптимистичной записью, Pace 30с polling (не realtime-loop), доступность: aria у модалок/тостов,
      буфер одной кнопки на лунку (≤5 сек: ±3 от пара диапазон + автопереход).

## §13 Этапы
- [x] 1 фундамент; 2 вход/раунды; 3 поле+гид; 4 форматы+match countback; 5 турниры+5 видов+протоколы+ɢOoM;
      6 админка 15 вкладок+импорт+RUSGOLF-прокси; 7 push/reactions/feed/TV; 8 assistant+PDF;
      9 дизайн-шаблоны (в этапе 1+polish design); 10 PWA/офлайн/E2E/контракты.

## CI контракты (локально воспроизводимы)
- `node --test tests/` — 39 проверок (WHS/tour/assistant), `node --test firebase/functions/test/` — 3 (push-слой).
- `node scripts/check-pwa-pages.mjs` — 21 страница: существование страниц/ассеты/sw-CORE/i18n-ключи/парс инлайн-скриптов.
- `for f in pwa/js/**: node --check` — syntax. Playwright e2e `e2e/pestovo.spec.ts` (CI, порт 4040): 9 сценариев.

## Осознанные упрощения (без правил гольфа!)
- Эмиссия RUSGOLF/TG/VK — только заготовки (proxy-template/copipast), без реального кода до появления
  серверных креденшелов (как и было заявлено).
- demo-пользователи/турнир помечены __seededUsers — реальные игроки в demo не коммитятся.
- pdf.js подключается с CDN и деградирует офлайн; индекс ассистента строится в браузере (<120 стр PDF).
- Match-play — круговой внутри флетов (без плей-офф-ветки), баллы 1/0.5 — стандарт клубного уровня.
