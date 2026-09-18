# Live Scoring — Пестово (гльф-турнир)

Система организации гольф-турнира уровня European Tour, адаптированная под клуб:
чистый HTML/JS + **Firebase Realtime Database** (без сборщика, без бэкенда).

## Страницы

| Страница | Назначение |
|---|---|
| `index.html` | Tournament Hub: баннер, обратный отсчёт, формат, ти/CR/Slope, цены, расписание, QR |
| `leaderboard.html` | Live-лидерборд (real-time), позиции с countback, hole-by-hole, **TV-режим** (`?tv=1`), PDF |
| `startlist.html` | Стартовый лист: tee times, группы, QR, PDF A4 |
| `player.html` | Карточка игрока (?id=) / группа (?group=): PH, удары, check-in, QR, печать A6 |
| `scorecard.html` | Цифровая скоркарта: live-ввод по QR, Net/Stableford/NDB, подписи, печать A4 |
| `register.html` | Регистрация участника (заявка → pending → QR для check-in) |
| `prizes.html` | Longest Drive / Closest to the Pin / Hole-in-One: live-топы + ввод маршалов |
| `rules.html` | Conditions of Competition, Local Rules, Pace of Play, PDF |
| `admin.html` | Лёгкая админка: статусы, генерация стартового листа, публикация, check-in |

## Документация

- `docs/PLAN.md` — sitemap, user stories, матрица QR, план MVP → V2 → V3
- `docs/DATA_MODEL.md` — модель данных RTDB, правила расчётов (WHS), боевые Rules
- `docs/CHECKLIST.md` — чеклист организатора (T-7 / T-1 / день турнира / T+1)

## Запуск

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

Деплой в продакшен — **Firebase Hosting** (статика):
```bash
firebase init hosting   # public directory: . / no rewrite
firebase deploy
```
После деплоя задай `SITE_CONFIG.siteBase` в `js/config.js` на свой URL (для QR-кодов).

## Как устроены данные

Всё живёт в Realtime Database: `tournaments/{id}/…` (см. `docs/DATA_MODEL.md`).
Пока узел `tournaments/` пуст — сайт автоматически показывает **демо-данные**
(12 игроков, 3 группы, призовые; правки хранятся в localStorage).
Создай первый турнир в консоли Firebase — сайт сам переключится на живые данные.

> ⚠️ Test mode базы живёт 30 дней. Перед турном поставь боевые Rules из `docs/DATA_MODEL.md`.

---

# ClubScore Live — новая архитектура (фазы 1–4, монорепо)

Легаси-статика выше оставлена как история. Актуальный контур — npm-workspaces монорепо с 15 сборками **3 варианта × 5 дизайнов** (VARIANTS.md, DESIGNS.md).

## Структура
```
packages/
  core            — доменная модель, zod-схемы, i18n (ru/en), правила конверта действий
  scoring-engine  — WHS-гандикапы, 10 форматов, countback, флайты (тестов ≥60, порог 90%)
  sync            — журнал действий, идемпотентность, timestamp→роль резолвер, SSE-транспорты
  design-system   — React-примитивы + ds.css (тач ≥48px, ARIA)
  tokens          — 5 дизайн-тем × {light,dark,sun}; CSS-генерация scripts/build-themes.mjs
  testing         — детерминированные фикстуры (mulberry32)
  app-ui          — экраны/роуты/паттерны IA; фичи вариантов — VARIANT_FEATURES
apps/
  server          — SSE-скоринг-сервер (node:sqlite журнал, ADR-0003)
  variant-{a-core,b-tournament,c-experimental}/design-{1..5}  — 15 приложений
scripts/          — gen-apps, build-all-apps, check-{boundaries,routes,i18n,bundle,contrast}, sim-tournament
```

## Команды
```bash
npm ci --no-audit
npm test && npm run typecheck && npm run lint
npm run dev --workspace @csl/app-a-d1     # любое из 15 приложений
npm run build                              # токены + 15 сборок
npm run check:all                          # границы+типы+тесты+контраст
node scripts/check-i18n.mjs && node scripts/check-routes.mjs && node scripts/check-bundle.mjs
npx tsx scripts/sim-tournament.mjs 144     # нагрузочная проверка движка
npm run server                             # SSE-сервер (PORT=8787, CSL_DB=…)
```

## Live-режимы
- **GitHub Pages** (deploy-pages.yml): статические сборки /<v>-d<d>/, DemoTransport — «сервер в браузере» (D8), счёт переживает перезагрузку (localStorage-журнал).
- **Сервер**: `npm run server` + RemoteTransport — SSE-стрим с Last-Event-ID докачкой, журнал sqlite (идемпотентные вставки, аудит).

## Процессы
- CI: `docs/ci-templates/ci.yml (см. CONTRIBUTING → CI-воркфлоу)` (boundaries, types, unit, контракты, bundle budget, симуляция 144 игроков).
- E2E: `docs/ci-templates/e2e.yml` — playwright против приоритетных сборок (SMART-цель «3/5 с первого раза»).
- Качество/решения: docs/adr/ADR-0003 (sqlite), CONTRIBUTING.md, 16 спек в корне (фаза 0, scope freeze).
