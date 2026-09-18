# ARCHITECTURE.md — источник правды №14. Техническая архитектура

> Статус: DRAFT до апрува Фазы 0 · Версия: 0.1 · Дата: 2026-09-18
> Здесь фиксируются стек и правила. Смена мажорных версий библиотек — только с апрувом (REVIEW.md).

## 1. Адаптация ветвления под среду исполнения (подтверждается на апруве Фазы 0)

Среда сессии фиксирует единственную ветку `arena/01a0b4c5-tourtest` (создание других веток недоступно). Поэтому схема брифа `variant/{A,B,C}-*/design/{1..5}-*` отображается так:
- роль «веток варианта/дизайна» выполняют **директории** `apps/variant-{a,b,c}-{core,tournament,experimental}/design-{1..5}-{slug}/` — самостоятельные Vite-приложения со своими зависимостями-ограничителями (см. §5);
- каждая фаза — отдельный PR из сессионной ветки в `main` (не мёржится до апрува точки);
- теги `vX.Y-{variant}{design}` ставятся на сессионную ветку/merge-коммит после апрува сборки;
- изоляция «не смешивать функционал/дизайн» обеспечивается механически: запрет кросс-импортов между app-директориями (lint-boundaries) + фича-флаги вариантов в коде shared-пакетов отсутствуют — вариант определяется составом роутов приложения.

## 2. Структура монорепо

```
package.json                  # npm workspaces (lockfile единый на всё монорепо)
packages/
  core/                       # доменные модели, типы, zod-схемы, API-клиент, i18n-ядро ru/en
  scoring-engine/             # ЧИСТЫЕ функции: счёт, handicap, форматы, лидерборд, skins, флайты, tie-break
  sync/                       # offline-очередь (Dexie), идемпотентность, backoff, SSE-клиент, конфликт-резолвер
  tokens/                     # дизайн-токены: base + 5 тем × режимы (dark/sun), сборка в CSS-переменные + TS-тип
  design-system/              # React-компоненты/примитивы/паттерны поверх токенов (без бизнес-логики)
  testing/                    # фикстуры (tournament-144 и др.), Playwright-хелперы, контрактные матчеры
apps/
  server/                     # Fastify + SQLite: REST/SSE, auth, аудит, метрики, экспорт; Dockerfile
  variant-a-core/design-1-heritage-green/
  .../design-2-fairway-live/ ... design-3-birdie-bolt/ design-4-launch-deck/ design-5-after-dark/
  variant-b-tournament/design-1..5/   variant-c-experimental/design-1..5/     # 15 сборок
.github/workflows/            # CI-матрица, ночные прогоны, деплой Pages
docs/                         # legacy-доки MVP (не правим); новые ADR — в /adr/
adr/                          # архитектурные решения по мере Фазы 1+
```

## 3. Стек (зафиксированные мажорные версии)

| Слой | Выбор | Версия на фиксацию | Почему |
|---|---|---|---|
| Runtime | Node.js | 20 LTS (совместимо 22) | Стандарт, SSE/SQLite без нативных сюрпризов |
| Пакеты | npm workspaces | npm ≥10 | Уже в среде; без лишних слоёв (Turborepo сознательно не берём: 15 маленьких Vite-сборок + CI-кэш дешевле) |
| Язык | TypeScript strict | 5.6 | Типобезопасность core/engine |
| UI | React | 18.3 | Зрелый, INP-комфортный; Concurrent не нужен |
| Сборка | Vite | 6 | Быстрые 15 сборок, PWA-плагин, preview |
| Роутер | react-router | 6 (data APIs) | Стандарт; deep links + guard-редиректы |
| Состояние клиента | zustand + immer | текущие миноры, фиксация в lockfile | Малый вес; server-state — в пакете sync (snapshot из Dexie/SSE), без React Query (минус 30 КБ) |
| Локальное хранилище | Dexie (IndexedDB) | 4 | Очередь sync, кэш снапшотов, durability |
| Валидация | zod | 3 | Shared схемы core (клиент+сервер) |
| i18n | i18next + react-i18next | 23/14 | Плюрализация, lazy неймспейсы; форматирование — нативный Intl |
| PWA | vite-plugin-pwa (Workbox) | текущая | App shell, offline fallback, installability |
| Сервер | Fastify 5 + better-sqlite3 11 + pino | — | Минимальная реплика для клуба; WAL + ночные бэкапы |
| Тесты | Vitest 2, Testing Library, Playwright, @axe-core/playwright, Lighthouse CI | — | Unit/contract/e2e/a11y/perf |
| Шрифты | self-hosted woff2 subsets (cyr+lat) | — | Приватность + офлайн + бюджет |
| Иконки | свой SVG-набор (синтаксис lucide-подобный, tree-shaken по дизайну) | — | Разные стили штриха по темам без дублирования deps |

Дополнительная зависимость — только с обоснованием в PR (размер, лицензия, поддержка).

## 4. Доменная модель (core)

`Club{ id, name, logo?, brand{ color? }, locale, tz, units }` ·
`Course{ id, clubId, name, loops:9[]|18|27|36 → Hole[{ n, par, si, lengthByTee }], teeSets: TeeSet[{ key: championship|mens|womens|senior|junior|custom, cr, slope, lengths }] }` ·
`Tournament{ id, clubId, courseRevisionId, name, status: draft|registration|live|finished|archived, format: FormatConfig (см. FORMATS.md), rounds: Round[{ index, date, loopSet }], handicap{ allowance }, tieBreak[], flights?: FlightConfig, teams?: TeamConfig, schedule?: TeeTime[] }` ·
`Player{ id, clubId, name, hi, gender?, teePref? }` ·
`Entry{ tournamentId, playerId, flightId?, teamId?, teeSetKey, status: active|dq|wd|dns, statusReason? }` ·
`Team{ id, tournamentId, name, memberIds, captainId? }` ·
**Событие счёта (ScoreAction)** — единственная форма изменения счёта:
```
{ actionId: uuid, type: 'score.set'|'score.pickup'|'score.penalty'|'score.concede'|'entry.status',
  tournamentId, roundIndex, playerId (или teamId), hole?, payload: { strokes?, penalties?, note? },
  authorId, authorRole, deviceId, clientTs (мс), lamport, supersedesActionId? }
```
Производные (materialized): `ScoreCell`, `Leaderboard`, `MatchState`, `SkinsState` — считает `scoring-engine` детерминированно от журнала действий (идеальная пересборка = реплей журнала).

## 5. Правила импортов и изоляции

- Граф зависимостей (направление «может импортировать»): **apps → design-system → tokens**; **apps → sync → core ← scoring-engine**; **apps → scoring-engine**; **apps/server → core, scoring-engine**. Запрещено: anything → apps/*, app → другой app, sync → design-system, tokens → любой код, scoring-engine → I/O (там только чистые функции; Dexie/фетч запрещены lint'ом).
- Механика: eslint `import/no-restricted-paths` + dependency-cruiser отчёт в CI; boundary-нарушение = красный PR.
- Shared-пакеты версионируются через workspace-протокол; публичные API — через `exports` в package.json каждого пакета (глубокие импорты запрещены).
- Вариант функционала НЕ выражается if'ами в shared-пакетах: scoring-engine экспортирует все форматы; приложение варианта подключает только свои (webpack-tree-shaking + явные роуты). DESIGN подключается приложением импортом ровно одной темы из tokens.

## 6. Offline-first и sync (packages/sync)

1. **Все мутации** клиента → локальную очередь Dexie (атомарно с оптимистичным применением к снапшоту). Персист — мгновенный, RPO=0.
2. **Отправка:** batch ≤50 действий в порядке (лидируют per-entity ключи player+hole+round), POST `/api/t/{id}/actions` с `Idempotency-Key: actionId`. Backoff 1→60 с ×2, jitter 20%; попытка при `online` сразу; resume после reload.
3. **Сервер:** транзакция `dedupe(actionId PK) → конфликт-резолвер → append events → обновить materialized → publish`. Конфликт-резолвер (общий код sync↔server): побеждает max(clientTs); в окне ±5 с — старшая роль (referee > marker > captain > player); далее max(serverSeq). Проигравшая версия помечается `overridden`, видна в аудите.
4. **Чтение/реал-тайм:** зритель: SSE `GET /api/t/{id}/stream?lastEventId=` — кадры `lb.delta { rows[], seq, serverTs }` (пульс heartbeat 25 с); клиент ведёт локальную materialized-копию; gap в seq → snapshot-fetch. Записывающий клиент получает ack своих действий тем же каналом (сверка очереди).
5. **Индикатор:** статус `online|offline|queued(n)` — единый компонент шапки во всех сборках.
6. **Ограничения по реальным средам** (iOS bfcache, вкладка в фоне): пауза SSE через 5 мин hidden → при `visible` резюм по lastEventId; документировано в NFR §8.
7. **Мультивкладочность:** одна вкладка-«лидер» sync через BroadcastChannel election; очередь общая (переживает закрытие вкладок).

## 7. Real-time бюджеты сервера

Fanout SSE: in-memory pub/sub на турнир; подключение ≤2 КБ буфера на клиента; 500 подключений — цель нагрузочного теста. Дельты формируются из diff materialized-строк (≤изменившихся 5% строк при типичном событии). Сжатие: gzip на уровне CDN/прокси; SSE-слова ≤1 КБ типично.

## 8. Доступность и адаптив как архитектурные примитивы

- Design-system компоненты рождаются с: focus-ring (токен), aria-атрибутами клавиатурной модели, тач-таргетом ≥48px, `prefers-reduced-motion` веткой анимаций; тест — storybook-галерея + axe на каждый примитив.
- Адаптивные примитивы: `<ScorePad>` (ввод ≤5с, левша/правша), `<LeaderboardTable compact|wide>` (приоритет-колонки ADAPTIVE.md), `<OfflineBar>`, `<SunToggle>`, `<DeltaHighlight>` (пересорт-отложенная логика). Приложение собирается только из них (запрет «голых» таблиц/кнопок в apps — lint custom rule).

## 9. Наблюдаемость

web-vitals (LCP/INP/CLS/TTFB + кастом `lb.freshness`, `score.input_ms`) → sendBeacon `/api/metrics` (агрегаты p75 по buildId+route, без PII) → admin-дашборд. Ошибки клиента — `/api/errors`. Логи сервера pino JSON + request-id; sync-метрики (длина очереди, конфликты/мин) в health-табло.

## 10. Тестовая стратегия

| Уровень | Инструмент | Охват/порог |
|---|---|---|
| Unit | Vitest | scoring-engine ≥90% строк; сценарии RULES §11 + FORMATS матрица-10 обязательны |
| Contract | Vitest + in-memory server | idempotency, конфликты ±5 с, резюм SSE, гонки вентиляции |
| Component | Testing Library + axe | примитивы DS, формат-виджеты |
| e2e smoke (на PR) | Playwright chromium | 3 сценария: ввод счёта→лидерборд; создание турнира; правка судьёй |
| e2e ночной | Playwright (chromium+webkit, эмуляции) | 5 сценариев + offline E1/E4/E7 + RT E8 + матрица ширин (скриншоты) + a11y axe 3 экрана |
| Нагрузка | node-скрипты (не k6 — меньше зависимостей) | 100/мин + 500 SSE-клиентов, отчёт p95 |

## 11. CI (схема; лимиты — DEPLOY.md)

PR: install(ci) → lint+typecheck → unit → build затронутых сборок (матрица по изменённым путям) → smoke e2e на приоритетных сборках → Lighthouse (главная) → artifact site-*.zip. Ночь: полный e2e, a11y, offline, нагрузка, все 15 сборок. Перед merge в main: всё + security-чек + diff бандла vs baseline.

## 12. Известные компромиссы (фиксируем осознанно)

- SQLite = одна реплика сервера; горизонтального масштабирования нет (достаточно для клуба; переезд на Postgres — отдельный ADR при >500 зрителей устойчиво).
- SSE без WS: сервер→клиент поток односторонний; «зрительские реакции» (C) — обычные POST'ы, их появление у всех — через поток.
- Демо-режим на GH Pages симулирует live (детерминированный генератор событий в sync с флагом demo) — прод-логика не отличается, отличается транспорт-адаптер.
