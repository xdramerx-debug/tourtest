# Модель данных — Firebase Realtime Database

База: `pestovo-livescoring-default-rtdb` (asia-southeast1).

## ER (сущности и связи)

```
Tournament 1 ── n Player            (players/{id})
Tournament 1 ── n Group             (groups/{id})      Group n ── n Player (players: [ids])
Tournament 1 ── n Scorecard         (scorecards/{playerId}/round{N})
Tournament 1 ── 1 PrizeBoard        (prizes/{contest}/entries/{key})
```
Лидерборд и статистика — **вычисляются клиентом** из players + scorecards (одна копия правды,
нет рассинхрона). Для больших туров (V3) результат кэшируется в узел `stats` Cloud Function'ом.

## Дерево узлов

```
tournaments/{tournamentId}/
├── meta/
│   ├── id, name, subtitle, edition, status        # status: registration | closed | live | finished
│   ├── formatType, formatLabel, rounds
│   ├── startType (tee_times|shotgun), firstTee, intervalMin
│   ├── tee                                        # ключ из meta.tees, с которого играет основной флайт
│   ├── dates { practiceDay, round1, round2 }
│   ├── roundStarts { "1": ISO, "2": ISO }         # для обратного отсчёта
│   ├── club { name, address, coords: [lat, lon] }
│   ├── green { surface, stimp }
│   ├── tees { back { label, par, cr, slope }, … } # CR/Slope для каждого набора ти
│   ├── courseTotal { par, m, yd }
│   ├── categories [ { id, label, note } ]
│   ├── limits { total, perCategory }
│   ├── fees { early, standard, late, currency }
│   ├── included [ … ]                             # что входит во взнос
│   ├── feeOptions [ ["название", цена], … ]
│   ├── sponsor { title, partners: [] }
│   ├── announcement (string|null)                 # жёлтый баннер на всех страницах
│   └── startlistPublished (ISO|null)              # штамп публикации листа
├── config/
│   ├── active: true                               # флаг «этот турнир показываем на сайте»
│   ├── tee                                        # ти для расчётов PH
│   ├── scoring {
│   │   format, playingHandicapAllowancePct,       # 85 stroke (WHS 2025+) / 95 stableford
│   │   maxScoreRule: true, stableford: true, tieBreak: "countback"
│   │ }
│   ├── prizes {
│   │   longestDrive { hole, label },
│   │   closestPin { holes: [6,13], label },
│   │   holeInOne { hole, label }
│   │ }
│   ├── paceOfPlay { total18, check9, perHole, warnings }
│   ├── committee { chair, referee, starters[], scoring[], marshals }
│   ├── timeline [ ["05:30", "название", "локация"], … ]
│   ├── localRules [ { code, title, text } ]
│   └── conditions [ ["1. Название", "текст"], … ]
├── course/
│   └── holes [ { n, par, si, m, yd }, × 18 ]      # si — Stroke Index
├── players/{playerId}/
│   ├── lastName, firstName, mi, born, gender (m|f), nationality, country
│   ├── club, hcpIndex, hcpUpdated, hcpCardNo
│   ├── category, preferredTee, cart, caddie
│   ├── phone, email, instagram, dietary, shirt
│   ├── contests { longestDrive, closestPin }
│   ├── status      # pending | confirmed | waitlist | cancelled
│   ├── photo (URL|null)
│   ├── checkIn { arrived: bool, at: ISO|null }
│   └── registeredAt (ISO)
├── groups/{groupId}/
│   ├── number, time ("08:08"), tee (1), players: [playerId, …]
├── scorecards/{playerId}/round{N}/
│   ├── holes { "1": 4, "6": "X", … }              # число = gross; "X" — пометка
│   └── signed { marker, player, at: ISO } | null  # наличие = карточка закрыта
├── prizes/
│   ├── longestDrive/entries/{key} { playerId, distance, at }
│   ├── closestPin/entries/{key} { playerId, hole, distance, at }
│   └── holeInOne/entries/{key} { playerId, w1, w2, at }
└── suspension { active: bool, reason, startedAt, resumedAt } | null
    # active=true → красный баннер «ИГРА ПРИОСТАНОВЛЕНА» на всех страницах
```

## Расчётные правила (реализовано в js/calc.js)
- **Playing HCP** = round( HI × Slope/113 + (CR − Par) × SCA% ), SCA: 85% stroke / 95% stableford (настраивается).
- **Удары**: PH первых лунок по возрастанию Stroke Index.
- **Max Score Rule**: net по лунке ≤ NDB = 2×Par − stroke.
- **Stableford (WHS)**: ≤E→5, +1→4, +2→3, +3→2, +4→1, +5→0 (от net к пару).
- **Позиции**: net → gross → countback (USGA: последние 9 → 3 → 18-я). T-позиции при равных net+gross.
- **Thru**: непрерывный счёт от 1-й лунки; finished = 18 полей заполнены.

## Rules (обязательно до турнира)

Test mode живёт **30 дней**. Сейчас: открыт для чтения и записи. До старта турнира — заменить на:

```json
{
  "rules": {
    "tournaments": {
      "$t": {
        ".read": true,
        "meta":            { ".write": "auth != null" },
        "config":          { ".write": "auth != null" },
        "course":          { ".write": "auth != null" },
        "players": {
          ".write": "auth != null",
          "$p": { "checkIn": { ".validate": "newData.child('arrived').isBoolean()" } }
        },
        "groups":          { ".write": "auth != null" },
        "scorecards": {
          ".write": "auth == null ? newData.isNumber() || newData.isString() || newData === null : true",
          // маршалы со страницы скоркарты пишут только holes/{n} (число или "X") и signed —
          // в V2 сузим до отдельных validate-правил по path
        },
        "prizes":          { ".write": true },   // до V2-аутентификации маршалов
        "suspension":      { ".write": "auth != null" }
      }
    }
  }
}
```
В V2 (после Firebase Auth): запись scorecards/prizes — только для ролей `referee`/`marshal`
custom claim'ами; `players/status`, `groups`, `meta` — `organizer`+.

## Валидация данных (V2)
- `hcpIndex`: number 0–36, одна цифра после запятой.
- `holes/{n}`: integer 1–15 или "X".
- `distance`: number > 0.
- `time`: строка "HH:MM".
Реализуется через `.validate` в rules + (опционально) Cloud Function on write.

## Производительность
- Подписки: главная — корень турнира; лидерборд — `players` + `scorecards`; скоркарта — свой раунд.
- RTDB держит тысячи подписчиков на узел; для 500+ пользователей на лидерборде запас есть.
- При росте: лимит данных через `limitToLast` по scorecards, кэш статистики в `stats` (V3).
