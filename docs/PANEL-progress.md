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
- **Head:** docs+код-коміти поверх `87fe84a` (див. `git log`); PR #26 draft.
- **Сигнали окремо (не плутати):**
  - **GitHub CI `Verify`** — success на `359c108` і `b28bcac` (`gh pr checks 26`). Виконує tsc/eslint/тести + `next build` (Turbopack), але **без** env-змінних Keystatic → `storage.kind='local'` → github-перевірка не спрацьовує. Тому зелений `Verify` ≠ зелена збірка Vercel Preview, де env вже є.
  - **Vercel Preview build** — на `359c108` **Ready** (`36PPjaFU3fSU8UXG2oVKu6WpYfHe`, збиралось ще до env-змінних); на `b28bcac` **Error** (`8bFFkFtSjXffsi7c22whANajjige`) — Keystatic github-режим уже активний, але без `KEYSTATIC_GITHUB_CLIENT_SECRET` + `KEYSTATIC_SECRET` → див. П24. Очікувано, не регресія коду.
  - **Перевірка запуску сторінок на Vercel** — ще не робилась (немає успішної збірки з github-env).
  - **Перевірка входу користувача на Vercel** — ще не робилась.
- **Тести:** **247 pass** · tsc 0 · eslint 0 · `build:webpack` OK ·
  content:check/guard — зелені (2026-09-08, після П19).
- **Preview (Vercel):** остання **зелена** збірка — `359c108` (публічні сторінки працюють; `/panel` + `/keystatic` = 404, бо github-env тоді ще не було). `b28bcac` не обслуговується (Error).
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
