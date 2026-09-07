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
- **Head:** `87fe84a77ba318436f3d8bb017ac4423a25fec58` (+ цей журнал наступним комітом)
- **CI `Verify`:** `87fe84a` — success · Vercel Preview — success (звірено `gh pr checks 26` 2026-09-07)
- **Тести:** 242 pass · tsc 0 · eslint 0 · build OK · content:check/guard/export — зелені (на `87fe84a`; повторно без змін не ганяти)
- **Preview:** публічні сторінки працюють; `/panel` + `/keystatic` = **404** без github-env
- **Незакомічених змін немає** (стан зафіксовано для передачі в нову сесію)

### Що НЕ перевірено наживо (важливо для приймання)

«Кодові блокери закриті» ≠ «панель перевірена й готова». З реальним GitHub /
Vercel Preview **не** проганялись: hosted-вхід двох користувачів, відмова
сторонньому, контент-коміти панелі в гілку, читання чернетки з GitHub API,
банер стану deployment, конфлікт двох редакторів, активація публікаційного
конвеєра (`content-guard` → `main`). Так само не підключені: реальний Vercel
Blob (відео), реальна Postgres БД (заявки). Приймання hosted-версії власником —
попереду.

---

## Завершені пункти (новіші зверху)

### П16 — звірка стану + запит власнику Б1 (GitHub App)
- **Історичне vs поточне:** записи П1–П15 нижче — журнал зробленого; актуальний
  стан і незроблене — блок «Поточний стан» вище. Нову велику доповідь не писали.
- **Звірено** (2026-09-07): `main` @ `ce1977af` чистий; гілка `codex/admin-panel-spike`
  локально й на GitHub @ `87fe84a`; PR #26 — draft, не merged; `gh pr checks 26` —
  `Verify` success + Vercel success. Тести повторно не ганяли (змін коду немає).
- **Setup-сторінку відтворено наживо:** ізольований `git worktree` на `87fe84a`,
  `next dev` (webpack) на `127.0.0.1:3010`, `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github`.
  `/keystatic/setup` → 200, форма → `POST github.com/settings/apps/new`, маніфест:
  `default_permissions {contents:write, metadata:read, pull_requests:read}`,
  `callback_urls` = `<origin>/api/keystatic/github/oauth/callback` +
  `http://127.0.0.1/api/keystatic/github/oauth/callback`,
  `redirect_url` = `<origin>/api/keystatic/github/created-app`. `<origin>` береться
  з адреси сторінки → **вільний порт годиться**. App НЕ створювався. Чужий
  файловий dev-сервер на `:3000` не чіпали. Worktree прибрати після сесії:
  `git worktree remove /Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify`.
- **Запит власнику Б1** оформлено у форматі «ЗАПИТ ДЛЯ ПЕРЕДАЧІ АСИСТЕНТУ»:
  `docs/PANEL-owner-request-B1.md` (лише крок створення App локально; Vercel env /
  redeploy / hosted-перевірка — окремий наступний запит).
- **PR #26 опис** переписано навколо кінцевої реалізації (прибрано застаріле
  «Актуальний head: 83c04d72…» і старі списки незробленого).
- Файли: `docs/PANEL-owner-request-B1.md` (новий), `docs/PANEL-progress.md`,
  `PROJECT_PROGRESS.md`, `PROJECT_CURRENT_STATUS.md`.

### П15 — зрозумілий інтерфейс за фото власника + єдиний запис контактів
- **Commit:** `fd1158a` · тех-зміна + docs → diff PR
- **Сторінки для перегляду:** `/panel` (людський огляд: назви + статуси), `/keystatic` (Дашборд, редактори полів), `/keystatic/singleton/siteContact` (контакти — одна сторінка, без «Add»)
- `keystatic.config.ts`: додано верхньорівневий `locale: "uk-UA"`. Keystatic 0.6.9 перекладає навігацію, Search, Add, Create, Save, Edit, Delete, Cancel, Dashboard, Collections/Singletons. **НЕ перекладаються** штатно: «No results», «Unsaved», «Slug» (заголовок стовпця), «N entries», деякі тексти діалогів/порожніх станів — це hard-coded English у бібліотеці, форк не робимо (задокументовано коментарем у конфізі).
- Прибрано дубльований стовпець «ID» у списках cars/gallery/services/promos. Списки Keystatic показують лише **сире** значення верхньорівневого поля (select = `for-sale`, не «У продажі»; вкладене `uk.title` стовпцем бути не може). Людські назви й статуси — на `/panel`.
- `galleryProjects`: label «Галерея (тексти)» → «Галерея робіт (фото + тексти)».
- Видалено сінглтон-заглушку «Налаштування сайту» (`siteSettings`) — усі обіцяні в його примітці розділи (контакти, графік, банери) вже існують як реальні колекції. Службова примітка більше не виглядає як поле, яке власник нібито редагує.
- **`siteContact` collection → singleton.** Одна сторінка редагування, без кнопки «Add» — другий конфліктний набір контактів не створити випадково. Файл лишається `src/content/cms/contact/site.json`. **Серверне enforcement єдиного запису:**
  - `contactGate.getContactPublishBlockers` — блокує публікацію, якщо `id !== "site"` (поле `contactId`).
  - `snapshot.readPublishedSnapshot` — кидає помилку, якщо у `published.json` більше 1 запису contact.
  - `snapshot.assertContactSane` — кидає помилку під час `next build`, якщо `id !== "site"`.
  - `publishedContact.ts` / `siteContent.ts` — читають саме запис `site`, а не «перший за сортуванням».
- `/panel`: порожній стан → «Матеріалів ще немає» + посилання «Створити перший у Keystatic →» (пунктирна рамка). Відрізняється від «пошук без результатів» (це стан самого Keystatic).
- **Тести (+3, разом 242):** content-guard відхиляє другий запис contact; content-guard відхиляє перейменований `id`; contactGate блокує `id != "site"`.
- **Перевірено локально** (dev-сервер, файловий режим): Дашборд Keystatic показує «Дашборд», «Галерея робіт (фото + тексти)», «Контакти й графік» без «Add», без розділу «Налаштування сайту»; список авто — стовпці `Slug | Статус продажу | Порядок показу`; сторінка `/keystatic/singleton/siteContact` рендерить наявні дані з `site.json`. Синтетичний сценарій (створити авто → підтвердити 3 мови через `/api/panel` → `/panel` показує «Готове до публікації» → чернетка видима лише з draft-cookie, публічний сайт і `published.json` без змін) — пройдено, демо-файл видалено, `git status` чистий.
- **Обмеження Keystatic 0.6.9 (для власника):** списки колекцій не показують ані людські назви (`uk.title`), ані підписи select-статусів — лише slug і сирі значення. `/panel` — це і є зрозуміла оглядова сторінка. Частина системного UI лишається англійською (перелік вище).

### П14 — витрати (§9) + video multipart
- **Commit:** `2e83ece` · тех-зміна + docs → diff PR
- `docs/PANEL-costs.md` — перевірено 2026-09-07: GitHub/Neon free ок; Blob Hobby ок; Web Analytics API ймовірно Pro (402), UTM = Pro+Plus; Vercel Hobby некомерційний (передувало панелі)
- `VideoUploader`: `multipart` для файлів > 90 МБ

### П13 — GitHub App setup виправлено (§2/§3) + БД-інструкція (§6)
- **Commit:** `81a2d70` · **Перевірено локально:** `/keystatic/setup` тепер відкривається, кнопка «Create GitHub App» працює (форма → GitHub). App НЕ створювався.
- **Причина була:** `keystatic.config.ts` імпортується і клієнтом; `KEYSTATIC_STORAGE_KIND` без `NEXT_PUBLIC_` на клієнті `undefined` → клієнт «local», сервер «github» → `/keystatic/setup` 404. **Виправлення:** `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND` у 3 місцях.
- `docs/PANEL-hosting-and-approvals.md` §3 переписано (точний `.env.local`, localhost не 127.0.0.1, видалити `.env.local` після setup, branch-аліас для callback, Preview-захист vs OAuth)
- `docs/keystatic-app-setup.env` — шаблон
- `docs/PANEL-leads-db.md` — тестова БД для Preview, роль `leads_app` з мінімальними правами, пароль не в історію shell, скасування без видалення даних
- **Увага наступній сесії:** з `.env.local` (github-режим) локальні `npm run dev`/`build` падають — тестувати панель у файловому режимі БЕЗ `.env.local`

### П12 — hosted-адаптер відео Vercel Blob (§4) + приватність (§5)
- **Commit:** `8003e78` · **Сторінка:** `/panel/video` (локальний режим працює; blob-гілка коду перевірена контрактом)
- Vercel body-limit 4.5 МБ → client-upload (`@vercel/blob` `upload()` + `handleUpload`); прогрес/скасування/повтор
- `BlobVideoStore` list/head/remove; `tokenRulesFor`/`blobPathnameFor` (юніт-тест)
- **§5:** відео `access:"public"` = URL доступний до публікації (нелистований, не контроль доступу) — **компроміс для рішення власника**, документ
- Позначка: код готовий, контракт mock/юніт + локальна гілка `body.type`; **реальний Blob НЕ підключено**
- `docs/PANEL-video-hosting.md`

### П11 — заявки: not-configured (§8) + boundary-safe idempotency (§7)
- **Commit:** `c2f220b`
- `resolveLeadsMode()`: database | demo | not-configured; hosted без БД → «Сховище заявок не налаштоване», НЕ демо; демо лише dev/`LEADS_DEMO_MODE=1`
- `deriveIdempotencyKeys()` → {current, previous}; адаптер `IN (current, previous)` — повтор на межі бакета не дублює; вікно 10–20 хв
- виправлено NUL-байт у роздільнику ключа (`store.ts` став binary) + `.gitattributes`

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
| Б1 | Hosted Keystatic (github-режим) | **дія власника** | `docs/PANEL-hosting-and-approvals.md` §3 (setup локально → env Vercel Preview → redeploy → протокол `PANEL-hosted-verification.md`) |
| Б2 | Реальний Vercel Blob для відео | **дія власника** | код готовий (П12); власнику: Vercel → Storage → Blob → `BLOB_READ_WRITE_TOKEN` → redeploy; `docs/PANEL-video-hosting.md` |
| Б3 | Реальна БД заявок | **дія власника (Neon)** | код готовий (П9/П11); `docs/PANEL-leads-db.md` |
| Б4 | `content-guard` workflow у `main` | дія власника (`workflow` scope + ruleset) | code-PR + ruleset (`PANEL-hosting-and-approvals.md` §1.5) |
| Б5 | Джерела трафіку в панелі | рішення власника (Vercel Pro?) | `docs/PANEL-costs.md` §Джерела трафіку — referrer уже в дашборді Vercel; API/UTM = Pro |
| Б6 | ✅ Тач-цілі кнопок панелі | — | `d35fa47` |
| Б7 | ✅ Приватність відео-чернеток | рішення власника | компроміс задокументовано (`PANEL-video-hosting.md`) |

Усі відомі **кодові** блокери закриті. Це **не** означає, що панель перевірена
цілком — див. «Що НЕ перевірено наживо» у блоці «Поточний стан». Далі —
підключення й рішення власника (Б1–Б5, Б7) та hosted-перевірка.

---

## Конкретний наступний крок

**Незалежну роботу завершено.** Кодові адаптери (Postgres, Blob), UI, гейти,
документи, перевірки витрат — готові й покриті mock/юніт-тестами (не живою
перевіркою). Перший найближчий блокер — **Б1 (GitHub App)**.

**Запит власнику вже оформлено:** `docs/PANEL-owner-request-B1.md` (формат
«ЗАПИТ ДЛЯ ПЕРЕДАЧІ АСИСТЕНТУ», лише крок створення App локально). Наступний
запит після нього — Vercel env для Preview гілки `codex/admin-panel-spike` +
redeploy + прогін `docs/PANEL-hosted-verification.md`. Тоді Б2/Б3 паралельно —
новий код наосліп не писати, адаптери вже є, лишилася **жива перевірка**.
