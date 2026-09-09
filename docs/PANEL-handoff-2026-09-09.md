# DREAM.CAR.VAVD — панель контенту: HANDOFF для нового чату

**Дата:** 2026-09-09 ~15:30 BST. Стан на кінець сесії, у якій зроблено П35 (реальний
тест `zzz-test-panel` на Preview), П36 (фікс осиротілих рядків `review-state.json`),
П37 (фото послуг на публічній сторінці + справжня 375px-перевірка + інструкція власнику).

---

## 1. Де все стоїть

| Що | Значення |
|---|---|
| Репозиторій | `DreamCar-vavd/DREAM.CAR.VAVD` |
| Робоча гілка | `codex/admin-panel-spike` |
| **Remote HEAD** | **`1622059`** (вміст == `1214411`; `1622059` = тест-коміти живої перевірки, що скасовуються) |
| `main` | `ce1977af140b49dce4bb79001c7eeed5e01aa2c2` — **не чіпати, не зрушувався** |
| PR | **#26**, draft, OPEN, MERGEABLE — **не мержити, не знімати draft** |
| CI `Verify` на `1214411` | success |
| Vercel Preview на `1214411` | success |
| Тести / tsc / eslint | **315 pass / 0 todo**, tsc 0, eslint 0, `npm run build` OK, `content:guard` OK |
| Preview-хост (branch alias) | `dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app` |
| Team Vercel | `6y7h9wdz4r-7375s-projects` = `team_DBxz9jzVQflTswVKf9BRzWHo` (Hobby) |

**Єдина зміна КОНТЕНТУ проти `604c27e`** (початок цієї роботи):
`src/content/cms/published.json` → поле `publishedAt`
(`2026-09-06T00:00:00Z` → `2026-09-09T14:31:45Z`) — штатна зміна `publishItem`
після тесту `zzz-test-panel`. `review-state.json` — байт-у-байт як `604c27e`.
Решта змін у `f6e522f` — новий код + docs + тести. `git grep zzz` у
`src/content/**`/`public/**` = нічого (окрім протоколу `docs/PANEL-test-zzz-run-20260909.md`).

---

## 2. Робочі копії (git worktrees / клони)

| Шлях | Стан | Призначення |
|---|---|---|
| `/Users/apple/Projects/DREAM.CAR.VAVD-admin-panel-20260906` | HEAD старий; dev-сервер `:3000` працює (сервер власника) | «канонічна» ізольована копія. **НЕ виконувати тут `git reset --hard`** — там може бути запущений сервер власника `:3000`. Якщо потрібна свіжа копія для роботи — брати `dcv-panel-dev-20260909/repo` або робити новий окремий клон, не чіпаючи цю папку. |
| `/Users/apple/Projects/dcv-panel-dev-20260909/repo` | HEAD `codex/admin-panel-spike` tip, чисто, є `node_modules` + prod-збірка | робоча копія цієї серії (П38). Локальний dev тесту був `:3011`. `git fetch && git merge --ff-only origin/codex/admin-panel-spike` перед роботою. |
| `/Users/apple/Projects/dcv-restore-verify-20260909/repo` | HEAD `604c27e` | базовий стан для порівняння + `TEST-LOG.md` + `/baseline/` (знімки `published.json`/`review-state.json`/хеші на момент П35). |
| `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify` | worktree для Б1-setup; `.env` (4 секрети, git-ignored) + `.env.local`; dev `:3010` (pid ~95334) | **не видаляти** доки секрети не покладено у захищене сховище власника. |

**Рекомендація новому чату:** працювати в `dcv-panel-dev-20260909/repo`
(`git fetch && git merge --ff-only origin/codex/admin-panel-spike`) АБО зробити
свіжий окремий клон. **Не** робити `reset --hard` у папці сервера власника
`…-admin-panel-20260906`.

---

## 3. Запущені сервери — НЕ ЧІПАТИ

- **`:3000`** — `next dev` у `DREAM.CAR.VAVD-admin-panel-20260906`. Сервер власника. **НЕ чіпати, НЕ `reset --hard` у цій папці.**
- **`:3010`** — `next dev` у `…-panel-setup-verify`. Б1-setup-сервер, github-режим.
- Свої dev-сервери піднімати на **іншому порту** (напр. `:3011`, `:3012`). У `next dev` публічні сторінки мають строгий CSP без `unsafe-eval` → клієнтський JS (лайтбокси) **не працює в dev**; для перевірки інтерактиву робити `npm run build && npx next start --port <вільний>`.

---

## 4. Що зроблено цією серією (журнал — `docs/PANEL-progress.md`, записи П35–П38)

- **П38 — життєвий цикл карток і фото (задача 16:23), 3 частини:**
  - **§3** прив'язка підтверджень до **примірника** картки: поле `bornAt`
    (Keystatic генерує токен на створенні) + `instance` у рядку `review-state`.
    Видалити+створити наново з тим самим slug і текстом → потребує нового
    підтвердження. Міграція `scripts/migrate-born-at.mjs` (`legacy-<slug>`).
    Коміт `431b0d8`. Закрито `todo` п. 8.
  - **§4** `panelStore.completeDeletion` + `/panel` блок «Незавершені видалення»
    + кнопка «Завершити видалення» + `/api/panel` дія `complete-deletion`.
    Коміт `20c93e7`.
  - **§5–6** заморозка опублікованих фото: `store/adapter.ts` published-media
    (regex-обмежений `_pub/`), `freezeItemMedia`/`gcFrozenMedia` у `publishItem`/
    `unpublishItem`, `inSyncIgnoringFrozenPhotos` у `getPanelData`. Міграція
    `scripts/migrate-freeze-published-photos.mjs` (11 items, +~31 МБ). Коміти
    `4a34df9`+`ab3565c`+`1214411`.
  - Наживо на Preview (github-режим): §3 create/confirm, §4 повний цикл
    delete→«Завершити видалення», відсутність фантомних «є зміни». §5–6 —
    лише локально (`LocalFsStorage`).


- **П35 — реальний тест `zzz-test-panel` на Preview** (з дозволу власника). Повний
  цикл: створення через Keystatic → мовний гейт → фото (окремий файл
  `public/images/cms/services/<slug>/photos/0/image.<ext>`) → чернетка vs глядач →
  публікація → **конфлікт двох вкладок** (`ConflictError`, версія A ціла) → обидва
  способи прибирання (звичайний unpublish; рядок-сирота «Робочу картку видалено»).
  Прибрано повністю. Протокол — `docs/PANEL-test-zzz-run-20260909.md`.
- **П36 — фікс осиротілих рядків `review-state.json`** (авторка — фонова сесія
  `task_6cee6cb0`, коміт `981c435` після rebase). Keystatic «Delete entry» —
  прямий коміт: прибирає JSON картки + фото, але **не** її рядок у
  `review-state.json`. Виправлення **лише** в `src/lib/content/panelStore.ts`:
  `staleReviewSlugs()`/`pruneReview()` (рядок «стале», якщо під його slug немає
  робочої картки в **жодному** з 5 типів — keyspace плоский); `getPanelData`
  гейтить/фарбує вже без стале-рядків і віддає `PanelData.staleReviewSlugs`;
  `confirmLocale` (єдина дія, що пише review-state) підмішує prune у свій **єдиний**
  запис (best-effort). **Перевірено живо на Preview у github-режимі** (`79e4a7d`).
- **П37 — фото послуг на публічній сторінці** (`6e0fb79`):
  `src/components/ServicePhotos.tsx` (клієнт: сітка `aspect-[4/3]` `object-cover`
  + лайтбокс зі стрілками/Esc/пасткою фокуса) + `src/lib/content/servicePhotos.ts`
  (чисті хелпери, +7 тестів) + підключення в
  `src/app/[locale]/services/[slug]/page.tsx` під списком переваг. Рендерить
  `meta.photos` (раніше не вживалось). Немає фото → секції немає. `onError` ховає
  биту плитку. `docs/PANEL-service-photos.md`.
  - **Справжня 375px-перевірка** (Browser pane / Playwright — реальна емуляція
    viewport, чого не мали попередні сесії): `/panel`, редактор Keystatic і
    сторінка послуги з фото — без горизонтального скролу; клавіатура на `/panel`
    ок (0 positive tabindex, DOM=tab-порядок, золоте `:focus-visible` кільце).
  - Справжнє вікно `window.confirm` для «Прибрати з сайту» перевірено Playwright
    `browser_handle_dialog` (**не** підміняли `window.confirm`): «Скасувати» —
    без змін, «OK» — виконує.
- **Інструкція власнику** — `docs/PANEL-owner-guide.md` (покроково за назвами кнопок).

---

## 5. ВІДКРИТІ ПУНКТИ / наступна робота

### 5.1. ✅ Залишок фіксу review-state (пункт 8) — ЗАКРИТО у П38 §3
Реалізовано прив'язку до примірника (`bornAt` / `instance`). `todo`-тест став
робочим. Залишковий нюанс: рядки, підтверджені **до** П38 і не мігровані,
трактуються як legacy (`instance:""`) — але міграція проставила `legacy-<slug>`
усім наявним, тож у продакшені їх немає.

### 5.2. Захищена копія секретів — дія власника (не зроблено)
7 змінних Vercel Preview + 4 значення у `…-panel-setup-verify/.env` — у Git їх
немає (правильно), але **погодженої захищеної копії немає**. Перелік (назви,
звідки взяти, для якого App/проєкту/середовища) — у журналі П34 та
`docs/PANEL-owner-request-B1.md`. Секрети в чат не запитувати.

### 5.3. Інші блокери власника (Б2–Б5, Б7) — код готовий, жива перевірка попереду
- **Б2** — реальний Vercel Blob для відео (`BLOB_READ_WRITE_TOKEN`). `docs/PANEL-video-hosting.md`.
- **Б3** — реальна Postgres БД заявок (Neon, `LEADS_DATABASE_URL`). `docs/PANEL-leads-db.md`.
- **Б4** — `content-guard` workflow у `main` (перенести з `.github/workflows-proposed/`,
  налаштувати ruleset; потрібен `workflow` scope). `docs/PANEL-hosting-and-approvals.md` §1.5.
- **Б5** — джерела трафіку в панелі (можливо Vercel Pro). `docs/PANEL-costs.md`.

### 5.4. Перевірено ЛИШЕ ЛОКАЛЬНО (можна промотувати до Preview за потреби)
Сітка/лайтбокс фото та edge-cases фото; справжній 375px для `/panel`/Keystatic/
сторінки послуги; вікно `confirm`; повний цикл інших колекцій (авто/галерея/
банери/контакти) — на Vercel не проганявся (лише юніт-тести з `FakeStorage mode="github"`).

### 5.5. ✅ Міждеплойна властивість фото — ЗАКРИТО у П38 §5–6
Заморозка у `_pub/` діє для авто, галереї, послуг і банерів (одна реалізація).
**Лишилось на Preview:** повний цикл заморозки на github-режимному `publish` +
A→B між двома реальними збірками Vercel (локально пройдено).

### 5.6. Б4 / content-guard для `main` — врахувати `_pub/`
`published.json` тепер посилається на `_pub/<hash>` замість `photos/*`. Маніфест
`content-guard` містить `_pub/…` (проходять `MEDIA_RE`); git-level enforcement
дозволяє все під `public/images/cms/**`. Наступна сесія Б4 має це врахувати.

---

## 6. Як перевіряти / тестувати

- **Юніт-тести:** `npm test` (node --test + tsx). `npx tsc --noEmit`. `npm run lint`. `npm run build` (Turbopack).
- **Локальний прогін панелі:** свіжий клон **без** `.env.local` → `next dev` (local-режим,
  `keystaticEnabled` true, `/panel` + `/keystatic` працюють, пишуть у файли). Для
  інтерактиву (лайтбокс) — prod-збірка + `next start` на вільному порту.
- **Справжня 375px / нативні діалоги:** Playwright MCP (`browser_resize` 375×812,
  `browser_handle_dialog`) або Browser pane (`resize_window` mobile). `claude-in-chrome`
  **не** змінює CSS-viewport і **не** дає відповісти на нативний `confirm` (зависає).
- **Hosted-перевірка (github-режим):** авторизована сесія Chrome власника (tab у
  `claude-in-chrome`), Preview-хост вище. Погоджений тестовий сценарій —
  `docs/PANEL-write-publish-scenario.md` (slug `zzz-test-panel`). Після кожної дії
  панелі: `git ls-remote` → SHA → читати файл на цьому SHA через
  `raw.githubusercontent.com/.../<sha>/...` (не `origin/*` з кешу).
- **Один потік push:** якщо працюють дві сесії — лише одна пушить у `codex/admin-panel-spike`.

---

## 7. МЕЖІ (незмінні)

- `main`, Production, DNS, тарифи, права доступу, сервери `:3000`/`:3010` — **не змінювати**.
- PR #26 — **draft**, без merge, без force-push, без `git reset --hard` віддаленої/спільної історії.
- Нових **фонових сесій не створювати** (`spawn_task`).
- Секрети, паролі, коди підтвердження — **в чат не запитувати**. Якщо GitHub/Vercel
  просить пароль/2FA — це робить власник у браузері.
- Реальні матеріали CMS (авто, галерея, послуги, банери, контакти) — **не редагувати**;
  тести — лише на синтетичних `zzz-*`, з повним прибиранням.

---

## 8. Карта ключових файлів

**Код П38:**
- `keystatic.config.ts` — `bornAtField()` у 4 колекціях + сінглтоні.
- `src/lib/content/carsGate.ts` — `ReviewRow.instance`, `reviewInstanceMatches`,
  `GateContext.instance`; 4 інші гейти викликають `reviewInstanceMatches`.
- `src/lib/content/panelStore.ts` — `instanceToken`/`instanceMap`,
  `freezeItemMedia`/`gcFrozenMedia`/`inSyncIgnoringFrozenPhotos`,
  `completeDeletion`, `freezePublishedMedia`; `getPanelData`/`confirmLocale`/
  `publishItem`/`unpublishItem` оновлені.
- `src/lib/content/store/adapter.ts` — `assert{Readable,Published}MediaPath`,
  `readMedia`/`putPublishedMedia`/`listPublishedMedia`/`deletePublishedMedia` у
  інтерфейсі; `localFs.ts` + `github.ts` реалізують.
- `src/app/api/panel/route.ts` — дія `complete-deletion` + `respond()`.
- `src/app/panel/page.tsx` — `<PendingDeletions>`; `PanelActions.tsx` — variant `solid`.
- `scripts/migrate-born-at.mjs`, `scripts/migrate-freeze-published-photos.mjs`.
- `src/lib/content/panelStore.test.ts` — +23 тестів (усього 315 pass / 0 todo).

**Код попередніх серій (П35–П37):**
- `src/components/ServicePhotos.tsx`, `src/lib/content/servicePhotos.ts`,
  `src/app/[locale]/services/[slug]/page.tsx`.

**Панель (довідково):**
- `src/lib/content/panelStore.ts` — `getPanelData` / `confirmLocale` / `publishItem` / `unpublishItem`
  (kind-generic, дію обирає `KINDS[kindKey]`).
- `src/app/api/panel/route.ts` — POST-дії (`confirm-locale` / `publish` / `unpublish`), потребує `kind`+`id`.
- `src/app/panel/PanelActions.tsx` — рядок 42: `window.confirm(confirmText)` для «Прибрати з сайту».
- `src/lib/content/store/branch.ts` — `resolveContentBranch` (без fallback на `main`).
- `src/lib/keystaticEnabled.ts` — `NODE_ENV !== "production" || github-режим`.
- `next.config.ts` — `publicCsp` (строгий) vs `panelCsp` (+`raw.githubusercontent.com`,
  fix `b038580`; `unsafe-eval` лише в dev і лише для `panelCsp`).
- `src/lib/content/publishedServices.ts` — `getServicesMeta` (віддає `photos` з розмірами).
- `src/lib/content/imageSize.ts` — інтринсивні розміри JPEG/PNG на збірці.

**Docs:**
- `docs/PANEL-progress.md` — журнал (П18–П37), блок «Поточний стан».
- `docs/PANEL-write-publish-scenario.md` — погоджений hosted-тестовий сценарій.
- `docs/PANEL-test-zzz-run-20260909.md` — протокол П35 (усі SHA + deployment-ID).
- `docs/PANEL-service-photos.md` — поведінка фото послуг + міждеплойна межа + дія власника.
- `docs/PANEL-owner-guide.md` — інструкція власнику (кнопки).
- `docs/PANEL-hosting-and-approvals.md`, `docs/PANEL-owner-request-B1.md`,
  `docs/PANEL-video-hosting.md`, `docs/PANEL-leads-db.md`, `docs/PANEL-costs.md`,
  `docs/PANEL-backup-restore.md`, `docs/PANEL-hosted-verification.md`.

**Пам'ять:** `project-dream-car-vavd-admin-panel-pr26` (оновлено цією сесією),
`project-dream-car-vavd`, `project-dream-car-vavd-git-vercel-state`.

---

## 9. Перший крок нового чату (пропозиція)

1. У `dcv-panel-dev-20260909/repo`: `git fetch && git merge --ff-only
   origin/codex/admin-panel-spike`. **Не** `reset --hard` у папці сервера
   власника.
2. `git ls-remote origin refs/heads/codex/admin-panel-spike` і
   `refs/heads/main` (= `ce1977af`) — звірити, що `main` не зрушився.
3. `npm test && npx tsc --noEmit && npm run lint && npm run content:guard` —
   315 pass / 0 todo, 0, 0, OK.
4. Найближче: (а) жива перевірка заmorозки фото на Preview (розд. 5.5);
   (б) блокери власника Б1–Б5 (розд. `PANEL-progress.md`).
