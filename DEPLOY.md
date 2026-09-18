# DEPLOY.md — источник правды №15. Деплой, CI-лимиты, показ

> Статус: DRAFT до апрува Фазы 0 · Версия: 0.1 · Дата: 2026-09-18

## 1. Цели деплоя

| Что | Куда | Как |
|---|---|---|
| 15 статических сборок (PWA) | **GitHub Pages** репозитория `xdramerx-debug/tourtest` (project pages) | Workflow `deploy-pages.yml`: агрегат `dist-pages/` → Pages artifact |
| Sync/REST сервер (`apps/server`) | Отдельный хост клуба: Docker-образ `ghcr.io/xdramerx-debug/tourtest-server` → VPS/Fly/Render (решение оператора клуба; по умолчанию — Fly.io free tier-эквивалент) | Workflow `release-server.yml` по тегу `server-v*` |
| Legacy-MVP в корне репо | Не трогаем (его Firebase-хостинг живёт отдельно от этого проекта) | — |

## 2. Раскладка URL на Pages

База проекта: `https://xdramerx-debug.github.io/tourtest/`.

```
/tourtest/                    → витрина (список 15 сборок + статусы чек-листов + ссылки на PR)
/tourtest/a/1/  …  /tourtest/a/5/   — variant-a-core × design 1..5
/tourtest/b/1/  …  /tourtest/b/5/   — variant-b-tournament × …
/tourtest/c/1/  …  /tourtest/c/5/   — variant-c-experimental × …
/tourtest/api-demo/*  — НЕТ (демо-режим клиентский, без сервера)
```

- Каждая сборка: `base = '/tourtest/{a|b|c}/{1..5}/'` (vite `base`, router basename), PWA manifest scope — тот же префикс.
- **Deep links на Pages** — через SPA-fallback: `404.html` (копия redirect-скрипта spa-github-pages) возвращает на `index.html` с сохранением пути; каждый app публикует свой `404.html`. Проверка curl-картой в PR (статус 200 на index, наличие redirect-скрипта в 404).
- `.nojekyll` — обязателен в корне Pages-артефакта (подчёркивания в путях ассетов). **CNAME не используем** (нет кастом-домена; чек-лист-правило: «CNAME отсутствует осознанно» фиксируется в каждом деплой-прогоне).
- Ассеты immutable (`/assets/*` с хэшем, cache-control year), `index.html` no-cache, SW с `skipWaiting` + контролем версий (prompt об обновлении, не силен во время ввода счёта).
- API base URL сборки: build-time env `VITE_API_BASE`; воркфлоу подставляет либо прод-сервер клуба, либо пустое значение => автоматический **демо-режим** (симулятор).

## 3. CI-лимиты (GitHub Actions free)

| Джоб | Бюджет времени | Когда |
|---|---|---|
| lint+typecheck+unit | ≤6 мин | каждый PR |
| build одной сборки | ≤3 мин/сборка, матрица только изменённых | каждый PR |
| smoke e2e (3 сценария × приоритетные) | ≤8 мин | каждый PR приоритетной сборки |
| Lighthouse (главная) | ≤4 мин | каждый PR |
| Полный ночной прогон (15 сборок, e2e, a11y, offline, RT, ширины) | ≤120 мин | cron ночью |
| Pages деплой | ≤10 мин | push в сессионную ветку / merge |
| Кэш | npm-cache (actions/cache) + Playwright-браузеры | — |
| Артефакты | `site-{variant}-{design}-{sha}.zip` retention 14 дней; скрин-матрица 14 дней; логи 90 | — |

Секреты CI: только `GHCR_PAT`/деплой-секреты сервера (при наличии); никаких клубных данных, `.env` в репо не коммитим (gitignore + gitleaks).

## 4. Как показываем сборки человеку

1. **Живое превью песочницы:** во время разработки агент поднимает Vite preview-процесс (порт публикуется платформой) — указан в отчёте фазы.
2. **PR-артефакты:** к каждому PR бот комментит ссылки: `site-*.zip`, Lighthouse JSON, скрин-матрица, таблица отклонений.
3. **Постоянный стенд:** после апрува Фазы 2+ витрина `/tourtest/` обновляется: кликабельные 15 сборок (демо-режим для всех; приоритетные — подключены к боевому серверу, если он задеплоен).
4. **Демо-данные:** фикстура `open-championship-144` (144 игрока, 4 флайта, 3 раунда, live-симуляция 100 обновлений/мин) — нажатие «симулировать турнир» на любой сборке.

## 5. Релиз сервера

- Образ: `Dockerfile` (node:20-alpine, non-root, sqlite на volume, healthcheck `/healthz`).
- Миграции: встроенный мигратор при старте (версии в таблице `schema_migrations`); down-миграции не требуются (append-mostly).
- Бэкап: snapshot SQLite каждые 15 мин в `/data/backups` (cron в контейнере) + инструкция восстановления в README сервера (RTO ≤1 ч по NFR).
- Переменные окружения: `PORT`, `DATABASE_PATH`, `ADMIN_PASSWORD_HASH`, `JOIN_CODE_PEPPER`, `CORS_ORIGINS`, `METRICS_TOKEN`. Примеры — `.env.example` (без значений).

## 6. Rollback

- Pages: повторный деплой предыдущего артефакта (`gh workflow run deploy-pages --field ref=<sha>`), ≤5 мин.
- Сервер: предыдущий тег образа; БД не трогаем (миграции только вперёд, совместимость 2 минор-версии).
- SW-клиента: kill-switch — `index.html` предыдущей версии ссылается на прежний precache; при фатале — чанк `sw-unregister.html` в корне сборки.

## 7. Ролики деплоя из чек-листа (маппинг)

Чек-лист «`.nojekyll` и `CNAME` на месте» трактуется: `.nojekyll` — да, в артефакте; `CNAME` — осознанно отсутствует (project pages); «GitHub Actions деплоит правильную папку» — `dist-pages/` собирается из 15 `apps/*/dist` + витрина + `404.html` каждого app; «формы и интеграции работают» — демо-режим эмулирует API полностью, прод-сборка проверяется против staging-сервера ночным e2e.
