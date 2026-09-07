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
- **Head:** `83c04d72f1c8bdb4cefeef6c987c5809735daeb3`
- **CI `Verify`:** success · **Vercel Preview:** success
- **Тести:** 219 pass · tsc 0 · eslint 0 · content:guard/check/export — зелені
- **Preview:** `https://dreamcarvavd-79netta8n-6y7h9wdz4r-7375s-projects.vercel.app`
  (публічні сторінки працюють; `/panel` + `/keystatic` = **404** без github-env)

---

## Завершені пункти (новіші зверху)

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
| Б2 | Відео в хостингу | дія власника (токен) + код | тіло `BlobVideoStore` можна написати заздалегідь (за env-перевіркою) |
| Б3 | БД заявок | дія власника (Neon) + код | тіло `PostgresLeadsStore` + міграція можна написати заздалегідь |
| Б4 | `content-guard` workflow у `main` | дія власника (`workflow` scope + ruleset) | code-PR + налаштування ruleset |
| Б5 | Джерела трафіку в панелі | рішення власника (Vercel Pro) | після рішення — сторінка `/panel/traffic` |
| Б6 | Тач-цілі інлайн-посилань у `/panel` | — (незалежне, дрібне) | збільшити padding посилань |

---

## Конкретний наступний крок

Незалежно (не чекаючи власника): написати тіло `PostgresLeadsStore` +
скрипт міграції (за env-перевіркою, без зміни поведінки без `LEADS_DATABASE_URL`).
Паралельно — підготовлено запит власнику на GitHub App (Б1).
