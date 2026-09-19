# CONTRIBUTING — ClubScore Live

Спасибо, что помогаете клубу играть в быстрый гольф-скоринг.

## Контур разработки
- **Монорепо npm-workspaces**: `packages/*` — домен, `apps/*` — сборки и сервер. Никаких перекрёстных импортов в обход границ — проверяется `npm run lint` (scripts/check-boundaries.mjs).
- **Source of truth**: 16 корневых спек (PRODUCT, RULES, FORMATS, IA, DESIGNS, NFR, VARIANTS, …). Код не должен «упрощать» правила гольфа — только реализовывать спеку; расширение scope — через Ревью-борд, не через PR.
- **Гольф-математика** живёт только в `packages/scoring-engine` и покрывается тестами (порог 90% lines/functions, см. vitest.config.ts). Примеры из RULES §11 — обязательные кейсы.
- **Варианты/дизайны**: A⊂B⊂C только матрицей фич `VARIANT_FEATURES` (packages/app-ui/src/config.ts) и файлами приложений; дизайны меняются только токенами (packages/tokens) и паттернами DS — IA общая для всех 15 сборок.
- **i18n**: ключи — в packages/core/src/i18n/{ru,en}.json; добавил ключ в код — добавь в оба словаря (`node scripts/check-i18n.mjs`).

## Локальный запуск
```bash
npm ci --no-audit
npm run build:tokens            # CSS тем из токенов
npm run dev --workspace @csl/app-c-d5    # любой из 15 (a/b/c × 1..5)
npm test                        # unit: engine/sync/ds
npm run typecheck
npm run check:all               # boundaries + typecheck + tests + contrast
node scripts/check-routes.mjs && node scripts/check-i18n.mjs && node scripts/check-bundle.mjs
npm run server                  # reference SSE-сервер (node:sqlite), PORT=8787
```

## Проверки перед PR
`check:all` + `node scripts/check-i18n.mjs` + `node scripts/check-routes.mjs` + `npm run build` должны быть зелёными. CI (ci.yml) повторяет всё + bundle budget + симуляция 144 игроков; e2e.yml — playwright против приоритетных сборок.

## CI-воркфлоу
Живут в `.github/workflows/` (ci.yml, e2e.yml, deploy-pages.yml). Изменение workflow-файлов требует permission `workflows` у пушащего аккаунта/App'а — история: первоначально шаблоны лежали в `docs/ci-templates/`, после выдачи пермита перенесены на каноническое место.

## Что нельзя коммитить
node_modules, dist, .env, секреты, реальные персональные данные игроков (ФЗ-152/NFR §6 — в репо только фикстуры). Журналы sqlite сервера (`*.db`) тоже.

## PR-процесс
Один PR на связное изменение, описание — что из спеки закрывается (ссылки на секции), скриншоты экранов при UI-изменениях. Слияние в main — только вручную после ревью (агенты не мержат).
