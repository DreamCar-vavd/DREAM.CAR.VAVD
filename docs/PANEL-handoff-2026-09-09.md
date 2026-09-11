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
| **Remote HEAD** | **`a5be7fd`** (протокол §I/§J) ← `f581540`…`5a516fd` (zzz-цикл через UI, нуль-нетто, 8 комітів) ← `500d692` (rendered-UI + `PANEL_CONTENT_ROOT`) ← `b00cd82` (captured-target check) ← `ee5c9a5` (задача 12:50) ← … ← `8dd6cbc`. **Останній код — `500d692`.** |
| `main` | `ce1977af140b49dce4bb79001c7eeed5e01aa2c2` — **не чіпати, не зрушувався** |
| PR | **#26**, draft, OPEN, MERGEABLE — **не мержити, не знімати draft** |
| CI `Verify` на `500d692` | success |
| Vercel Preview на `500d692` | success |
| Тести / tsc / eslint | **402 pass / 0 todo**, tsc 0, eslint 0, `npm run build` OK, `content:guard` OK |
| Preview-хост (branch alias) | `dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app` |
| Team Vercel | `6y7h9wdz4r-7375s-projects` = `team_DBxz9jzVQflTswVKf9BRzWHo` (Hobby) |

**Реальний контент на HEAD `a5be7fd`:** `git diff 21d9db4..HEAD -- public/ src/content/`
**порожній** (звірено). 49 `_pub`-файлів. Зміни П38–П44 у контенті — лише
`bornAt` (17 карток), namespaced review-ключі, `_pub`-шляхи фото та `publishedAt`
у `published.json` (див. записи П38/П39 у журналі; бізнес-тексти й ціни — ні).
Усі `zzz-*` коміти живої перевірки самоскасовуються (додано+прибрано,
чистий діф нульовий) — на HEAD жодних `zzz` файлів немає.

---

## П44 + Ревізія П44 (12:50 + 13:47) — ЗАВЕРШЕНО

**Стан:** Tip гілки — `a5be7fd`; останній **код** — `500d692`. CI + Vercel на
`500d692` — **success**. **402 тести**, tsc/eslint/build/content:guard — зелені.
`main` @ `ce1977af` — не зрушений. Почати новий чат від актуальної
`origin/codex/admin-panel-spike` (`git fetch && git merge --ff-only`).

**Задача 12:50 (деталі — `docs/PANEL-progress.md`, тести — `PANEL-etap4-protocol.md` E–G):**
- `1438378` — машинна ознака `outcome:"unknown"` (лише `WriteUncertainError`).
- `fbdda32` — `check-result` = окрема лише-читаюча дія (звіряла конкретний ефект).
- `a87d188` — symlink-guard; план очищення прив'язано до `headSha`.
- `ba9d236` — чисті хелпери маршрутизації + 8 сценаріїв.
- `cea07bf`/`8dd6cbc` — жива UI-перевірка **очищення** на Preview → 1 атомарний коміт.
- `ee5c9a5` — інструкція власнику + журнал + протокол + PR #26.

**Задача 13:47 (деталі — `PANEL-etap4-protocol.md` §H/§I/§J):**
- `b00cd82` + `500d692` — «Перевірити результат» звіряє **ПОЧАТКОВУ захоплену
  ціль** (`publishTargetToken` / `localeTextToken[locale]`), не властивості
  рядка після оновлення. H1 (publish-А-урвалась + Б-опублікував-іншу → блок
  лишається, `applied:null`), H2 (confirm-А-виконалось + текст-Б → «застосовано…
  перегляньте картку», розблок) — перевірено **через відрендерений UI** з
  лічильником запитів (без повторного запису). Нове: `PANEL_CONTENT_ROOT`.
- `5a516fd`…`f581540` — **повний цикл `zzz-test-panel` через UI на Preview**
  (create→3× confirm→publish→view→unpublish→delete→complete-deletion),
  нуль-нетто, `git diff 500d692..f581540 -- src/content public/` порожній.
- `a5be7fd` — протокол §I/§J.

**Відкрите (єдине):** справжній CSS-в'юпорт **375 px на авторизованому Preview**
`/panel` — блокер інструмента (`claude-in-chrome` міняє лише вікно ОС;
`innerWidth` лишається 1471). **1 дія власника:** Preview `/panel` → DevTools
device toolbar 375 → знімок (`PANEL-etap4-protocol.md` §J). Локальний 375 (§G) —
окремий доказ. Блокери власника Б1–Б5 — без змін, поза задачею.

**Взірці:** `~/Desktop/DREAM.CAR.VAVD-panel-samples-20260910/task-1347/PROTOCOL.md`
+ `docs/PANEL-etap4-protocol.md` §H/§I/§J. Знімки станів — у сесіях чату.

**Патч постерів Dacia** — `docs/patches/dacia-poster-freeze.patch` +
`README-dacia-poster-freeze.md`, підготовлений, **НЕ застосований**, не чіпати.

**Межі:** `main`/Production/DNS/тарифи/доступи/секрети не чіпати; реальні
матеріали не редагувати; без міграцій, фонових сесій, force-push, руйнівного
reset; Blob/Neon/content-guard→main — поза цим завданням. Руйнівні локальні
перевірки — **лише** в тимчасовій теці (`fs.mkdtemp(os.tmpdir())` через
`new LocalFsStorage({ root })`), на Preview — **лише** `zzz-test-panel` з
прибиранням, **ніколи** `rm -rf` на теки реального контенту.

---

## 2. Робочі копії (git worktrees / клони)

| Шлях | Стан | Призначення |
|---|---|---|
| `/Users/apple/Projects/dcv-panel-dev-20260909/repo` | HEAD `codex/admin-panel-spike` tip (`866b271`), чисто, є `node_modules` + prod-збірка | **робоча копія — працювати тут.** `git fetch && git merge --ff-only origin/codex/admin-panel-spike` перед роботою. |
| `/Users/apple/Projects/DREAM.CAR.VAVD-admin-panel-20260906` | HEAD старий; dev-сервер власника (`:3000`, default) | **НЕ чіпати, НЕ `reset --hard`** — там сервер власника. |
| `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify` | worktree Б1-setup; `.env` (4 секрети, git-ignored); dev `:3010` (webpack) | **не видаляти** доки секрети не в захищеному сховищі власника. |
| `/Users/apple/Projects/dcv-panel-restore-verify-20260909` | клон гілки, HEAD близький до tip | копія для перевірки відновлення (П40/П41). Можна `git fetch && checkout` до потрібного SHA. |
| `/Users/apple/Projects/dcv-restore-verify-20260909/repo` | HEAD `604c27e` | старий базовий стан для порівняння. |

**Рекомендація новому чату:** працювати в `dcv-panel-dev-20260909/repo`
(`git fetch && git merge --ff-only origin/codex/admin-panel-spike`).
**Не** робити `reset --hard` у папці сервера власника `…-admin-panel-20260906`.

---

## 3. Запущені сервери власника — НЕ ЧІПАТИ

- **`:3000`** — `next dev` у `DREAM.CAR.VAVD-admin-panel-20260906`. Сервер власника.
- **`:3010`** — `next dev --webpack` у `…-panel-setup-verify`. Б1-setup, github-режим.
- Свої dev-сервери піднімати на **вільному порту** (`:3023`+). Для локальної
  демонстрації повільної відповіді: `PANEL_DEV_SLOW_MS=8000 npm run dev -- -p 3025`
  (env-прапорець ігнорується у production; додано у П42). `/panel` у local-режимі
  працює (localFs); `RefreshButton` («Оновити стан») рендериться **лише** в
  github-режимі (на Preview), локально його немає. Клієнтський JS у `next dev`
  працює для `/panel` (це не публічна сторінка з жорстким CSP).
- **Після роботи — глушити свої сервери** (`lsof -ti:<port> | xargs kill -9`).

---

## 4. Що зроблено цією серією (журнал — `docs/PANEL-progress.md`, записи П35–П44)

- **П44 — ізоляція тестів + справжній контроль оновлення + захист від повторного запису (задача 2026-09-10 11:49), `9246455`+`21d9db4` (Е1–Е2 done; Е3 ЧАСТКОВО — ревізовано 12:50; Е4 частково; Е5 доповнити):**
  - **Е1** `LocalFsStorage({ root })` + `mutablePath()` (кожна ціль запису/
    видалення жорстко всередині `<root>/public/images/cms/` або
    `src/content/cms/`; `deletePublishedMediaBatch` — лише файл, не тека).
    Пісочниця `src/lib/content/store/localFs.test.ts` у `os.tmpdir()`.
    Зафіксовано інцидент (ручний `rm -rf` на реальну `_pub`-теку, відновлено;
    логіка панелі коректна).
  - **Е2** `useRefresh()`: завершення = `isPending` false (Next App Router),
    таймер лише для підказки «Оновлення триває довше…». Виміряно локально:
    8с→блок 8.8с (не 2.5), швидкий→1.2с.
  - **Е3** стан `uncertain` + кнопка «Перевірити результат» (лише читання) +
    `stateToken` порівняння → «схоже, застосовано/НЕ/невизначений»; авто-
    запису немає.
  - **Е4** локальні протоколи A–D пройдені (подвійний клік → 1 POST; втрачена
    відповідь після виконаного запису → блок → перевірка → розблок, запис
    подіяв); Preview-цикл очищення на синтетичних `zzz-e4` → атомарний
    `866b271`. **Залишок:** знімки Preview, `docs/PANEL-etap4-protocol.md`,
    цикл через кнопку UI.
  - **Е5** не почато — інструкція власнику.

- **П43 — фікс гонки `ConcurrencyGate` + життєвий цикл кнопок (задача 2026-09-10 10:55), `1e923c6`+`f53f8fa`+`b3d8543`:**
  - **§1** ґейт передавав місце очікувачу з вікном, у яке новий `run()` міг
    перехопити дозвіл → `max+1` активних. Фікс: пряма передача дозволу (`active`
    не падає, поки черга непорожня). Винесено в `store/concurrencyGate.ts` +
    `concurrencyGate.test.ts` (розгортка вікна race; наївний ламається, фікс —
    ні). Ліміт лишається 8.
  - **§2** guard кнопок на `busy||refreshing`; описові мітки («Публікується…»);
    розрізнення «збережено» vs «відповідь не отримано»; `aria-live` статуси;
    `CleanupFrozenMediaButton` скидає застарілий план при зміні `publishedVersion`.
    Чиста логіка → `actionMessages.ts` + 7 тестів.
  - **§3** `useSoftRefresh` — видимий стан `refreshing` ~2.5 с після дії
    (`router.refresh()` не тримає `useTransition` pending). `loading.tsx`
    підтверджено на прямому відкритті (перший чанк HTML має скелет).
  - 374 pass · tsc 0 · eslint 0 · build OK. Реальний контент недоторканий.

- **П42 — паралельний `readDir` + індикація + захист від подвійного кліку (задача 2026-09-10 10:23), `7ac1cc4`:**
  - **§2** `GitHubStorage.readDir` читає JSON колекції через `ConcurrencyGate`
    (ширина 8), спільний на всі 5 колекцій. Порядок / version / `atSha` / помилки
    / бюджет часу збережені. **Тепле відкриття `/panel` на Preview: 2.55 → 1.5 с
    (−40 %)** за однакових умов.
  - **§3** новий `src/app/panel/loading.tsx` (скелет + спінер); `PanelButton` /
    `CleanupFrozenMediaButton` — синхронний `useRef` in-flight guard (2 швидкі
    кліки не дублюють запит), після помилки інтерфейс лишається придатним.
  - **§4** `docs/patches/dacia-poster-freeze.patch` — окремий, **НЕ застосований**
    патч на `posterSrc` 2 Dacia (2 рядки `published.json` → наявні байт-ідентичні
    `_pub`-копії). Перевірено в окремому worktree, `git apply --check` чисто.
  - 354 pass, tsc 0, eslint 0, build OK. Реальний контент не змінювався.

- **П41 — узгоджений знімок для очищення + постер відео (задача 2026-09-10), `62c8554`+`865eddd`:**
  - **§1** `readFile/readDir/mediaIndex` отримали `atSha`; `frozenMediaCandidates`,
    `completeDeletion` (медіафаза — свіжий S2 після власного запису) та
    `getPanelData` читають усе **закріплено на одному коміті** — статус картки
    не з різних версій.
  - **§2** github-режим: підтвердження очищення **вимагає** `headSha` (без нього =
    застаріле). `deletePublishedMediaBatch` відхиляє **обрізане** базове дерево.
  - **§3 жива перевірка на Preview** (`865eddd`, сесія власника): синтетичні `_pub`
    `zzz-test-panel` через GitHub API → сухий прогін (count 1) → рух гілки →
    підтвердження старим `headSha` = **409 конфлікт, 0 видалень** → новий сухий
    прогін → коректне очищення **одним** комітом `panel: drop 2 unreferenced
    media file(s)` (лише ті 2 шляхи). Чистий діф `865eddd..HEAD` порожній.
  - **§4** `video.posterSrc` (локальний CMS) заморожується як фото: копія `_pub/`,
    порівняння за blob-id, захист від очищення, `MediaMissingError`. 2 реальні
    авто — плоский постер, заморозиться при наступній публікації, **без міграції**.
  - **§5** Preview `/panel`: cold 3.7 с, warm ~2.0 с (новий код). Мережа −54
    звернення / −39.5 МБ (виміряно). 352 pass.

- **П40 — атомарне очищення `_pub` + git-дерево для визначення змін (задача 18:51), `ee93d24`:**
  - **§1** `cleanupFrozenMedia` — **двокроковий** (сухий прогін показує
    кількість+обсяг+SHA гілки; підтвердження = `deletePublishedMediaBatch(paths,
    expectedHeadSha)` — один атомарний Git Data коміт + не-force оновлення гілки).
    Публікація між кроками → `ConflictError`, нічого не видалено. `completeDeletion`
    користується тим самим захищеним пакетом. Старий одиничний
    `deletePublishedMedia` видалено.
  - **§2** пакет повертає `deleted` / `already-absent`; 409/422/обрив → конфлікт
    або transient — **ніколи «прибрано N»** без підтвердженого видалення.
  - **§3** `getPanelData` більше **не читає кожне фото**: один `mediaIndex()`
    (`git/trees?recursive=1` з одного коміту), порівняння git-blob-id робочого
    фото проти git-blob-id `_pub`-копії. Обрізане/помилкове дерево → помилка, не
    «in-sync». **Вимір:** 83→29 звернень до GitHub, 39.7→0.15 МБ на рендер.
  - **§4** тести: керована гонка очищення↔публікація, transient при помилці
    пакета, `mediaIndex` помилка ≠ in-sync, фото >1 МБ; `github.test.ts` для
    `headSha`/`mediaIndex`/`deletePublishedMediaBatch`. 340 pass.
  - Реальний контент **не змінювався**, міграцій не було. Фікс читання >1 МБ
    (`f80fab7`) збережено.

- **П39 — доопрацювання пайплайну фото + namespace ключів review (задача 17:38), `115520c`→`f80fab7`:**
  - **§1** `inSyncIgnoringFrozenPhotos` читає й хешує кожне робоче фото → заміна
    A→B за тим самим шляхом і перестановка тепер = «є неопубліковані зміни».
  - **§2** `planFrozenMedia` (був `freezeItemMedia`) кидає `MediaMissingError` /
    типізовану помилку замість тихо публікувати неповну картку; `published.json`
    не чіпається, попередні фото цілі.
  - **§3** авто-GC прибрано; `cleanupFrozenMedia` — окрема version-guarded дія +
    кнопка «Прибрати старі копії фото»; `publishItem` re-put копій після знімка
    (гонка з очищенням безпечна). `review-state.json` ключі namespaced
    (`car:foo`) — `cars/foo` і `services/foo` мають окремі підтвердження;
    `scripts/migrate-review-keys.mjs`.
  - Preview (github-режим): §3b `service:zzz-card`; §4 картка (recreate → всі
    мови потребують перевірки → confirm uk → en/ru лишились); §4 фото — freeze
    на github-режимному publish дав `_pub/<hashA>` у `published.json` +
    закомічений файл.

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

### 5.5. ✅ Міждеплойна властивість фото — ЗАКРИТО (П38 §5–6 + П39)
Заморозка у `_pub/` діє для авто, галереї, послуг, банерів. **Перевірено на
Preview (github-режим, `zzz-photo`):** publish A → `_pub/<hashA>` у знімку +
глядач бачить A (байти звірені) → заміна робочого фото на B без публікації +
нова збірка Vercel → **глядач і далі бачить A** (`_pub/<hashA>`, байти = A),
редактор у чернетці бачить B (робочий шлях, байти = B), панель = «є
неопубліковані зміни» → publish B → `_pub/<hashB>` (стара `_pub/<hashA>`
лишилась — очищення відкладене).

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

**Код П38 + П39:**
- `keystatic.config.ts` — `bornAtField()` у 4 колекціях + сінглтоні.
- `src/lib/content/carsGate.ts` — `ReviewRow.instance`, `reviewInstanceMatches`,
  `reviewRowFor`, `GateContext.{instance,reviewKey}`; 4 інші гейти → `reviewRowFor`.
- `src/lib/content/panelStore.ts` — `reviewKeyFor` (namespace), `instanceToken`/
  `instanceMap`, `planFrozenMedia`/`writeFrozenMedia`/`inSyncIgnoringFrozenPhotos`
  (content-aware, async), `completeDeletion`, `freezePublishedMedia`,
  `cleanupFrozenMedia`; `getPanelData` (async rows) / `confirmLocale` (namespaced
  write + legacy consolidation) / `publishItem` (plan→write→snapshot→re-put) /
  `unpublishItem` (no GC).
- `src/lib/content/store/adapter.ts` — `MediaMissingError`,
  `assert{Readable,Published}MediaPath/Dir`, `readMedia`/`putPublishedMedia`/
  `listPublishedMedia`/`deletePublishedMedia`; `localFs.ts` + `github.ts` реалізують
  (github: типізовані помилки на транспорт/не-2xx).
- `src/app/api/panel/route.ts` — дії `complete-deletion` + `cleanup-frozen-media` + `respond()`.
- `src/app/panel/page.tsx` — `<PendingDeletions>` + кнопка «Прибрати старі копії фото»;
  `PanelActions.tsx` — variant `solid`, дії `complete-deletion`/`cleanup-frozen-media`.
- `scripts/migrate-born-at.mjs`, `migrate-freeze-published-photos.mjs`, `migrate-review-keys.mjs`.
- `src/lib/content/panelStore.test.ts` — усього **326 pass / 0 todo**.

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
