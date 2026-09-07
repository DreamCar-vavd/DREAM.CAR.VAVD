# Журнал прогресу панелі DREAM.CAR.VAVD

Один журнал на гілку `codex/admin-panel-spike` (PR #26, draft). Дозволяє
продовжити роботу після перерви. **Секретів тут немає й не має бути.**

На початку сесії: прочитати цей журнал → звірити з `git log` / `gh pr view 26`
/ файлами → зберегти незакомічене → продовжити з першого незавершеного пункту.

Межі: збереження й push ≠ дозвіл на merge / Production deploy. Заборони на
зміни Production, доступів, тарифів, видимості репо — чинні.

---

## Поточний стан

- **Гілка:** `codex/admin-panel-spike` · **PR #26** (draft) · `main` @ `ce1977af` (не чіпається)
- **Head:** `d35fa4781b1d32e7de0b0465f2c2943d17d99c82`
- **CI `Verify`:** `9290b83` — success · Vercel — success · `d35fa47` — очікується
- **Тести:** 227 pass · tsc 0 · eslint 0 · content:guard/check/export — зелені
- **Preview:** публічні сторінки працюють; `/panel` + `/keystatic` = **404** без github-env

---

## Завершені пункти (новіші зверху)

### П10 — тач-цілі кнопок панелі (незалежне, Б6)
- **Commit:** `d35fa47`
- **Сторінка:** `/panel` на вузькому екрані (390px)
- Кнопки дій 34–36px (було ~26); без горизонтального переповнення; без редизайну
- Інлайн-посилання в реченнях лишено як є

### П9 — реальний Postgres-адаптер заявок (незалежно, не чекаючи власника)
- **Commit:** `9c860f2` ← `4838513` (журнал)
- **CI:** очікується
- **Сторінка:** `/panel/leads` (демо-режим без змін); тех-зміна — diff PR
- `src/lib/leads/postgres.ts` — `createPgLeadsStore(db)` над `Queryable` (тестується без БД) + лінива `pg` Pool; `create` з `ON CONFLICT`, `list` keyset-пагінація, `get` uuid-guard
- `store.ts` — прибрано заглушку; заданий `LEADS_DATABASE_URL` → реальний адаптер; недоступна БД → помилка на сторінці, **не** демо
- `scripts/leads-migrate.mjs` + `npm run leads:migrate`
- deps: `pg` ^8.23
- **Перевірено локально:** демо не змінилось; зламаний URL → «Не вдалося завантажити список», не демо; contact route 25/25
- 8 нових тестів (dedup / cursor SQL / uuid guard) · 227 усього

### П8 — відео, реальний запис заявок, підготовка приймання

### П8 — відео, реальний запис заявок, підготовка приймання
- **Commit:** `83c04d7` (docs) ← `a88316a` (leads write-path) ← `fffbb90` (video upload)
- **CI:** Verify success · Vercel success
- **Preview:** панель 404; локально `/panel/video`, `/panel/leads` працюють
- **Звіт:** `report/40-admin-panel-stage8.md`
- Відео: локальне сховище + UI (прогрес/скасування/повтор/перегляд); hosted = заглушка
- Заявки: `schema.sql` + `deriveIdempotencyKey` + матриця А–Д (`deliver.ts`); `PostgresLeadsStore` = заглушка
- Docs: `PANEL-hosting-and-approvals.md` (звірено з Keystatic 0.6.9), `PANEL-hosted-verification.md`, `PANEL-backup-restore.md`
- `npm run content:export`

### П7 — банери/акції/новини, ціни, magic-bytes, заявки-перегляд, схема підключення
- **Commit:** `f76c081` · **Звіт:** `report/39-admin-panel-stage7.md` · 197→219 тестів

### П6 — послуги + контакти через панель
- **Commit:** `9104787` · **Звіт:** `report/38-admin-panel-stage6.md`

### П1–П5 (етапи 1–5, до цієї серії)
- Коміти до `224fd5e` · Звіти `report/33`–`37` · cars + gallery + storage adapter + draft preview + content-guard

---

## Незавершене / блокери

| # | Пункт | Тип блокера | Наступний крок |
|---|---|---|---|
| Б1 | Hosted Keystatic (github-режим) | **дія власника** | запит нижче: створити GitHub App локально → env у Vercel Preview → redeploy |
| Б2 | Відео в хостингу | дія власника (токен) + код | тіло `BlobVideoStore` — **наступний незалежний крок** |
| Б3 | БД заявок | **дія власника (Neon)** | код готовий (П9); власнику: створити Neon-БД, `npm run leads:migrate`, задати `LEADS_DATABASE_URL` у Vercel |
| Б4 | `content-guard` workflow у `main` | дія власника (`workflow` scope + ruleset) | code-PR + налаштування ruleset |
| Б5 | Джерела трафіку в панелі | рішення власника (Vercel Pro) | після рішення — сторінка `/panel/traffic` |
| Б6 | ✅ Тач-цілі кнопок панелі | — | зроблено (`d35fa47`); дрібні інлайн-посилання лишено |

---

## Конкретний наступний крок

Незалежні пункти вичерпано без дії власника. Далі — дії власника (3 запити
підготовлені: GitHub App Б1, Neon-БД Б3, Vercel Blob Б2). `BlobVideoStore` тіло
+ фронтенд-гілка client-upload робиться разом із перевіркою після видачі
`BLOB_READ_WRITE_TOKEN` (без токена не перевіряється — не пишу наосліп).
