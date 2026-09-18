# ClubScore Live — высокотехнологичный live-скоринг для гольф-клуба

Монорепо. **v2: одно приложение `apps/scoring` с полным функционалом и пятью горячими
премиум-шаблонами** (переключение на лету: UI-пикер, `Alt+T`/`Alt+1..5`, `?theme=N`,
localStorage+профиль, системная тема — приоритет дефолта). Функциональная матрица v1
(3 варианта × 5 дизайнов = 15 сборок) живёт как регрессионная песочница под `/variants/`.

## Демо

| Что | URL |
|---|---|
| **Продукт v2 (полный функционал, 5 тем)** | https://xdramerx-debug.github.io/tourtest/ |
| Тема 5 (Night) по ссылке | https://xdramerx-debug.github.io/tourtest/?theme=5 |
| Матрица v1 (15 сборок) | https://xdramerx-debug.github.io/tourtest/variants/ |

Демо-коды турниров (в DemoTransport, «сервер в браузере»): `DUBRO6` — открытый турнир
(stroke, live), `SCRAM4` — корпоративный скрембл, `SKINS9` — вечерний скинс (9 лунок).

В проде вместо DemoTransport поднимается sync-сервер `apps/server` (SSE + очередь,
DEPLOY.md §1).

## Структура

```
packages/
  core/            # доменные модели, zod-схемы, i18n ru/en, API-клиент
  scoring-engine/  # ЧИСТЫЕ функции: счёт, WHS-гандикап, 10 форматов, лидерборд, skins, флайты, tie-break
  sync/            # offline-first: очередь IndexedDB, backoff, конфликты timestamp→role, SSE, zustand-store
  design-system/   # компоненты/паттерны/иконки + варианты под 5 дизайнов (ds.css, [data-design])
  tokens/          # 5 наборов дизайн-токенов [data-design][data-mode], генератор CSS+шрифтов
apps/
  scoring/         # ПРОДУКТ v2: одно приложение, 5 горячих тем (themeSwitch)
  server/          # sync/REST сервер (Node, SSE, идемпотентность, аудит)
  variant-{a,b,c}-*/design-{1..5}/  # матрица v1: 15 изолированных сборок (генерируются scripts/gen-apps.mjs)
e2e/               # Playwright: smoke путей v1 + scoring.spec.ts (горячие темы v2)
scripts/           # генерация приложений, сборка, бюджеты бандла, контраст, i18n, sim-турнир, serve-pages
*.md               # источники правды (16 файлов: PRODUCT…ESTIMATE/SUCCESS)
```

## Источники правды

Единственное ТЗ живёт в корне: `PRODUCT.md` (§0 — v2), `FEATURES.md`, `VARIANTS.md` (архив v1),
`DESIGNS.md` (5 шаблонов + таблица 10 осей, ≥7 различий между любой парой), `NFR.md`,
`RULES.md` (R&A/USGA + WHS), `FORMATS.md` (10 форматов), `IA.md`, `ADAPTIVE.md`,
`USER_FLOWS.md` (F0+v2 — переключение темы), `ARCHITECTURE.md` (§0 — механика тем),
`DEPLOY.md` (§0 — Pages: scoring в корне), `ESTIMATE.md`, `SUCCESS.md`, `REVIEW.md`.

## Пять шаблонов (не перекраски!)

1. **Classic Country Club** — серифы, крем, золото, печатная карточка, воздух.
2. **Broadcast / Majors** — ТВ-доска: тикер, плотность, E/-2/+1/thru, красно-синие акценты.
3. **Modern Sport** — бенто-карточки, графит, вольт, стекло, энергия.
4. **Precision / Instruments** — прибор: моноширинные цифры, строгая сетка, минимум декора.
5. **Night Round** — ночной округ: глубокий фон, мягкое свечение, читаемость в темноте.

Механика: один бандл — CSS всех 5 тем ≈ 8.5 КБ gzip включено сразу (NFR §0 v2),
переключение — flip `data-design`/`data-mode` на `<html>`: мгновенно, без перезагрузки,
без потери состояния (тесты `e2e/scoring.spec.ts`), шрифты тем подгружаются лениво.

## Команды разработки

```bash
npm ci                      # установка
npm run build               # tokens CSS + 15 сборок v1 + apps/scoring
npm run test                # vitest: 100+ юнит-тестов (engine, sync, app-ui, темы)
npm run typecheck && npm run lint && npm run check:contrast
npm run check:bundle        # бюджеты: JS ≤350 КБ gz, CSS ≤60 КБ gz
npm run sim                 # симуляция: 144 игрока, раунд, offline, конфликты (~1.6 мс итог)
npm run preview -- apps/scoring/dist 4020   # статический превью собранного приложения
npx playwright test         # e2e (в CI; headless, chromium)
```

## CI/CD (`.github/workflows/`)

- `ci.yml` — lint, typecheck, unit, contrast, bundle (push+PR).
- `e2e.yml` — playwright: smoke v1 (а×1..3, b×2, c×5) + `scoring` v2 (?theme=, пикер, хоткеи, no-loss).
- `deploy-pages.yml` — сборка и публикация: `apps/scoring` в корень Pages, матрица v1 в `/variants/`.

## Доказательства качества

- тесты: 106/106 unit (зелёные в CI), e2e: 12 smoke + 4 scoring v2 (зелёные);
- офлайн: раунд принимает счёт без сети, синхронизация при появлении, конфликты по
  timestamp→role (referee > marker > player); Идемпотентность actionId;
- бандл: scoring JS ≈ 137 КБ gz + 33 КБ (vendor) ≤ 350; CSS всех тем ≈ 8.5 КБ gz ≤ 60;
- контраст: `check:contrast` 5 дизайнов × 3 режима (солнце ≥7:1 цифры) — OK;
- адаптив: e2e на 320/390/desktop(1366), тач-таргеты ≥48px, ландшафт;
- i18n: ru/en, Intl-форматчики, +30% строк, RTL-smoke.

## Merge

Сборка v2 живёт в PR (методологически merge — одним кликом пользователя).
