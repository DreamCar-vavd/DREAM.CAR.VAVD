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
- **Remote = Local HEAD:** `1d3fdb9` (П35 — реальний тест `zzz-test-panel`
  виконано на Preview, 2026-09-09 ~13:30 BST). `main` =
  `ce1977af140b49dce4bb79001c7eeed5e01aa2c2` — **не зрушив** за весь тест
  (звірявся `git ls-remote origin` після кожної дії). PR #26 draft.
  Фінальний Preview deployment `5sxMSQBPudCRarwVsxAQyccVhkET` (`1d3fdb9`) —
  Ready; branch alias
  `dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`.
  Протокол тесту — `docs/PANEL-test-zzz-run-20260909.md`.
  **Стан даних CMS після тесту = початковому** (звірено вмістом, не назвами):
  усі 5 послуг / 3 авто / 8 галерея / контакт / `review-state.json` —
  байт-у-байт як до тесту; єдина відмінність — `published.json.publishedAt`
  (`2026-09-06T00:00:00Z` → `2026-09-09T13:25:15Z`, штатна зміна `publishItem`).
  Тестові коміти лишились в історії гілки (історію не переписували).
- **hosted Б1 — перевірено (П32, Chrome власника, авторизована сесія):**
  вхід через GitHub (callback на Preview-хост) ✅ · Keystatic-дашборд ✅ ·
  `/panel` на `codex/admin-panel-spike` ✅ · **3 авто / 8 галерей / 5 послуг /
  1 контакт** ✅ · редактор запису з полями + фото + uk/en/ru ✅ (після CSP-фіксу
  `b038580`) · перегляд чернетки (`/api/panel/preview` → `/uk` на Preview-хості)
  ✅ · банер «на тестовому сайті гілки codex/admin-panel-spike (Preview)» ✅ ·
  **вихід** → `/panel`,`/panel/leads` показують app-gate, `/api/panel/preview`
  → 401 ✅ · **повторний вхід** → доступ відновлено, гілка та 3/8/5/1 ✅.
  Vercel Authentication цю сесію не блокує (**не** доказ для всіх відвідувачів).
- **НЕ перевірено:** ширина 375 px (інструмент не змінює viewport — лишається
  1699 px; CSS відповідний, але візуально не звірено); запис/публікація з панелі
  (окремий погоджуваний сценарій — `docs/PANEL-write-publish-scenario.md`).
- **Сигнали:** GitHub CI `Verify` — success; Vercel Preview build `a77d3e4` —
  **Ready** 39s (3 давні `localFs.ts` warnings, доброякісні). tsc 0 · eslint 0
  (П31; локальний `npm run build` не запускався — Turbopack робить Vercel).
- **Preview (Vercel):** `be85c0b` **Ready**; стабільний branch alias
  `dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`
  віддає цей deployment. `/panel` без входу → правильний app-gate
  «Ви не увійшли через GitHub».
- **Робочі копії:** код гілки — `/Users/apple/Projects/DREAM.CAR.VAVD-admin-panel-20260906` (тут `git log`, коміти, head `b28bcac`). Локальний dev-сервер :3010 обслуговує окремий worktree `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify` (той самий кінець гілки, `359c108`; має додатковий git-ignored `.env`/`.env.local`). Різниця SHA між ними — лише документаційний коміт `b28bcac`; **перезапуск :3010 через це не потрібен** (код сторінок не змінювався).

### Б1 (GitHub App) — стан на 2026-09-08

| Крок | Стан |
|---|---|
| App створено | ✅ `github.com/settings/apps` (@DreamCar-vavd) → **один** App «DreamCar-vavd Keystatic», slug `dreamcar-vavd-keystatic` |
| `.env` setup-копії | ✅ 4 ключі наявні й придатні (звірено без показу значень): `KEYSTATIC_GITHUB_CLIENT_ID` `Iv23…`/20, `_CLIENT_SECRET` 40, `KEYSTATIC_SECRET` 80 hex, `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=dreamcar-vavd-keystatic`. Права `600`, git-ignored |
| `.env.local` | ✅ `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github`, repo owner/name, **`PANEL_CONTENT_BRANCH=codex/admin-panel-spike`** (додано у П19) |
| Setup-сервер :3010 | ✅ `next dev --webpack -H 127.0.0.1` (pid у `setup-server.log`), вантажить `.env.local, .env` |
| OAuth-вхід | ✅ **працює** — власник входить, Keystatic + `/panel` відкриваються, читаються 3 авто / 8 галерея / 5 послуг / 1 контакт на `codex/admin-panel-spike` (П19, П20) |
| App **встановлено** на репозиторій | ✅ **ЗРОБЛЕНО** (П22) — `settings/installations`: **Only select repositories → DreamCar-vavd/DREAM.CAR.VAVD**; Contents **Read and write**; Metadata/Pull requests/Deployments **Read**; **Webhook Active off**; Client ID `Iv23ligKwtoqGEQNKSIk`, Redirect URI `http://127.0.0.1:3010/api/keystatic/github/oauth/callback` |
| Тест виходу з живої сесії | ✅ **ПРОЙДЕНО** (П22, у Chrome власника): Sign out → `/panel`,`/panel/leads`,`/panel/video` → «Ви не увійшли»; раніше відкрита чернетка `/uk` → «Сесію завершено або відкликано — показано опубліковану версію»; новий `/api/panel/preview` → 401 |
| Повторний вхід | ✅ **ПРАЦЮЄ** (П22) — «Log in with GitHub» → авто-approve (без consent/Confirm access) → Keystatic + `/panel` з `codex/admin-panel-spike`, матеріали 3/8/5/1 |
| Vercel Preview | ⏳ **готовий запит** — `docs/PANEL-owner-request-B1.md`, alias звірено |

**Локальний Б1 завершено.** Не перевірено: запис/публікація з панелі
(`Contents: write` надано, коміт не робився); робота на Vercel Preview.
- **Preview:** публічні сторінки працюють; `/panel` + `/keystatic` = **404** без github-env
- **Setup GitHub App готовий до дії власника:** ізольований worktree
  `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify` (кінець гілки),
  `.env.local` (3 несекретні рядки) на місці, `next dev` на `http://127.0.0.1:3010`.
  Одна дія власника — `docs/PANEL-owner-request-B1.md`. Секрети після створення App
  запишуться у `…-panel-setup-verify/.env` (git-ignored). Worktree **не видаляти**.
- **Перша спроба власника впала** («We didn't find an App Manifest»; власник
  БУВ залогінений, екран «Confirm access»/sudo). Доведено: маніфест доходить і
  приймається; попередження React — не причина. НЕ доведено: що ~5-хв cookie
  згас саме тоді. Практичне усунення: зняти sudo наперед на
  `github.com/settings/apps` → одразу пройти setup; повторний збій → ручний
  шлях. Деталі — журнал П18, `docs/PANEL-owner-request-B1.md`.
- **Незакомічених змін у гілці немає**

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

### П35 — реальний тест `zzz-test-panel` на Vercel Preview (створення → публікація → конфлікт → прибирання)

**Дата:** 2026-09-09 ~12:56–13:30 BST. **Дозвіл власника:** отримано (задача 13:25).
**Гілка:** `codex/admin-panel-spike`, `main` **не чіпався** (звірявся `ls-remote`
після кожної дії — весь тест `ce1977af`). Повний протокол із SHA й deployment-ID
кожного етапу — **`docs/PANEL-test-zzz-run-20260909.md`**.

**Що перевірено (все ✅):**
- **Створення** через Keystatic: коміт лише в робочу гілку, лише
  `services/zzz-test-panel.json`. Поле-лічильник «Порядок» через автоматизацію не
  прийняло значення з першого разу — виправлено Save (не дефект панелі).
- **Гейт публікації:** до підтвердження 3 мов кнопка `disabled`; після — активна.
  Правка `uk`-тексту скидає **тільки** `uk`. Зміна спільної ціни підтверджень
  **не** скидає (ціна не в хеші). У `review-state.json` доданий лише ключ тесту,
  чужі записи не змінені.
- **Фото:** окремий файл `public/images/cms/services/zzz-test-panel/photos/0/image.jpg`
  (шлях — рівно як прогнозував сценарій). Показ у редакторі Keystatic ✅
  (`raw.githubusercontent.com` → 200, CSP-фікс `b038580`). Публічний UI послуг
  фото **не рендерить** — відома відсутня фіча (`ServicesGrid.tsx`,
  `services/[slug]/page.tsx` не вживають `meta.photos`) → окрема продуктова задача.
- **Чернетка vs глядач:** до публікації — редактор у draft-режимі бачить матеріал
  на `/uk|en|ru`, глядач без draft отримує 404 і не бачить у списках.
- **Публікація за SHA:** коміт лише `published.json`; deployment Ready; branch alias
  веде на нього; глядач бачить `/uk|en|ru/services/zzz-test-panel` = 200 з
  правильними мовними текстами й ціною £60; інші матеріали в `published.json` —
  без змін проти базового стану.
- **Конфлікт двох вкладок одного власника:** A публікує зміну 2 → B зі старими
  версіями натискає «Опублікувати зміни» → `ConflictError` («Дані «контент»
  змінилися відколи ви відкрили сторінку… Оновіть сторінку.» + «Оновити»).
  Коміту від B немає, опублікована версія A ціла. JavaScript для обходу не
  вживався.
- **Прибирання — обидва способи:**
  - *Звичайний:* «Прибрати з сайту» → рідний `window.confirm()` (панель, рядок 42
    `PanelActions.tsx`). Спершу **Cancel** — запис лишився; потім **OK** —
    `unpublish` коміт, робоча картка ще на місці, глядач 404.
  - *Опублікований запис без робочої картки:* повторна публікація → видалення
    картки в Keystatic (коміт прибрав і JSON, **і файл фото**) → `/panel` показує
    рядок-сироту «Робочу картку видалено. Опублікована версія ще залишається на
    сайті.» з **єдиною** кнопкою «Прибрати з сайту» (без редагування, публікації,
    підтверджень мов) → її натиск очистив `published.json`; робоча картка
    автоматично **не** створилась.
- **Фінальне прибирання:** усі тестові шляхи `zzz-test-panel` відсутні в гілці;
  `/uk|en|ru/services/zzz-test-panel` і файл фото → 404; наявні матеріали,
  медіа й `review-state.json` — **байт-у-байт як до тесту**; `main` = `MAIN_SHA_0`.
  Єдина лишкова відмінність — `published.json.publishedAt` (штатна зміна).

**Знайдений дефект:** видалення елемента колекції в Keystatic прибирає картку
та її фото, але **лишає** запис `<slug>` у `src/content/cms/review-state.json`.
Довелося чистити вручну (коміт `1d3fdb9`). Окрему задачу на виправлення
підготовлено (chip `task_6cee6cb0`).

**Не перевірено (як і раніше):** справжній viewport 375 px; показ фото послуг на
сайті (окрема фіча). Тест **однієї послуги** не є підтвердженням циклу інших
колекцій (авто, галерея, банери, контакти).

### П34 — контрольна точка відновлення + сценарій `zzz-test-panel` фіналізовано (Етапи 1–2)

**Дата:** 2026-09-09 ~12:34 BST. **Коміти:** `48d39d3` (уточнення сценарію),
`e8d3dba` (фіналізація сценарію, Етап 2), цей запис. **Реальні записи в панель
НЕ робились** — Етапи 3–6 чекають окремого «так» власника.

**Стан Git на момент точки:**
- Local HEAD `e8d3dba`, робоче дерево чисте.
- `origin/codex/admin-panel-spike` = `a77d3e4`; незапушені `0107420`, `4fe9c0e`,
  `48d39d3`, `e8d3dba` — **лише `docs/`**.
- `main` = `ce1977af140b49dce4bb79001c7eeed5e01aa2c2` (`git ls-remote`, не кеш).
- Розбіжності гілок немає (fast-forward), reset/force-push не потрібні.

**Робочі копії (призначення):**
| Шлях | Призначення | Гілка / кінець |
|---|---|---|
| `/Users/apple/Projects/DREAM.CAR.VAVD-admin-panel-20260906` | основна: `git log`, коміти, редагування коду й доків | `codex/admin-panel-spike`, HEAD `e8d3dba` |
| `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify` | worktree setup GitHub App; тримає git-ignored `.env` (секрети) + `.env.local`; dev-сервер :3010 (`next dev --webpack -H 127.0.0.1`, pid у `setup-server.log`) | той самий кінець гілки |
| `/Users/apple/Projects/DREAM.CAR.VAVD` | канонічний репозиторій сайту (Production/`main`), **цим завданням не чіпається** | `main` |

**Перевірений deployment:** `CZREYKxhJC7ziAH93w1x45qp5pKD` (`a77d3e4`, Preview,
Ready) через стабільний alias
`dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`.
Hosted-перевірка входу/читання/чернетки/виходу — П32.

**Команди запуску / перевірки:**
```
# у основній копії
git fetch origin && git status && git log --oneline origin/codex/admin-panel-spike..HEAD
git ls-remote origin refs/heads/main refs/heads/codex/admin-panel-spike
npm ci && npx tsc --noEmit && npm run lint && npm test   # Turbopack build робить Vercel, локально не потрібен
# setup-worktree (github-режим, окремо):
cd ../DREAM.CAR.VAVD-panel-setup-verify && npm run dev   # :3010, вантажить .env.local + .env
```

**Env-змінні (точні назви й область — БЕЗ значень):**
- Vercel, проєкт `dream.car.vavd`, **Environment = Preview, прив'язка лише до
  гілки `codex/admin-panel-spike`** (не Production/Development) — 7 шт.:
  | Назва | Область | Секрет? |
  |---|---|---|
  | `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND` (`github`) | Preview/branch | ні |
  | `KEYSTATIC_GITHUB_REPO_OWNER` (`DreamCar-vavd`) | Preview/branch | ні |
  | `KEYSTATIC_GITHUB_REPO_NAME` (`DREAM.CAR.VAVD`) | Preview/branch | ні |
  | `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` (`dreamcar-vavd-keystatic`) | Preview/branch | ні (публічний slug) |
  | `KEYSTATIC_GITHUB_CLIENT_ID` | Preview/branch | ідентифікатор (лише в env) |
  | `KEYSTATIC_GITHUB_CLIENT_SECRET` | Preview/branch | **СЕКРЕТ** |
  | `KEYSTATIC_SECRET` | Preview/branch | **СЕКРЕТ** (підпис сесії) |
  Скорочені імена (`CLIENT_ID` тощо) код не читає.
- Локальний setup-worktree `.env` (git-ignored, права `600`): `KEYSTATIC_GITHUB_CLIENT_ID`
  (`Iv23…`, 20), `KEYSTATIC_GITHUB_CLIENT_SECRET` (40), `KEYSTATIC_SECRET`
  (80 hex), `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. `.env.local` (несекретні):
  `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github`, `KEYSTATIC_GITHUB_REPO_OWNER`,
  `KEYSTATIC_GITHUB_REPO_NAME`, `PANEL_CONTENT_BRANCH=codex/admin-panel-spike`.
- Значення секретів у Git / звіти / знімки **не** потрапляють.

**Як відновити цю версію в окремій папці:**
```
git clone <origin> DREAM.CAR.VAVD-restore && cd DREAM.CAR.VAVD-restore
git checkout codex/admin-panel-spike
git checkout e8d3dba          # або конкретний перевірений SHA
npm ci
# для github-режиму: створити .env + .env.local вручну зі свого захищеного
# сховища секретів (у репозиторії їх немає — див. нижче)
```

**Що входить у збережений стан (GitHub):** увесь код панелі, гейти, тести,
контент CMS (`src/content/cms/**` — авто/галерея/послуги/контакти + `published.json`,
`review-state.json`), **фотографії матеріалів** (`public/images/cms/**` — вони
закомічені в гілку, не зовнішнє сховище), документи, `keystatic.config.ts`.

**Що GitHub НЕ покриває (тому резервування коду — не «повне»):**
- **Секрети** — 4 значення у `…-panel-setup-verify/.env` і 7 змінних Vercel
  Preview. У Git їх немає (правильно). **Погодженої захищеної копії секретів
  наразі немає.**
  → **Дія власника:** зберегти ці значення у власному менеджері паролів
  (окремий запис «DREAM.CAR.VAVD Keystatic Preview», поля = назви змінних вище).
  Без цього втрата `.env` = повторна генерація Client Secret у GitHub App.
- **Налаштування зовнішніх сервісів:** сама GitHub App `dreamcar-vavd-keystatic`
  (App ID, права, встановлення на репозиторій), прив'язка змінних Vercel до
  гілки, Vercel Deployment Protection — конфігурація в консолях, не в репо.
- **Не підключені (тому й не резервуються):** Vercel Blob (відео, Б2), Postgres
  заявок (Б3).

**Що зроблено (Етап 2):** `docs/PANEL-write-publish-scenario.md` доведено до
готовності — передумова чистоти, `iconSrc` = наявна іконка `premium-3d/06`,
розділення перевірок фото (завантаження / редактор / публічна сторінка —
остання: фото послуг UI **не рендерить**, це окрема продуктова задача),
окремі cookie-контексти редактор/глядач, таблиця «куди дивитись при втраченій
відповіді» (перевірка за актуальним SHA, не за рухом HEAD), звірка вмісту
інших матеріалів (не лише назв) із виносом `published.json.publishedAt` як
штатної зміни.

**Що перевірено:** Git-стан (локально + `ls-remote`), склад незапушених комітів
(лише docs), наявність іконки `06-auto-moto-special-equipment-premium-3d.png`,
відсутність рендера `photos` у `ServicesGrid.tsx` та
`src/app/[locale]/services/[slug]/page.tsx`, `iconSrc` = `fields.text`,
патерн шляху фото послуг (`keystatic.config.ts` services → `photos.image`
`directory:"public/images/cms/services"` `publicPath:"/images/cms/services"`).

**Не перевірено (потрібен окремий дозвіл або інструмент):** будь-який реальний
запис у панель; справжній viewport 375px.

**Залишок:** push виконано (`d6e4da3`, Vercel + CI success); після «так»
власника саме на сценарій `zzz-test-panel` — Етапи 3–6.

### П33 — 375 px (`/panel`), клавіатура, CSP-заголовки на deployment, сценарій готовий до погодження

**2026-09-09 ~11:14–11:30 BST.** Deployment без змін — `CZREYKxhJC7ziAH93w1x45qp5pKD` (`a77d3e4`).

**1. Вузький екран.**
- **`/panel` при 375 px — перевірено** через CSS-звуження `html{width:375px}`.
  Це коректно: сторінка панелі має **нуль** width-медіазапитів (звірено в
  джерелі — `sm:`/`md:`/`lg:` = 0 у `page.tsx`/`PanelActions.tsx`/`layout.tsx`;
  у `globals.css` лише `prefers-reduced-motion`/`hover`), тож reflow при 375 px
  визначається лише flexbox-wrap і `max-w`.
  Результат: `main.scrollWidth === main.clientWidth` (375), `body` overflow = 0
  — **горизонтального скролу немає**; банер, назви, мовні статуси (`UK … EN …` /
  `RU …`), nav-«пігулки», кнопки «Опублікувати зміни»/«Прибрати з сайту» —
  **переносяться, не обрізаються**. Знімок — у звіті.
- **Keystatic-UI при 375 px — НЕ перевірено.** CSS-звуження на Keystatic не діє
  (його layout на viewport-одиницях ігнорує `html{width}`), а справжньої
  device-емуляції в цьому автоматизаційному Chrome немає (`resize_window`
  лишає `innerWidth 1699`; `Browser`-панель мала б mobile-preset, але потребує
  окремого GitHub-входу). **Ручна перевірка власнику** (нижче).

**2. Клавіатура на `/panel` (Preview, практично).**
- 50 tabbable-елементів, **0 позитивних `tabindex`** (немає пасток/дивного
  порядку); DOM-порядок = порядок читання (Keystatic-лінк → «чернетка» →
  «Заявки» → «Відео» → nav-пігулки → «Оновити стан» → у картці: «Редагувати» →
  [«Опублікувати» якщо активна] → «Прибрати з сайту»).
- **Фокус видимий:** `outline: rgb(212,175,55) solid 2px; outline-offset: 2px`
  (золоте кільце) на лінках і пігулках; у стилях немає `outline:none`/`0`.
  На знімку 375 px видно кільце на кнопці «Переглянути чернетку».
- Кнопки запису/публікації/видалення **не активував**.

**3. CSP-виправлення `b038580` — закрито.**
- **Копія:** `b038580` зроблено в `/Users/apple/Projects/DREAM.CAR.VAVD-admin-panel-20260906`
  — **тій, яку обслуговує `:3000`** (pid 13009, cwd збігається; сервер власника
  за цей час перезапустився — pid змінився з 71636). `next.config.ts` — файл,
  який дев-сервер читає, — **було змінено й закомічено**; `next dev`
  перечитує конфіг при таких змінах. Тому **не** стверджую, що файли сервера
  лишились незмінними. `npm run build` там **не** запускав. **Надалі — правки
  тільки в ізольованому worktree.**
- **Сукупний diff `b28bcac..HEAD` для CSP:** лише `next.config.ts` —
  `raw.githubusercontent.com` додано в `connect-src` + `img-src` **`panelCsp`**.
  `publicCsp` — **байт-у-байт як на `b28bcac`** (`diff` порожній).
- **Живі заголовки відповіді на deployment `a77d3e4`:**
  | Маршрут | `connect-src` | `raw.githubusercontent.com`? |
  |---|---|---|
  | `/panel`, `/keystatic`, `/api/keystatic/*` | `'self' api.github.com github.com raw.githubusercontent.com` | ✅ |
  | `/uk`, `/uk/services/detailing`, `/robots.txt`, `/api/contact` | `'self'` | ❌ (строгий public CSP) |
- **Редактор + фото на фінальному deployment:** редактор `volvo-xc60-d5` —
  `raw.githubusercontent.com/…/gallery/volvo-xc60-d5.json` **200** + 5 фото
  `photos/0…4/image.jpg` **200**; редактор `detailing` — поля + 3 мови. ✅

**4. Сценарій `docs/PANEL-write-publish-scenario.md` — уточнено (той самий файл):**
- Публічні адреси: `/[locale]/services/<slug>` (`/uk|en|ru/services/zzz-test-panel`);
  без-локальний `/services/<id>` → **404** (звірено наживо).
- Шлях фото — **визначає Keystatic при Save**; патерн підтверджено наживо для
  галереї (`/images/cms/gallery/volvo-xc60-d5/photos/0/image.jpg`); фактичний
  шлях брати з дифу коміту, не з припущення.
- Незмінність `main` — `git ls-remote origin refs/heads/main` **мережею**, до і
  після; локальний `origin/main` без `fetch` не доказ.
- Додано: перелік файлів, які можуть змінитися (лише `services/zzz-test-panel.json`,
  `public/images/cms/services/zzz-test-panel/…`, `review-state.json`,
  `published.json` — у гілці контенту); дії при `WriteUncertainError` /
  `StorageUnavailableError` / `ConflictError` з точними текстами з UI.

**Залишок:** Keystatic-UI при 375 px (ручна перевірка власнику); запис/публікація/
видалення з панелі — сценарій на погодження.

### П32 — hosted-перевіркa панелі на Vercel Preview пройдена (вхід/читання/чернетка/вихід/повторний вхід)

**2026-09-09 ~11:00–11:06 BST.** Deployment CSP-фіксу `b038580`+journal —
**`CZREYKxhJC7ziAH93w1x45qp5pKD`** (`a77d3e4`, Preview, **Ready** 39s). Push
`be85c0b..a77d3e4`. Branch alias
`dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`
веде на нього (звірено: у запитах Keystatic-UI `raw.githubusercontent.com/…/a77d3e46…`).

**CSP-фікс `b038580` — підтверджено на Vercel:** редактор запису
`…/collection/galleryProjects/item/volvo-xc60-d5` → `raw.githubusercontent.com`
для `gallery/volvo-xc60-d5.json` **200** + 5 фото `photos/0…4/image.jpg` **200**;
`…/collection/services/item/detailing` — поля + 3 мови рендеряться. До фіксу
було «TypeError: Failed to fetch» (CSP `connect-src` без `raw.githubusercontent.com`).

**Пройдений сценарій (Chrome власника, авторизована сесія — не тест для всіх відвідувачів):**
1. `/api/keystatic/github/login` → GitHub (авто-approve) → **callback на
   Preview-хост** (`…648563-…`, не 127.0.0.1) → **Keystatic-дашборд** «Hello,
   DreamCar-vavd!».
2. `/keystatic/branch/codex%2Fadmin-panel-spike` → «ПОТОЧНА ГІЛКА:
   codex/admin-panel-spike», «Pull request #26», **Автомобілі 3 · Галерея 8 ·
   Послуги 5 · Банери 0 · Контакти**. (`/branch/main` → 0 скрізь — на `main`
   немає CMS-контенту, очікувано.)
3. `/panel` → «Робоча гілка: **codex/admin-panel-spike** (тестова гілка — не
   Production)»; банер «✅ Поточний знімок **на тестовому сайті гілки
   «codex/admin-panel-spike»**. (Preview)».
4. Матеріали: **3** авто (suzuki-sx4-s-cross, dacia-sandero-2022,
   dacia-sandero-comfort-2019) · **8** галерей (maserati-levante, volvo-xc60-d5,
   showcase-01…06) · **5** послуг (car-selection, car-service, diagnostics,
   srs-airbag, detailing) · **1** контакт. Банери — 0. **Точно 3/8/5/1.**
5. Усі записи «● На сайті», UK/EN/RU «Перевірено», «Неопублікованих змін немає».
6. Посилання редагування — **branch-scoped**
   (`/keystatic/branch/codex%2Fadmin-panel-spike/collection/<c>/item/<id>`);
   Create — `.../create`; draft-preview — `/api/panel/preview?path=/uk`.
7. **Редактор запису** (gallery `volvo-xc60-d5`): 5 фото, uk «Проведено
   комплексну перевірку автомобіля…», en «Information to be confirmed», ru
   «Информация уточняется». Service `detailing`: uk/en/ru bullets («Полірування
   кузова» / «Bodywork polishing» / «Полировка кузова» тощо). **Нічого не збережено.**
8. **Чернетка:** `/api/panel/preview?path=/uk` → редірект на `/uk` **на
   Preview-хості**, повний сайт (hero, Послуги ×6 з «Незабаром», Галерея ×2,
   FAQ, Контакти).
9. **Вихід** (`/api/keystatic/github/logout`): `/keystatic` → «Log in with
   GitHub»; `/panel` та `/panel/leads` → app-gate «Ви не увійшли через GitHub…»
   (даних немає); `GET /api/panel/preview?path=/uk` → **401**.
10. **Повторний вхід** (`/api/keystatic/github/login`) → без consent →
    дашборд; `/panel` знову доступний, гілка `codex/admin-panel-spike`, 3/8/5/1.

**Keyboard:** `/panel` — 67 focusable елементів, усі досяжні з клавіатури;
у стилях **немає** `outline:none`/`outline:0` (фокус UA-кільцем не придушено);
кнопки `min-height:36px`.

**НЕ виконано — 375 px:** `resize_window` не змінює CSS-viewport в цьому
автоматизаційному Chrome (лишається `innerWidth 1699` при `outerWidth 619`).
CSS панелі responsive (`flex flex-wrap`, `max-w-4xl px-4`, без фіксованих
ширин), але **візуально при 375 px не звірено** — не видавати за перевірку на
телефоні.

**Причина 401 (П30) — остаточно:** саме хибне збережене
`KEYSTATIC_GITHUB_CLIENT_SECRET`. Власник переввів його зі `…-panel-setup-verify/.env`;
один redeploy `be85c0b` (`73uaLMwQqhn3gT4Nd8dpdvbnbs3m`, Ready) → вхід запрацював.
Розбір коду Keystatic у П30 лишається чинним (`state`/`KEYSTATIC_SECRET` не
задіюються, доки token-exchange не вдався; точний код помилки GitHub був
недоступний).

**Залишок:** 375 px візуально; запис/публікація/видалення з панелі (окремий
сценарій `docs/PANEL-write-publish-scenario.md` — на погодження, не виконано).

### П31 — вхід на Vercel запрацював; редактор Keystatic — CSP-фікс `raw.githubusercontent.com`

**2026-09-09 ~10:47–11:05 BST.**

**1. Причина 401 (П30) — підтверджено.** Власник **переввів**
`KEYSTATIC_GITHUB_CLIENT_SECRET` у Vercel зі `…-panel-setup-verify/.env` (40
символів; тип/область не мінялися — Vercel показує «Updated», scope
`Preview`/`codex/admin-panel-spike`). Уточнення історії від власника: спершу той
самий GitHub Client Secret вставили **в обидва поля**, потім замінили лише
`KEYSTATIC_SECRET` — тобто в `KEYSTATIC_GITHUB_CLIENT_SECRET` лежало **не те**
значення. Перестановка ключів не підтверджена; факт — збережене значення було
хибним.

**2. Один redeploy.** Vercel → deployment `dpl_87xLXnYFQbv3aQBf8XVCXSuPnh3x` →
Deployment Actions → Redeploy (build cache off). Новий deployment
**`73uaLMwQqhn3gT4Nd8dpdvbnbs3m`** · SHA **`be85c0b`** (той самий — зміна лише
конфігу) · Preview · **Ready** · 1m 9s. Branch alias
`dreamcarvavd-git-codex-admin-p-648563-…` веде на нього.

**3. Вхід — ПРАЦЮЄ.** `/api/keystatic/github/logout` → `/keystatic` →
`/api/keystatic/github/login` → GitHub (без consent) → **callback на Preview-хост**
→ **дашборд Keystatic** «Hello, DreamCar-vavd!».
- `/keystatic/branch/main` — 0 entries скрізь (на `main` немає CMS-контенту — очікувано).
- `/keystatic/branch/codex%2Fadmin-panel-spike` — «ПОТОЧНА ГІЛКА: codex/admin-panel-spike»,
  «Pull request #26», **Автомобілі 3 · Галерея 8 · Послуги 5 · Банери 0 · Контакти**.

**4. `/panel` на Preview — ПРАЦЮЄ.**
- «Робоча гілка: **codex/admin-panel-spike** (тестова гілка — не Production)».
- Банер: «✅ Поточний знімок **на тестовому сайті гілки «codex/admin-panel-spike»**. (Preview)».
- **3 авто** (Suzuki SX4 S-Cross, Dacia Sandero, Dacia Sandero Comfort) ·
  **8 галерей** (Мазераті Леванте, Volvo XC60 D5, showcase-01…06) ·
  **5 послуг** (car-selection, car-service, diagnostics, srs-airbag, detailing) ·
  **1 контакт**. Банери/акції — 0 («Матеріалів ще немає»). Це **точно 3/8/5/1**.
- Усі записи «● На сайті», UK/EN/RU «Перевірено», «Неопублікованих змін немає».
- **Посилання редагування — branch-scoped**: `/keystatic/branch/codex%2Fadmin-panel-spike/collection/<c>/item/<id>`; Create — `.../create`; draft-preview — `/api/panel/preview?path=/uk`. Усе відносне (той самий Preview-хост).

**5. Дефект — редактор окремого запису.** `/keystatic/branch/…/collection/cars/item/suzuki-sx4-s-cross`
(і будь-який item) → **«TypeError: Failed to fetch»** у `Promise.all`.
- Списки колекцій (`/collection/services` → 5 slug) і дашборд — **працюють**
  (GraphQL `api.github.com` → 200).
- Діагностика в браузері: `fetch('https://raw.githubusercontent.com/…')` → THREW
  «Failed to fetch»; `fetch('https://api.github.com/…')` → 200. Усі
  `*.githubusercontent.com` (raw / objects / media / codeload) заблоковані CSP.
- `@keystatic/core` `keystatic-core-ui.js:550` — **клієнтський** UI редактора
  читає вміст файлу через `fetch('https://raw.githubusercontent.com/<repo>/<sha>/<path>')`.
- **Причина:** `panelCsp` у `next.config.ts` — `connect-src` мав лише
  `api.github.com` + `github.com`, без `raw.githubusercontent.com`.
- **Виправлення `b038580`:** додано `https://raw.githubusercontent.com` у
  `connect-src` **і** `img-src` (панельний CSP; публічний CSP не чіпано).
  Перевірено tsc 0 / lint 0; **локальний build не запускався** (`:3000` ділить
  `.next` — П29); Turbopack-збірку робить Vercel після push. Чекає deployment
  цього коміту.

**Не перевірено (чекає збірки `b038580`):** редактор запису з полями/фото/uk-en-ru,
чернетка, вихід/повторний вхід на Preview, 375 px + клавіатура. Vercel
Authentication — тільки для авторизованої Chrome-сесії, не для всіх відвідувачів.

### П30 — Preview запущено; збірка Ready; вхід блокується на OAuth token-exchange

**2026-09-09 ~10:05–10:20 BST.**

**Конфігурація Vercel — 7/7, усі `Preview` / лише гілка `codex/admin-panel-spike`,
контактні env не зачеплені, дублікатів немає:**
| Змінна | Значення | Звірка |
|---|---|---|
| `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND` | (reveal завис у Vercel) | `=github` — доведено функціонально: panel-роути активні, не 404 |
| `KEYSTATIC_GITHUB_REPO_OWNER` | (reveal завис) | `DreamCar-vavd` при створенні 22h тому, не «Updated» |
| `KEYSTATIC_GITHUB_REPO_NAME` | `DREAM.CAR.VAVD` | ✅ показано |
| `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | `dreamcar-vavd-keystatic` | ✅ показано |
| `KEYSTATIC_GITHUB_CLIENT_ID` | `Iv23ligKwtoqGEQNKSIk` | ✅ показано — байт-у-байт із `.env` |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | Secret (не читається) | ❓ значення **не підтверджено** — «Added 37m ago», власник лишив без змін; це єдиний ключ, який token-exchange реально задіює й на якому зупиняється |
| `KEYSTATIC_SECRET` | Secret (не читається) | ❓ значення **не підтверджено**. (Раніше писав «працює бо state пройшов» — **помилка**: див. розбір коду нижче, `secret` не задіюється, доки token-exchange не вдався) |

Уточнення до таблиці: `=github` у стовпці «Значення» — це **очікуване** значення,
не показане Vercel (reveal завис). Робочу конфігурацію через це не змінюю.
Область (`Preview` / лише `codex/admin-panel-spike`) і **наявність** 7/7 —
підтверджено списком. **Правильність** значень: `CLIENT_ID`, `APP_SLUG`,
`REPO_NAME` — показано й звірено; `STORAGE_KIND`, `REPO_OWNER` — не показано
(reveal завис), `STORAGE_KIND=github` доведено функціонально; **обидва Secret —
не звірені**.

**Push:** `b28bcac..be85c0b` (10 комітів). Local HEAD після цього — `3f9341a`
(журнал П30, **не запушено**), потім `<цей коміт>`. Remote — `be85c0b`.

**Deployment:** `dpl_87xLXnYFQbv3aQBf8XVCXSuPnh3x` · `be85c0b` · Preview ·
**Ready** · 1m 2s · alias `dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`.

**Браузер (Chrome власника — доводить лише цю авторизовану сесію, не доступ
для всіх відвідувачів):**
- ✅ branch alias віддає цей deployment; **Vercel Authentication не блокує цю сесію**.
- ✅ `/panel` без входу → app-gate «Ви не увійшли через GitHub…» (panel-роути активні).
- ✅ `/keystatic` → «Log in with GitHub».
- ✅ Клік «Log in» → GitHub → **callback на правильний Preview-хост**
  (`…648563-…`, **не** 127.0.0.1).
- ❌ **Callback → 401 «Authorization failed».**

**Розбір за кодом установленої версії (`@keystatic/core@0.6.9`,
`keystatic-core-api-generic.node.js`, `githubOauthCallback`):**
- Callback повертає **400** (не 401), якщо в параметрах є `error_description`
  (напр. `redirect_uri_mismatch` на кроці authorize). У нас у callback був
  чистий `?code=…&iss=…` → крок authorize (і `redirect_uri`) **пройшов**.
- Далі handler робить `POST https://github.com/login/oauth/access_token` **лише
  з `client_id`, `client_secret`, `code`** — **`redirect_uri` у цьому запиті НЕ
  надсилається**. Тому `redirect_uri_mismatch` на цьому кроці неможливий.
- **401 «Authorization failed»** повертається, якщо: (а) HTTP-статус відповіді
  GitHub не 2xx, **або** (б) тіло відповіді не має повної форми
  `{access_token, expires_in, refresh_token, refresh_token_expires_in, scope,
  token_type:'bearer'}` — тобто GitHub повернув `{error, error_description,
  error_uri}`. Keystatic цей `error` **не логує й не повертає** (`catch {}`).
- **`KEYSTATIC_SECRET` (`config.secret`) у token-exchange НЕ бере участі** —
  він потрібен лише для `encryptValue(refresh_token, secret)` **після** успішного
  обміну. Тож 401 **нічого не каже** про правильність `KEYSTATIC_SECRET`. `state`
  теж **не** валідовується — використовується лише для пошуку cookie з шляхом
  повернення.
- Джерело значень (звірено за кодом): `route.ts` → `makeRouteHandler({config})`
  → `@keystatic/next` → `makeGenericAPIRouteHandler(_config,{slugEnvName})` —
  `clientSecret` **не** передається явно, тож береться
  `process.env.KEYSTATIC_GITHUB_CLIENT_SECRET`. На Vercel це = значення з
  dashboard (Secret). Закомічених `.env`/`.env.*` з реальними значеннями в репо
  немає (лише `.env.example` + `docs/keystatic-app-setup.env` — без секретів).

**Точна помилка GitHub — недоступна.** Keystatic її ковтає; у Vercel-логах її
теж немає. Тому `incorrect_client_credentials` / `bad_verification_code` /
інше — **не встановлено**.

**Що звужує до `KEYSTATIC_GITHUB_CLIENT_SECRET`:**
- `redirect_uri_mismatch` — виключено (див. вище, 400 vs 401, немає redirect_uri у POST).
- `CLIENT_ID` звірено; `code` свіжий у **кожній** із ≥2 спроб (не reused/stale).
- `.env` (`…-panel-setup-verify/.env`) містить `KEYSTATIC_GITHUB_CLIENT_SECRET`
  = 40-hex (`65b4…c3`, узгоджується з «одним client secret …c003dac3» App) і
  `KEYSTATIC_SECRET` = 80-hex. **Локальний вхід на :3010 із цією парою вже
  проходив** (П19–П22) → `.env`-значення client secret — **відоме робоче**.
- Історія редагувань у Vercel (обидва Secret додано ~09:43, потім о 10:07
  «замінено лише `KEYSTATIC_SECRET`») сумісна з тим, що значення спершу
  переплутали (40-hex ↔ 80-hex), і в `KEYSTATIC_GITHUB_CLIENT_SECRET` досі
  лежить 80-hex.

**Наступний крок — перевірка гіпотези (не «доведене виправлення»):**
власник **один раз** переввід `KEYSTATIC_GITHUB_CLIENT_SECRET` у Vercel зі
`…-panel-setup-verify/.env` (рядок `KEYSTATIC_GITHUB_CLIENT_SECRET=…`, 40
символів — **відоме робоче** значення). Одне поле. Тип/область не міняти.
Потім **redeploy `be85c0b`** (зміна лише конфігу) і повторний вхід із
`/keystatic` (не оновлювати стару callback-сторінку).
- **Якщо вхід пройшов** — причина була у збереженому значенні client secret.
- **Якщо ні** — причина на боці GitHub App (secret регенеровано / callback URL
  прибрано / App suspended). Тоді: діагностичний коміт, що логуватиме `error`
  GitHub (не токен, не code) в ізольованому worktree + push + build; або
  власник дивиться GitHub App (client secrets, «last used», Callback URLs) —
  це під його 2FA.

**Не регенерувати й не відкликати секрети автоматично.** Локальний
callback URL `http://127.0.0.1:3010/api/keystatic/github/oauth/callback` у App —
зберегти.

**Не перевірено (чекає завершеного входу):** редактор Keystatic, `/panel` з
даними 3/8/5/1, гілка в UI, картки/фото/мови, чернетка, банер стану, вихід/
повторний вхід, 375 px + клавіатура.

### П29 — ризик `.next` серверу власника; 429/Retry-After; передпуш-звірка

Коміт `38489bc` (код) + цей запис (docs). Локально не запушено.

**1. Ризик впливу на сервер власника (`:3000`):**
- `.next/` містить **і** production-артефакти (`BUILD_ID`, `server/`, `static/`
  — від моїх `npm run build`), **і** окремий `.next/dev/` (свій `build`, `cache`,
  `lock`, `server`, `static` — для `next dev`). Тобто `next dev` (:3000)
  працює переважно з `.next/dev/`, `next build` — з кореня `.next/`.
- **Але вони спільно використовують** `.next/cache/`, `.next/node_modules/` і
  частину кореневих маніфестів. Мої попередні `npm run build` (П26–П28) писали
  в корінь `.next/` і чіпали `.next/cache` — файли, які процес :3000 читає й
  частково поділяє. Тому «процес не перезапускався» ≠ «файли, які він
  використовує, не змінювалися».
- **Рішення:** решта роботи — лише push + перевірка Preview, тож **новий
  worktree не створюю** (за умовою). `npm run build` у цьому каталозі **більше
  не запускаю**; збірку П29 підтвердить Vercel після push. tsc/lint/`node --test`
  `.next` не чіпають — ними й перевіряю.

**2. Обробка 429 / часу очікування:**
- **HTTP 429** (не лише 403 з ознаками) тепер → `StorageRateLimitedError`
  (охоронна умова 429 пропускала, тест це закріпив).
- `StorageRateLimitedError` **більше не обіцяє «близько хвилини»**. Класифікатор
  бере фразу очікування **лише** з реального заголовка — `Retry-After` (секунди)
  або `x-ratelimit-reset` (unix-секунди) — напр. «Спробуйте приблизно за 2 хв.».
  Якщо GitHub часу не дав — повідомлення просто «GitHub тимчасово обмежив
  частоту запитів. Спробуйте пізніше.», без вигаданого часу.
- Тести (`github.test.ts` +3): 429→RateLimited; `Retry-After: 120`→«за 2 хв»,
  не «пізніше»; `x-ratelimit-reset`→секундна форма; secondary-limit без
  заголовків→«спробуйте пізніше» + перевірка, що вигаданого «за N» **немає**.
- Автоповторів запису не додано.

**3. Уточнення про втрачений `PUT`** (виправлено формулювання в П28 вище, без
окремого коміту): три стани — «запит не відправлено» (запис не починався,
`StorageUnavailableError`, повтор безпечний) / «відправлено, відповідь втрачена»
(`WriteUncertainError`, результат невідомий — спершу оновити й перевірити) /
«підтверджено успіх» (запис підтверджено). Код уже так працює; це була
неточність лише в тексті.

**4. Передпуш-звірка (одноразова, повторю безпосередньо перед push):**
- гілка `codex/admin-panel-spike`; локальний HEAD `38489bc`; робоче дерево
  **чисте**;
- **remote SHA `b28bcac`** — `git ls-remote origin refs/heads/codex/admin-panel-spike`
  (мережею); збігається з `origin/*`, не змінювався;
- 9 неопублікованих комітів (`7b8b0e0`…`38489bc`), усі мої;
- сукупний diff — 10 файлів: 2 docs + 8 код/тести. **Немає** `src/content/cms/*`,
  `.env`, тестових фікстур-файлів;
- у доданих рядках єдине «секретоподібне» — Client ID `Iv23ligKwtoqGEQNKSIk` у
  журналі (це **публічний ідентифікатор** OAuth-App, не секрет; уже був у
  раніших комітах). Ні client secret, ні токена, ні `KEYSTATIC_SECRET` — немає;
- PR #26 — `isDraft: true`, base `main`. Force-push / переписування історії — ні.

### П28 — класифікація 401 / 403 GitHub; звірка меж; CWD серверів власника

Коміт `699e698` (локально, не запушено).

**Знайдені дефекти й виправлення:**
1. **Усі 401/403 йшли в один `StorageAuthError` «увійдіть знову».** Але 403 не
   доводить завершення сесії, а обмежений 403 повторним входом не лікується.
   Новий базовий `StorageBackendError` з полем `retriable` і 4 випадками:
   - **401** → `StorageAuthError` (`retriable:false`) — увійти знову;
   - **403** + `x-ratelimit-remaining: 0` / `retry-after` / `rate limit` /
     `secondary` / `abuse` → `StorageRateLimitedError` (`retriable:true`) —
     зачекати й оновити;
   - **403** + `not accessible` / `permission` / `must have` / `denied` →
     `StorageForbiddenError` (`retriable:false`) — доступ звужено, до власника репо;
   - **403** без ознак → `StorageForbiddenError` з **нейтральним** формулюванням,
     без вигаданої причини.
   Сира відповідь GitHub нікуди не передається (класифікатор її читає, у
   повідомлення вона не потрапляє — є тести на відсутність тіла/`Bearer`).
2. **`gh()` тепер повертає ще й заголовки** (для `x-ratelimit-remaining` /
   `retry-after`); `rejectIfUnauthorized(status, headers, body)` — класифікатор.
3. **`writeFile`:** остаточна відповідь 401/403 означає, що коміт **не** стався
   → auth/forbidden/rate-limit, ніколи не `WriteUncertainError`.
4. **Перехоплення deployment status** (`getPanelData` і `github.deployStatus`)
   тепер за базовим `StorageBackendError` — відхилена перевірка збірки все одно
   деградує до `unknown` (банер ніколи не показує це як успішну збірку), дашборд
   не гасне. Перехоплення лишається **тільки** для deployment status — читання
   контенту (`readDir`/`readFile`) не обгорнуті й кидають далі.
5. `/panel`: 401/не-увійшли → екран входу; **403** → червоний екран «доступ
   відхилено, звірте з власником репо» (без обіцянки, що повторний вхід
   допоможе); `retriable` (недоступно / обмежено) → бурштиновий екран повтору.
6. API дії: `{auth}` → 401, `{forbidden}` → 403, `{transient}` → 503.

**Безпечність повтору всієї дії (пункт 2):** `confirmLocale`, `publishItem`,
`unpublishItem` кожна виконує **не більше одного** `writeFile` (табличний тест
«≤ 1 запис на дію»). Три стани результату розрізняються (уточнено в П29):
- **запит не відправлено** (бюджет вичерпано до `PUT`) → `StorageUnavailableError`
  — запис **не починався**, повтор безпечний;
- **запит відправлено, відповідь втрачена** → `WriteUncertainError` — результат
  **невідомий**, спершу оновити й перевірити стан;
- **отримано підтвердження** → запис підтверджено.
Version-token + TOCTOU + optimistic-lock уже покривають, що повторна дія
лишається conflict-safe (тести «two editors, same version…», «editor B publishes
against a snapshot editor A already moved», «retry after a lost response…»).
Автоповторів запису не додано.

**Межі deployment status (пункт 3), звірено за кодом:**
- помилка `readDir`/`readFile` **не** перетворюється на порожній список — вони
  поза `.catch` (тест «a storage read failure surfaces as an error…»);
- `unknown` у банері має свій стиль (`ℹ Стан збірки невідомий`), **не** зелений
  `✅ Поточний знімок …`;
- `deployStatus` бере sha з `branchHeadSha()` (реальний HEAD гілки; після
  публікації = коміт публікації) і питає deployments саме за цим sha — старе
  посилання на Preview як «поточний результат» не подається; порожній список
  для нового sha → `state:"none"` («деплой не знайдено»), не старий URL;
- окремого «очікуваного sha» ніде не передається, тож зіставляти нема з чим —
  без змін.

**CWD серверів власника (пункт 4), лише читанням:**
- **:3000** — pid 71636 (parent 71635), `next-server v16.3.0`, старт Пн 07.09
  10:27, **CWD = `/Users/apple/Projects/DREAM.CAR.VAVD-admin-panel-20260906`** —
  та сама копія, де я комічу.
- **:3010** — pid 95335 (parent 95334), старт Вт 08.09 11:26,
  **CWD = `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify`**.
- Отже тимчасове переміщення `services/detailing.json` (П27) відбулося саме в
  копії, яку обслуговує :3000. Файл повернуто за ~1 хв, `git status` чистий, але
  **довести, що сервер власника не побачив зміни на ту хвилину, не можна.**
- **Надалі:** у `-admin-panel-20260906` — без переміщень контенту й без
  `next dev`/`next start` поверх спільного `.next`. Візуальну перевірку
  звичайної панелі роблю на Preview; сценарій без робочої картки лишаю
  **неперевіреним у браузері** (для нього потрібна заборонена зараз зміна
  реального контенту).

**Перевірено на повному дереві:** tsc 0 · lint 0 · `npm test` **273/273** ·
`npm run build` (**Turbopack**) — Compiled successfully, 3 давні warnings.
**Не** проти реального Vercel/Turbopack-деплою (потрібні 2 секрети).
setup-сервер :3010 на новий код не перемикався; :3000/:3010 не чіпав.

### П27 — доопрацювання шляху помилок панелі (після перевірки повного шляху до користувача)

Коміт `98f0e0a` (локально, не запушено). Наступне після П26.

**Що додатково знайдено й виправлено:**
- **401/403 від GitHub із наявним токеном** (сесію завершено / доступ App
  відкликано / втрачено доступ до репо) віддавав загальне
  `GitHub read X failed (403)` — схоже на сиру відповідь. Тепер → новий
  `StorageAuthError` з одним зрозумілим повідомленням «увійдіть знову» на
  читаннях і на записі. `/panel` показує його з тим самим «Відкрити Keystatic
  і увійти», що й `NotConnectedError`; API дії повертає **401** (прапор `auth`).
- **`writeFile` тепер розрізняє «запит не пішов» і «пішов, результат невідомий»:**
  якщо 20-с бюджет екземпляра вичерпано **до** відправлення `PUT` →
  `StorageUnavailableError` (нічого не сталося, повтор безпечний); лише збій
  **під час** запиту → `WriteUncertainError`. Автоповтору запису як не було, так і немає.
- **`getPanelData` захищено щодо `deployStatus()`:** якщо перевірка стану
  збірки кидає — деградує до `state:"unknown"`, контент, що завантажився,
  рендериться.
- `toActionError` не віддає токен, сиру відповідь GitHub чи stack trace —
  лише текст-підказку самої помилки.

**Межі загального таймауту (звірено за кодом):**
- Бюджет **20 с** стартує в конструкторі `GitHubStorage`
  (`deadline = Date.now() + operationTimeoutMs`).
- Він **спільний** для всіх читань однієї операції панелі: `getStorage()`
  створює **один** екземпляр на HTTP-запит, і `getPanelData` виконує через нього
  всі `readDir`/`readFile`/`deployStatus`.
- Нові екземпляри всередині тієї самої операції **не створюються** (ні
  `getPanelData`, ні дії їх не роблять; `getStorage()` — раз на запит), тож
  бюджет не скидається.
- Бюджет вичерпано до початку запису → `writeFile` кидає `StorageUnavailableError`
  **до** будь-якого `fetch` (0 `PUT`), бо запис не починався.

**Мовні підтвердження після редагування — правила не змінювались, уже покрито:**
- `serviceGate.test.ts`: «editing structured text after review re-opens that
  language»; «an unfinished language blocks only its own review, not the
  others»; «empty required text blocks publish for that language only»;
  «changing only the shared numeric price / status keeps every translation
  reviewed».
- `carsGate.test.ts`: «editing text after review makes that language
  need-review again»; «a language with no review confirmation blocks publish».
- `panelStore.test.ts`: «changing only a shared service price does not require
  re-confirming any language» (наскрізно через конвеєр).

**Нові тести:** `github.test.ts` +3 (401→auth, 403→auth, бюджет-до-запису →
`StorageUnavailableError`, не `WriteUncertain`, 0 `PUT`); `panelStore.test.ts`
+4 (дія → `transient` на недоступному читанні; дія → «результат запису
невідомий»; дія → `auth` і **нічого не тече** — без `Bearer`/`token`/шляхів;
`getPanelData` виживає при збої `deployStatus`).

**Браузерна перевірка нового рядка (пункт 4) — НЕ виконана наживо.** Причина:
`next dev` для цього worktree вже працює (:3000, сервер власника — не чіпаю),
а другий `next dev` із того самого `.next` заблоковано; `next start` у
production без github-env вимикає `/panel` (`keystaticEnabled=false`); окремий
worktree/стенд заради тесту — розширення проєкту, чого просили уникати.
Замість цього — звірка коду `OrphanRow` + юніт-тести:

| Вимога пункту 4 | Де підтверджено |
|---|---|
| опубл. запис без робочої картки видно | `getPanelData` → `orphan-published` рядок (`panelStore.test.ts` «orphan published: working card gone…») |
| довга назва/ID не ламають мобільний вигляд | `OrphanRow`: `flex flex-wrap`, назва/subtitle у `<span>` без `truncate`/`nowrap`, `id` лише в нативному `confirm`; без фіксованих ширин. **Пікселі при 375px не звірені** |
| немає edit/publish/confirm | `OrphanRow` не рендерить жодного з цих контролів |
| зрозуміле підтвердження «Прибрати з сайту» | `confirmText` → `window.confirm` з поясненням |
| скасування нічого не змінює | `PanelButton.run()`: `if (confirmText && !window.confirm(...)) return;` — до будь-якого `fetch` |
| повторне натискання під час виконання заблоковане | `<button disabled={disabled||busy||pending}>`, `setBusy(true)` одразу (незмінна логіка `PanelButton`) |
| конфлікт версії пропонує оновити | `unpublishItem` version-guard (`panelStore.test.ts` «unpublishing an orphan … version-guarded») → клієнт показує «Оновити» |

**Перевірено на повному дереві:** tsc 0 · lint 0 · `npm test` **266/266** ·
`npm run build` (Turbopack) — Compiled successfully. **Не** проти реального
Vercel/Turbopack-деплою. setup-сервер :3010 на новий код не перемикався;
:3000 і :3010 не чіпав (тимчасово переміщений `services/detailing.json` для
спроби локального стенда — одразу повернуто, `git status` чистий).

### П26 — панель: сироти-публікації видно; таймаути GitHub + зрозумілі помилки

Два кодові коміти (локально, не запушено — див. «Поточний стан»):

**`3369030` — таймаути запитів до GitHub + безпечна обробка мережевих збоїв:**
- `GitHubStorage` не мав ані per-request, ані загального ліміту часу → обірваний
  конект підвішував рендер `/panel` на хвилини (був факт: 10.7 хв після
  `ECONNRESET`, П6).
- Тепер кожен виклик обмежений удвічі: **8 с** на один HTTP-запит (GitHub
  contents API p99 « 1 с; довше = зламаний конект, не повільний) і **20 с** на
  весь екземпляр сховища (новий екземпляр на кожен запит). Один
  `AbortController`+таймер покриває і очікування відповіді, і читання тіла;
  таймер завжди звільняється. Значення й обґрунтування — константами в `github.ts`.
- Нові класи в контракті `adapter.ts`:
  - `StorageUnavailableError` — GitHub недоступний/таймаут. **Читання** з такою
    помилкою піднімається як помилка, **не** як порожній список; `/panel`
    показує стан «дані не завантажено, спробуйте оновити», не порожній дашборд.
  - `WriteUncertainError` — `PUT` пішов, відповідь не повернулася. Адаптер
    **не повторює** (сліпий повтор міг би подвоїти коміт або зіткнутися з
    optimistic-lock); повідомлення каже перезавантажити й перевірити стан
    перед повтором.
- `deployStatus()` при недоступному GitHub повертає `state:"unknown"` — невдала
  перевірка стану збірки більше не гасить весь дашборд; контент, що завантажився,
  рендериться, а «не вдалося перевірити стан збірки» — окремо.
- Дії панелі (`confirm/publish/unpublish`) проходять через `runAction`, що
  мапить помилки на `ActionResult` з прапором `transient` → HTTP 503 + бурштинове
  «оновіть і перевірте» з кнопкою оновлення (замість «Помилка мережі. Дані могли
  не зберегтися»).
- Тести (`github.test.ts`, +8): запит без відповіді; тіло, що зависає; `ECONNRESET`
  на читанні → `StorageUnavailableError`; `ECONNRESET` на `writeFile` →
  `WriteUncertainError` **і рівно один `PUT`**; `deployStatus` → `unknown`;
  загальний бюджет ріже повільний листинг; конфлікт/allowlist/гілка — без змін.

**`dfbe89c` — опубліковані записи без робочої картки лишаються керованими:**
- `getPanelData` будував рядки з `working.map()` → після видалення картки в
  Keystatic її опублікована копія зникала з `/panel`, і прибрати її з сайту
  ставало нічим (серверний `unpublishItem` працював, але його ніхто не викликав).
- Тепер `getPanelData` додає рядок `orphan-published` для кожного запису знімка,
  чийого `id` немає в робочому наборі. Назва/id — з опублікованого запису.
  Рядок **лише для читання**: `editHref=null`, `blockers=[]`, без мовного UI,
  робочий файл **не** відтворюється.
- `PanelRow.workingExists`; `ItemPublishState` += `"orphan-published"`;
  `editHref: string | null`.
- `/panel` показує це бурштиновим блоком: «Робочу картку видалено. Опублікована
  версія ще залишається на сайті.» + підтверджувана «Прибрати з сайту», яка
  кличе наявний version-guarded `unpublishItem`. Без publish/confirm/edit.
- Тести (`panelStore.test.ts`, +4): сирота показується; дубліката немає, коли є
  обидві; прибирання сироти чіпає лише її запис і version-guarded; помилка
  читання сховища → reject (ніколи не хибне «картку видалено» й не порожній
  дашборд).

**Перевірено на повному дереві:** `npx tsc --noEmit` — 0; `npm run lint` — 0;
`npm test` — **259/259**; `npm run build` (**Turbopack**, як на Vercel) —
Compiled successfully, лише 3 давні tracing-warnings. **Не** ганялося проти
реального Vercel/Turbopack-деплою (потрібні 2 Preview-секрети). setup-сервер
:3010 на новий код **не** перемикався (немає потреби).

### Production за фактом — коротка перевірка доступності (2026-09-08, 20:17 BST)

Тільки читання, без форм/аудитів. Домени (Vercel → Domains):
`dream-car-vavd.com` (Production, головний), `www.dream-car-vavd.com` → 308 на
apex, `dreamcarvavd.vercel.app` (Production).

| Адреса | Результат |
|---|---|
| `https://dream-car-vavd.com/` | 200, редірект на `/uk` |
| `https://dream-car-vavd.com/uk` | 200 — «DREAM.CAR.VAVD — преміальні автомобільні послуги…», секція «Послуги», 6 карток |
| `https://dream-car-vavd.com/en` | 200 — «Services», «A full range of automotive services under one roof» |
| `https://dream-car-vavd.com/ru` | 200 — «Услуги», «Полный цикл автомобильных услуг…» |

Навігація, перемикач мов, картки послуг рендеряться. Це перевірка **доступності**,
не повна перевірка всіх функцій сайту.

### П25 — форма 2 секретів підготовлена; сценарій запису/публікації виправлено за схемою

- **Chrome власника:** відкрито Vercel → Environment Variables → «Add Environment
  Variable»; вписано **обидві** назви `KEYSTATIC_GITHUB_CLIENT_SECRET` і
  `KEYSTATIC_SECRET`, Type = **Secret**, область = **тільки `codex/admin-panel-spike`**
  (Production/Preview/Development зняті). **Порожні лише поля Value.** Власник
  вставляє два значення з `…-panel-setup-verify/.env` і тисне Save.
- **Джерело обмеження «асистент не вписує секрети»:** системні інструкції
  асистента, розділ *Prohibited* — «Entering … API keys, or tokens into any
  field»; лишається забороною навіть на прямий дозвіл користувача. Окремого
  інструмента передачі облікових даних у цій сесії немає. Обхід іншими
  інструментами (JS-сеттер поля, CLI) не робиться. Частина, яка потребує участі
  власника, — саме вставлення двох значень у Value.
- **Client ID — виправлено в доці:** правильне значення `Iv23ligKwtoqGEQNKSIk`
  (позиція 18 — велика `I`, 19 — мала `k`; звірено символ-за-символом із
  setup-`.env`). Раніше в П22/пам'яті стояло хибне `…NKSlk` (мала `l`). У Vercel
  вписано правильне (звірено в П23, буде переперевірено після 7/7).

**`docs/PANEL-write-publish-scenario.md` — виправлено за реальною схемою
(`keystatic.config.ts` services з р.336, `serviceGate.ts`):**
- ключі — `uk/en/ru` з `title` + `shortDescription` + `longDescription` (плюс
  необов'язкові); попереднє `title.uk`/`description.uk` було хибним;
- файл — точно `src/content/cms/services/zzz-test-panel.json`; фото — точно
  `public/images/cms/services/zzz-test-panel/photos/0/image.jpg` (шаблон
  Keystatic, як у наявних `gallery/*`); «або шлях, який покаже Keystatic» прибрано;
- **гейт публікації** (`serviceGate.ts`): для кожної мови `title/shortDescription/
  longDescription` непорожні + статус `reviewed`; `priceAmount` порожній або
  число; фото не обов'язкові. `priceAmount/priceCurrency` **не** в хеші
  підтвердження — зміна суми переклад не скидає (додано як окрему перевірку);
- **порядок прибирання** виправлено: спершу `unpublish` через `/panel` (поки
  робоча картка є), потім видалення робочої картки, потім тільки свої фото
  (`zzz-test-panel/`), потім залишок у `review-state.json`. Причина:
  `getPanelData` будує рядки з `working.map` (`panelStore.ts:173`) — після
  видалення робочої картки кнопка «Прибрати з сайту» зникає, а опублікований
  запис лишається;
- **зафіксовано ваду для подальшого виправлення:** `/panel` не показує
  «осиротілі» опубліковані записи без робочої картки → немає UI-кнопки їх
  прибрати (серверний `unpublishItem` працює). Треба показувати такі записи з
  кнопкою прибирання;
- **перевірка прибирання** зроблена точною: перелічено конкретні місця
  (`git show <branch>:src/content/cms/services/`, `published.json`,
  `review-state.json`, `git ls-tree … public/images/cms/services/`), порівняння з
  збереженим початковим станом; «пошук `zzz-test` по дереву = 0» прибрано
  (текст законно є в доці/історії);
- **сценарій конфлікту** зроблено відтворюваним: обидві сесії — активна кнопка
  «Опублікувати», зафіксовані `versions`, після зміни в A мова знову підтверджена,
  B б'є зі старими `versions` → `{conflict:true}` + збережена версія A;
  розмежовано з «кнопка вимкнена» та «відмова через неперевірену мову».

**Захист `main` — перевірено (тільки читання):**
- `/panel` бере гілку з `VERCEL_GIT_COMMIT_REF` (Preview) / `PANEL_CONTENT_BRANCH`
  (локально), без fallback на `main` (`store/branch.ts`); посилання редагування
  branch-scoped (`panelStore.ts` `keystaticBase`).
- GitHub → Branches → правило `main` (`branch_protection_rules/81941201`, звірено
  2026-09-08): **Require a pull request** on, **Do not allow bypassing** on
  (діє й на адмінів), force-push/deletion off, Require status checks →
  `Verify (…)`. **Прямий push у `main` заборонено всім.** Require approvals —
  **вимкнено** (власник технічно може сам змержити PR після зеленого `Verify` —
  це домовленість, не бар'єр).
- `content-guard.yml` — у `.github/workflows-proposed/` (не в `.github/workflows/`,
  тому GitHub його не запускає). Активний workflow один — `.github/workflows/ci.yml`
  (job `Verify`).
- **Не перевірено руками:** чи можна вибрати `main` у власному перемикачі гілок
  Keystatic. Очікування — прямий запис у захищену `main` GitHub відхилить;
  крок для hosted-протоколу. `resolveContentBranch` без fallback ≠ заборона явно
  вибраної `main`.
- **`rebase`-примітка:** правильне фактичне місце майбутнього workflow —
  `.github/workflows-proposed/content-guard.yml` (не `.github/workflows/`).

**Локальна `/panel 500` — актуальна перевірка (19:47, 2026-09-08):**
- Свіжий `curl http://127.0.0.1:3010/panel` → **HTTP 200 за 0.9 с**, сторінка
  рендериться коректно («Ви не увійшли через GitHub» — очікувано без cookie).
- У `setup-server.log` єдиний `GET /panel 500 in 10.7min` стоїть **одразу після**
  `[TypeError: fetch failed] … [cause]: Error: read ECONNRESET`, а **наступний**
  рядок — `GET /panel 200 in 686ms`. Тобто: разовий збій — вихідний запит до
  GitHub API (рендер `/panel` у github-режимі під входом) обірвався `ECONNRESET`
  і без короткого таймауту завис ~10 хв, повернувши 500; наступний і всі подальші
  запити — 200.
- **Висновок:** не відтворюється; це не дефект коду сторінки й не проблема сесії,
  а транзієнтний мережевий збій на вихідному виклику до GitHub. Латентна вада
  стійкості: у github-storage `fetch` немає короткого таймауту → обірваний
  конект може підвісити рендер на хвилини (на Vercel зріже function-timeout, але
  UX поганий). Кандидат на виправлення, **не** зараз (без змін коду цього етапу).
- Сервер :3010 (pid 95334, cwd `…-panel-setup-verify`, порт слухає pid 95335) —
  здоровий, **не перезапускався** (немає технічної потреби). `:3000` не чіпався.

### П24 — Vercel Preview build впав на `b28bcac` (очікувано): точна причина

**Deployment:** `8bFFkFtSjXffsi7c22whANajjige` · джерело `codex/admin-panel-spike` @
`b28bcac` · середовище **Preview** · статус **Error** · тривалість 24s · створено
2026-09-08 (~12:28 UTC у логах) · домени
`dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app` +
`dreamcarvavd-5t56gx26g-6y7h9wdz4r-7375s-projects.vercel.app`. Тригер — push
документаційного коміту `b28bcac` (env-змінні на той момент уже були додані).

**Що прямо підтверджено журналом збірки (Build Logs, 145 рядків):**
```
✓ Compiled successfully in 8.8s
Running TypeScript ... Finished TypeScript in 3.7s
Collecting page data using 1 worker ...
Error: Failed to collect configuration for /api/keystatic/[...params]
  [cause]: Error: Missing required config in Keystatic API setup when using the 'github' storage mode:
  - clientSecret (can be provided via KEYSTATIC_GITHUB_CLIENT_SECRET env var)
  - secret (can be provided via KEYSTATIC_SECRET env var)
Turbopack build encountered 3 warnings:
> Build error occurred
Error: Failed to collect page data for /api/keystatic/[...params]
Error: Command "npm run build" exited with 1
```
- Компіляція і TypeScript **пройшли** — це не помилка коду/типів.
- Падіння — на стадії **Collecting page data**, конкретно на роуті
  `/api/keystatic/[...params]`.
- Відсутні саме **дві** змінні: `clientSecret`, `secret`. `clientId` у переліку
  **немає** → `KEYSTATIC_GITHUB_CLIENT_ID` на Preview вже підхоплюється (П23).

**Які змінні відсутні:** `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`
(на Preview гілки `codex/admin-panel-spike`).

**Що випливає з коду** (`@keystatic/core@0.6.9`, `@keystatic/next@5.0.5`,
Next 16.3.0):
- `src/app/api/keystatic/[...params]/route.ts` на рівні модуля викликає
  `makeRouteHandler({ config })` → `@keystatic/next` → `makeGenericAPIRouteHandler`.
- У `@keystatic/core/dist/keystatic-core-api-generic.node.js` (~р. 322): якщо
  `storage.kind === 'github'` **і** `NODE_ENV !== 'development'` **і** бракує
  будь-якого з `clientId/clientSecret/secret` → **synchronous `throw`** на етапі
  обчислення модуля. `next build` виконує модуль під час «collect page data» →
  збірка падає.
- github-режим вмикається через `keystaticEnabled` (`src/lib/keystaticEnabled.ts`):
  `NODE_ENV !== 'production' || NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND === 'github'`.
  На `359c108` env ще не було → на Preview `keystaticEnabled=false` → роут
  віддавав 404, `throw` не спрацьовував, збірка була зелена. Додавання
  `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github` (П23) увімкнуло перевірку.
- 3 попередження Turbopack — окреме, доброякісне: filesystem-tracing на
  `path.join(process.cwd(), …)` у `src/lib/content/store/localFs.ts`. Присутнє й
  на зеленій збірці `359c108`. **Не причина** падіння.
- І Vercel, і CI `Verify` збирають через `next build` (**Turbopack**). Різниця не
  в бандлері, а в **env**: на Preview гілки задано
  `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github` → `storage.kind='github'` → `throw`;
  у CI цієї змінної немає → `storage.kind='local'` → без `throw`. Локальний
  `build:webpack` теж без github-env → теж зелений. Зелені CI/локальні збірки цю
  ваду конфігурації Preview не ловлять.

**Що можна підтвердити лише наступною збіркою:** що після додавання двох
секретів + redeploy збірка стане зеленою повністю. Додавання ключів прибирає
**цей конкретний** `throw`; інші стадії («collect page data» для інших роутів,
генерація сторінок) на цій конфігурації ще не проходили. Гарантій «зникнуть усі
помилки» немає — оцінюємо за фактом наступної збірки. Це проблема **конфігурації
середовища**, не коду — код не змінюємо.

### П23 — Vercel Preview: 5 env-змінних + callback додано (асистентом); 2 секрети — за власником

> **Історична примітка (додано в П24):** рядок нижче писався до появи
> env-змінних. Формулювання «CI `Verify` + Vercel — pass; останній Preview
> deployment `36PPjaFU3fSU8UXG2oVKu6WpYfHe`» стосується збірки `359c108`, яка
> збиралась **без** github-env. Після додавання env-змінних push `b28bcac` дав
> **невдалу** збірку `8bFFkFtSjXffsi7c22whANajjige` (див. П24). CI `Verify` ≠
> збірка Vercel.

**Стан на 2026-09-08.** Гілка `codex/admin-panel-spike` @ `359c108` (без змін після
контрольної точки); PR #26 draft; ~~CI `Verify` + Vercel — pass; останній Preview
deployment `36PPjaFU3fSU8UXG2oVKu6WpYfHe`~~ (див. історичну примітку вище).

**Асистент зробив у Chrome власника (read+write, значень секретів не показував):**
- **Vercel env — 5 із 7** додано як **Config**, Environment = **Preview**, scope =
  **тільки гілка `codex/admin-panel-spike`** (Production знято):
  `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github`, `KEYSTATIC_GITHUB_REPO_OWNER=DreamCar-vavd`,
  `KEYSTATIC_GITHUB_REPO_NAME=DREAM.CAR.VAVD`,
  `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=dreamcar-vavd-keystatic`,
  `KEYSTATIC_GITHUB_CLIENT_ID=Iv23ligKwtoqGEQNKSIk` (звірено байт-у-байт із
  `…-panel-setup-verify/.env` — саме `…NKSIk`, не з фото). Контактні env не чіпав.
- **GitHub App → Redirect URIs** — тепер **два** (звірено після save):
  `http://127.0.0.1:3010/api/keystatic/github/oauth/callback` (локальний, збережено) +
  `https://dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app/api/keystatic/github/oauth/callback`.
  Webhook Active — лишається off.
- Branch alias повторно звірено: у Vercel Deployments (фільтр за гілкою) —
  «Branch link for codex/admin-panel-spike».

**Залишилось (2 секрети — вводить власник; правило: асистент не вписує
API-ключі/токени у поля — джерело обмеження: системні інструкції асистента,
розділ «Prohibited», без винятків навіть на прямий дозвіл; окремого
credential-tool у цій сесії немає):**
- `KEYSTATIC_GITHUB_CLIENT_SECRET` (len 40) і `KEYSTATIC_SECRET` (len 80 hex) —
  Type **Secret**, Environment — **тільки гілка `codex/admin-panel-spike`**.
  Значення — з `…-panel-setup-verify/.env`.
- **П24-оновлення:** асистент **підготував форму** «Add Environment Variable» у
  Chrome власника — обидві назви вписані, Type = Secret, область =
  `codex/admin-panel-spike`; **порожні лише поля Value**. Власнику: вставити два
  значення й натиснути Save (або, якщо форма закрилась, — з нуля за інструкцією
  в `docs/PANEL-owner-request-B1.md`).
- Потім: **redeploy** `b28bcac` (або новішого) → перевірка збірки → браузерна
  перевірка входу/панелі/чернетки/виходу (робить асистент).

**Redeploy НЕ робити до 7/7** — Keystatic github-режим без цих трьох ключів
валить production-build («Missing required config», підтверджено — П24).

### П22 — Б1 ЛОКАЛЬНО ЗАВЕРШЕНО: App встановлено, тест виходу/входу пройдено, запит Vercel готовий

**Встановлення App (в Chrome власника):** перша спроба (П21) впала — GitHub
sudo «Confirm access» перериває POST і не авто-повторює. Друга спроба з
`settings/apps/dreamcar-vavd-keystatic/installations` → Install → **Only select
repositories → DreamCar-vavd/DREAM.CAR.VAVD** → Install & Authorize → пройшло
(sudo було свіже). Звірено на `settings/installations` (сторінка Configure):
- Repository access: **Only select repositories → `DreamCar-vavd/DREAM.CAR.VAVD`**
- Permissions: **Read and write access to code** · **Read access to deployments,
  metadata, and pull requests** · більше нічого
- App → General: **Webhook Active — знято**; Redirect URI
  `http://127.0.0.1:3010/api/keystatic/github/oauth/callback`; Client ID
  `Iv23ligKwtoqGEQNKSIk`; client secret «Last used within the last week».

**Тест виходу з ЖИВОЇ сесії** (Chrome власника, не curl): під входом відкрито
`/panel` (3/8/5/1) і чернетку `/uk` (версія `36b42d92`). Далі
`/api/keystatic/github/logout` (лише сесія Keystatic; GitHub-акаунт у браузері
не чіпали) →
- `/keystatic` → лише «Log in with GitHub»;
- `/panel`, `/panel/leads`, `/panel/video` → «Ви не увійшли через GitHub…», даних немає;
- `/uk` (раніше відкрита чернетка) після оновлення → **«Сесію завершено або
  відкликано — перегляд чернетки недоступний. Показано опубліковану версію.»**;
- новий `GET /api/panel/preview` → **401**.

**Повторний вхід:** «Log in with GitHub» → GitHub авто-approve (App уже
авторизований, без consent і без Confirm access) → Keystatic dashboard;
`/keystatic/branch/codex%2Fadmin-panel-spike` → Автомобілі 3, Галерея 8,
Послуги 5; `/panel` → «Робоча гілка: codex/admin-panel-spike», банер «(Preview)»,
3/8/5/1, лінки редагування branch-scoped. Тихого повернення на порожній `main`
немає.

**Vercel (read-only, у Chrome власника):** проєкт `dream.car.vavd`, team
`6y7h9wdz4r-7375s-projects` (**Hobby**). Стабільний branch-аліас Preview для
`codex/admin-panel-spike` (Deployments → «Branch link for codex/admin-panel-spike»):
**`dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`**.
Env-змінних `KEYSTATIC_*` / `PANEL_CONTENT_BRANCH` / `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`
у проєкті **немає** (є лише `CONTACT_FORM_ENDPOINT` + `NEXT_PUBLIC_*_URL`).
Готовий запит із перевіреним callback — `docs/PANEL-owner-request-B1.md`
(розділ «Наступний крок — ГОТОВИЙ запит Vercel Preview»).

**Не перевірено:** запис/публікація з панелі; hosted-панель на Vercel Preview
(Hobby → Preview під Vercel Authentication, callback може впертися в захист — §3.5).

### П21 — Б1: встановлення App (форму заповнено) + без-авторизації відхилення + запит Vercel виправлено

- **Vercel-запит (`docs/PANEL-owner-request-B1.md`) виправлено:** прибрано
  суперечливе `PANEL_CONTENT_BRANCH=panel/content` (на Vercel `VERCEL_GIT_COMMIT_REF`
  сам = `codex/admin-panel-spike`; якщо задавати — тільки так, не `panel/content`).
  Додано `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=dreamcar-vavd-keystatic`.
  Перелік env звірено з `@keystatic/next@5.0.5` + `store/branch.ts`. Client ID
  позначено як ідентифікатор, Client Secret / `KEYSTATIC_SECRET` — секрети.
  **Vercel не змінювався.**
- **Початок інструкції власнику** переписано: статус-таблиця «що вже зроблено»
  (App створено, `.env`, вхід) — щоб не створити дубль App; поточна дія = лише
  встановлення. Стара історія створення позначена як пройдений етап.
- **Встановлення App:** асистент у Chrome власника відкрив
  `apps/dreamcar-vavd-keystatic/installations/new`, вибрав **Only select
  repositories → DreamCar-vavd/DREAM.CAR.VAVD**, натиснув **Install & Authorize**.
  На екрані встановлення звірено дозволи: **Contents: Read and write** ·
  **Deployments / Metadata / Pull requests: Read** · більше нічого.
  Далі GitHub → **«Confirm access»** (sudo) — **фінальний крок за власником**
  (пароль/passkey — асистент не вводить). Вкладку лишено відкритою.
- **Без-авторизації відхилення (curl, без cookie):** `/panel`, `/panel/leads`,
  `/panel/video` → «Ви не увійшли» (даних немає); `GET /api/panel/preview` →
  **401** і **draft-cookie не ставиться**; `POST /api/panel` (confirm-locale,
  publish) → **401** + `{"ok":false,"message":"Ви не увійшли через GitHub…"}`.
- **Коротка інструкція користування** (увійти → відкрити матеріал → чернетка →
  вийти) додана в `docs/PANEL-owner-request-B1.md`.
- **Не тестувалося:** запис/публікація (`Contents: write` — право надано, але
  коміт з панелі не робили); sign-out із живої сесії + повторний вхід — після
  завершення встановлення.

### П20 — Б1: App створено, `.env` заповнено, OAuth-вхід підтверджено

- **App:** власник створив «DreamCar-vavd Keystatic» вручну (`settings/apps/new`,
  ручний шлях — manifest-flow падав, П18). slug `dreamcar-vavd-keystatic`.
  Асистент манiфест/форму не заповнював (класифікатор блокує; + «Confirm access»).
- **`.env`:** асистент підготував (права `600`, git-ignored, `KEYSTATIC_SECRET`
  згенеровано); власник вписав `CLIENT_ID`/`CLIENT_SECRET` через TextEdit (без
  терміналу); асистент дописав `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. Усі 4
  ключі звірені **без показу значень** (формат/довжина).
- **Callback-готовність (перевірено до і після):** без креденшлів
  `/api/keystatic/github/oauth/callback` → 404, `…/login` → 307 на `/keystatic/setup`;
  після заповнення + рестарту серверу → `/keystatic` «Log in with GitHub»,
  `…/login` → 307 на `github.com/login/oauth/authorize` з правильним `redirect_uri`,
  `…/oauth/callback` → 400. OAuth недоступний до заповнення `.env` — задокументовано.
- **Тест входу (Chrome власника):** «Log in with GitHub» → авторизація →
  **Дашборд Keystatic** («Hello, DreamCar-vavd!») → `/panel` → **читаються 3/8/5/1**
  на `codex/admin-panel-spike` (після П19). Запис не перевіряли (контент не чіпати).
- **Відкрите:** App **не встановлено** на репо (`settings/installations` → лише
  Vercel); вхід працює через власні права на **публічний** репо, не через
  installation → «доступ лише до DREAM.CAR.VAVD» і деталі дозволів (RW/RO, Webhook)
  **не звірені**. `gh api /apps/<slug>` → 404 (App приватний). PR-кнопка й
  читання публічних даних **не є доказом** дозволів.
- **Наступне:** власник встановлює App (лише DREAM.CAR.VAVD) → асистент звіряє
  scope у `settings/installations` + тест виходу/повторного входу.

### П19 — /panel читав не ту гілку (виправлено + захист від повтору)

**Причина.** `src/lib/content/store/index.ts` резолвив гілку як
`PANEL_CONTENT_BRANCH || VERCEL_GIT_COMMIT_REF || "main"`. Локально жодна зі
змінних не задана → тихий `main`, де панельного контенту немає → `/panel`
показував 0 записів і «(Production)», хоча Keystatic на `codex/admin-panel-spike`
бачив 3/8/5. На фото власника — саме цей стан.

**Виправлено (код гілки, не `main`):**
- **`.env.local` setup-копії:** `PANEL_CONTENT_BRANCH=codex/admin-panel-spike`
  (асистент; власник env більше не редагує). `.env` і секрети не чіпані.
- **`src/lib/content/store/branch.ts` (новий):** `resolveContentBranch(env)` —
  `PANEL_CONTENT_BRANCH` → `VERCEL_GIT_COMMIT_REF` → **`{branch:null, reason}`**.
  **Прибрано `|| "main"`.** `store/index.ts`: `branch===null` → `NotConnectedError`
  (усі виклики `getStorage()` вже це обробляють → запис заблоковано, сторінка
  показує причину з підказкою «задайте PANEL_CONTENT_BRANCH»).
- **`PanelStorage.branch`** (adapter) — `GitHubStorage` віддає свою гілку,
  `LocalFsStorage` → `null`. `PanelData.branch` пробрасується у `/panel`.
- **Keystatic-лінки з `/panel` — гілко-залежні:**
  `/keystatic/branch/<enc(branch)>/collection|singleton/…` (було без гілки → відкривало
  Keystatic на `main`). Перегляд чернетки й раніше йшов через `getStorage()` — та сама гілка.
- **`/panel`:** рядок «Робоча гілка: `<branch>` (тестова гілка — не Production…)»;
  банер деплою тепер каже «на тестовому сайті гілки «<branch>»» + `(Preview)` +
  «Остання публікація: <дата>».
- **Тести:** новий `store/branch.test.ts` (5) — зокрема «без жодної змінної →
  НЕ тихий main»; `panelStore.test.ts` — гілко-залежні href. **242 → 247 pass.**
  tsc / eslint / `build:webpack` / `content:check` / `content:guard` — зелені.

**Перевірено в Chrome власника:** `/panel` @ `codex/admin-panel-spike` показує
**Автомобілі 3 / Галерея 8 / Послуги 5 / Контакти 1**, банер «Поточний знімок на
тестовому сайті гілки «codex/admin-panel-spike» (Preview)», усі «Редагувати в
Keystatic» ведуть на `…/branch/codex%2Fadmin-panel-spike/…`. Keystatic і `/panel`
узгоджені.

### П18 — діагностика провалу створення App: «We didn't find an App Manifest»
> Уточнення (12:54): на фото власник **був залогінений**, екран — **«Confirm
> access»** (sudo). Версія «ланцюг логіна > 5 хв» **знята**. ~5-хв cookie
> виміряно, але його сплив саме тоді — **не доведено**.
- **Симптом власника:** GitHub → «We didn't find an App Manifest for your
  request.» на екрані «Confirm access». Плюс консольне попередження React про
  `value` без `onChange` на `input[name="manifest"]`.
- **Попередження React — НЕ причина (доведено).** У браузері
  `new FormData(form).get("manifest")` = повний валідний JSON (409 симв.),
  `input.readOnly=false`, `disabled=false`, форма `POST`
  `application/x-www-form-urlencoded` → `github.com/settings/apps/new`. Джерело
  попередження — зібраний `keystatic-core-ui.js` (вендор). `node_modules` не
  патчили, перевірки не вимикали.
- **Маніфест доходить і приймається (доведено).** `curl -X POST … --data-urlencode
  "manifest=<той самий json>"` → GitHub `302 → /settings/apps/manifest` +
  `Set-Cookie app_manifest_token=… expires ~5 хв, HttpOnly, SameSite=Lax`.
  Помилкової сторінки немає.
- **`/settings/apps/manifest` вимагає входу:** без сесії → `302 /login?return_to=…`.
- **Виміряно, не доведено як тригер цього збою:** cookie `app_manifest_token`
  живе ~5 хв. Що згас саме під час спроби власника — доказів немає (власник був
  залогінений). (1-годинний ліміт із доків GitHub — інший токен, `code` на
  кроці `redirect_url`→`/app-manifests/{code}/conversions`.)
- **Робоча гіпотеза:** проміжний sudo-екран «Confirm access» між POST маніфесту
  й `/settings/apps/manifest` додає час/навігацію → або згасає ~5-хв cookie,
  або sudo-редірект його не доносить.
- **Практичне усунення (не залежить від точного тригера):** (1) зняти «Confirm
  access» наперед на `github.com/settings/apps`; (2) одразу (1–2 хв) пройти
  локальний setup без пауз на фото; (3) повторний збій → не циклити, ручний
  шлях. Провалена спроба доходить лише до сторінки **до** кнопки «Create» — App
  не створюється; перед новою спробою власник звіряє `github.com/settings/apps`.
- **Дубль-перевірка асистентом:** `GET /apps/dreamcar-vavd-keystatic` і
  `github.com/apps/dreamcar-vavd-keystatic` → 404 (публічного App із цим слагом
  немає). Точну перевірку робить власник (`github.com/settings/apps`).
- **Запасний шлях без manifest-flow:** ручне створення App (поля звірені з
  `@keystatic/core@0.6.9`), `KEYSTATIC_SECRET` = `openssl rand -hex 40` (80 hex,
  як генератор Keystatic; `keyToEnvVar` = `KEYSTATIC_GITHUB_CLIENT_ID` /
  `KEYSTATIC_GITHUB_CLIENT_SECRET` / `KEYSTATIC_SECRET`) — `docs/PANEL-owner-request-B1.md`.
- **Чернетка наступного запиту (Vercel Preview)** підготовлена в тому ж
  документі — виконувати ТІЛЬКИ після підтвердженого локального входу.
- **Код не змінювали.** Оновлено `docs/PANEL-owner-request-B1.md` (розділ
  «Діагностика» + крок 0 «увійти в GitHub» + «Запасний шлях») і
  `docs/PANEL-hosting-and-approvals.md` §2, §3.1.
- Setup-сервер (`next dev`, worktree `panel-setup-verify`, `127.0.0.1:3010`)
  лишили запущеним; App не створювали; `main`/Production не чіпали.

### П17 — GitHub App: готове середовище + один запит власнику
- **Мета:** одне перевірене посилання для СПРАВЖНЬОГО створення App власником,
  без ручного налаштування сервера й без нового кола звітів.
- **Persistent worktree:** `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify`
  переведено з `87fe84a` на `2b4d9f3`; створено `.env.local` (3 несекретні рядки);
  `next dev --webpack -H 127.0.0.1 -p 3010` (webpack — бо Turbopack не бере
  symlink `node_modules`). Ізоляція перевірена: окремий `.next` (різний inode),
  окремий порт, окремий процес (`next dev` PID у `setup-server.log`), node_modules
  read-only symlink; сервер власника на `:3000` і його `node_modules` не чіпані.
- **Одна адреса:** `http://127.0.0.1:3010/keystatic/setup`. Жодних паралельних
  3000/3100 у запиті. Секрети після «Create GitHub App» → `…-panel-setup-verify/.env`
  (Keystatic пише в `.env`, не `.env.local`, у CWD — звірено в
  `keystatic-core-api-generic.node.js`).
- **Маніфест (фактичний, без шаблонів):** name `DreamCar-vavd Keystatic`,
  `redirect_url` `http://127.0.0.1:3010/api/keystatic/github/created-app`,
  `callback_urls` `http://127.0.0.1:3010/…/oauth/callback` +
  `http://127.0.0.1/…/oauth/callback`, `default_permissions`
  `{contents:write, metadata:read, pull_requests:read}`.
- **Права розмежовано:** зараз потрібні — Contents RW, Metadata R (вхід +
  адаптер), Deployments R (банер, додати вручну). `pull_requests:read` — з
  типового маніфесту, наш конвеєр прямих комітів його не використовує (у коді
  `createPullRequest` — лише рядки перекладу UI Keystatic; наш `GitHubStorage`
  робить тільки `/contents` + `/deployments`). Майбутній `content-guard`→`main`
  (Б4) — це GitHub Actions workflow, не цей App. Зайвих прав не просимо.
- **Витрати:** створення/встановлення GitHub App не тарифікується, платного
  плану не потребує (GitHub Free → приватні репо; джерела в §2). Безлімітність
  Actions не стверджуємо — Б1 їх не використовує.
- **Інструкції виправлено:** з локального порядку setup прибрано вимкнення
  Vercel Deployment Protection (нова `docs/PANEL-hosting-and-approvals.md` §3.5 —
  окремо, після створення App, з доказом і мінімальною зміною); `.env.local`
  не видаляти; «зупинити сервер» = конкретний `kill <pid>`, не широкий шаблон і
  не `worktree remove --force`; відокремлено Suspend/Uninstall встановлення від
  Delete GitHub App.
- **Перевірка після дії власника** описана в запиті (лише імена змінних +
  «наявна/відсутня», без значень; при збої повернення — спершу перевірити, чи
  App уже створено, не робити дубль).
- Файли: `docs/PANEL-owner-request-B1.md` (переписано), `docs/PANEL-hosting-and-approvals.md`
  §3, `docs/PANEL-progress.md`, `PROJECT_PROGRESS.md`.
- **Наступне — дія власника (Б1).** Перенесення `.env`→Vercel і redeploy цим
  кроком не робиться.

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
  файловий dev-сервер на `:3000` не чіпали.
  (У П17 цей worktree зроблено persistent і придатним для справжнього setup —
  не видаляти.)
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
