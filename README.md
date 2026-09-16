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
