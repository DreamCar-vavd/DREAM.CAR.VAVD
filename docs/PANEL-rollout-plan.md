# Послідовність впровадження PR №26 (підготовка, 15.09.2026)

**Це підготовка, не дозвіл на merge чи Production.** Ніякого злиття,
активації workflow чи зміни Production ця сесія не робила. Не загальний
аудит — лише короткий, перевірений факти-переліком план.

## 1. Що вже можна впроваджувати БЕЗ Б4

Перевірено прямо в коді (не здогад): на `main` сторінка `cars-for-sale`
читає з хардкодженого `@/content/carListings.ts`; на гілці PR №26 той файл
**видалений**, сторінка читає з `@/lib/content/publishedCars` (панельна
`published.json`-система). Це означає: **звичайний `Approve + Merge` PR №26
(§1.2, людський review, без Б4) сам по собі переносить і код, і поточний
контент гілки** — Б4 для ЦЬОГО кроку не потрібна.

Після такого merge одразу працюють без жодної додаткової дії:
- Публічні сторінки авто/галереї/послуг — з контенту, який уже є в
  `published.json` на гілці PR №26 на момент merge.
- `/keystatic` — редагування (потребує лише GitHub App, налаштованого
  для Production-домену, див. §3).
- `/panel` — дашборд, мовні підтвердження, кнопка «Опублікувати».
- `/panel/video` (локальне сховище) і `/panel/leads` (стан «не
  налаштовано» — безпечний дефолт без `LEADS_DATABASE_URL`).

## 2. Що залежить саме від Б4 — і що НІ

**Залежить (конкретна технічна причина):** після merge будь-яка НАСТУПНА
зміна контенту (новий запис ціни, фото, тексту через `/panel`) потрапляє
лише на гілку контенту (`PANEL_CONTENT_BRANCH`) — щоб вона дійшла до
`main`/Production **без окремого code-review щоразу**, потрібен саме Б4
(`content-guard.yml` + Environment `content-publish`, ще не активовано).
Без Б4 кожне оновлення контенту після launch — це звичайний PR (§1.2,
працює вже зараз, просто не «в один клік»).

**НЕ залежить від Б4** (не оголошую Б4 обов'язковою без причини):
Keystatic-редагування, мовні підтвердження, сама кнопка «Опублікувати» в
`/panel` (вона пише на гілку контенту, а не в `main`, — це працює
незалежно від того, чи existує Б4), перегляд заявок, відео-плеєр,
draft-preview, увесь функціонал самої панелі.

## 3. Налаштування Preview, які НЕ перенесуться в Production

| Налаштування | Де зараз | Що треба на Production |
|---|---|---|
| `PANEL_CONTENT_BRANCH` | не задано явно — Preview сам бере `VERCEL_GIT_COMMIT_REF` (гілка PR) | **На Production `VERCEL_GIT_COMMIT_REF` = `main`** → без явного `PANEL_CONTENT_BRANCH` панель писала б **напряму в `main`**, минаючи Б4 взагалі. Це рішення власника (§4), не технічна деталь |
| `LEADS_DATABASE_URL` | Preview-only, гілка `codex/admin-panel-spike`, тестовий Neon-проєкт `dream-car-leads-test` | **Реальних заявок Production НЕ підключає.** Окрема БД (чи той самий Neon-проєкт у Production-режимі) — рішення й дія власника |
| Callback URL GitHub App | Preview-домен (`…vercel.app`) | Додати callback для `dream-car-vavd.com` в налаштуваннях App |
| `KEYSTATIC_GITHUB_CLIENT_ID/_SECRET`, `KEYSTATIC_SECRET` | Vercel → Preview env | Скопіювати ті самі значення в Vercel → **Production** env (окремий scope) |
| `BLOB_READ_WRITE_TOKEN` | не підключено взагалі | Підключити Vercel Blob для відео на Production (Б2, окремо) |
| `content-guard.yml` + Environment `content-publish` | лише в `workflows-proposed/`, не активовано | Окрема послідовність — `docs/PANEL-hosting-and-approvals.md` §1.5 |

**Окремо: підключена тестова БД заявок (`dream-car-leads-test`, Preview) НЕ
означає, що реальні заявки Production кудись пишуться.** Без явного
Production `LEADS_DATABASE_URL` `/panel/leads` на Production показуватиме
«не налаштовано» — безпечний стан, не помилка.

## 4. Дії, що потребують рішення власника

1. Сам merge PR №26 (окреме рішення, не ця сесія).
2. **Чи тримати `PANEL_CONTENT_BRANCH` окремою гілкою і на Production, чи
   дозволити панелі писати напряму в `main`** — реальний продуктовий вибір
   із різними наслідками (окрема гілка = усі майбутні зміни контенту йдуть
   через Б4/PR; напряму в `main` = панель сама стає точкою запису, без
   проміжного захисту).
3. Активація Б4 (Environment + `CONTENT_PUBLISH_TOKEN` + ruleset bypass) —
   `docs/PANEL-hosting-and-approvals.md` §1.5, не зроблено.
4. Підключення реальної Production БД заявок.
5. Копіювання env-змінних у Production-scope Vercel + callback URL App.

## 5. Як перевірити результат після впровадження

- CI (`Verify`) зелений на `main` після merge — уже вимога branch protection.
- Візуально звірити `dream-car-vavd.com/uk/cars-for-sale` (і `/ru`, `/en`)
  — саме тому, що джерело даних змінюється (хардкод → `published.json`),
  це не лише «build пройшов», а конкретно: ті самі авто, ціни, фото, що
  були на гілці PR №26 перед merge.
- `/keystatic` → Sign in — працює після налаштування App для Production
  домену (§3).
- `/panel/leads` → показує «не налаштовано» (очікувано, не помилка) — доки
  Production `LEADS_DATABASE_URL` не підключено.
- `content:guard` (локально, на щойно змерженому `main`) — має бути ✓.

## 6. Як повернути попередню версію

Merge PR №26 — звичайний GitHub PR merge commit на `main`, тому:
- **Швидко:** Vercel → Deployments → попередній Production-деплой →
  **Instant Rollback** (секунди, без нового коміту).
- **У git-історії:** GitHub → PR №26 → **Revert** (створює новий PR, що
  скасовує merge-коміт) → Approve + Merge як звичайний PR (§1.2). Ніякого
  force-push чи переписування історії не потрібно в жодному з варіантів.
