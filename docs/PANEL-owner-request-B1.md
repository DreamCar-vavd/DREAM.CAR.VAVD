# Б1 — GitHub App для hosted-панелі: запит власнику (крок 1)

> Один крок: створити GitHub App. Це **не** БД, не Blob, не тариф, не приватність
> репозиторію, не Vercel. Перенесення значень у Vercel і redeploy — окремий
> наступний крок, цим документом не дозволений.
> Повний контекст — `docs/PANEL-hosting-and-approvals.md` §2. Протокол
> hosted-перевірки після підключення — `docs/PANEL-hosted-verification.md`.

## Що вже підготовлено (асистентом, без дій власника)

- **Ізольована робоча копія для setup:** `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify`
  (окремий `git worktree` гілки `codex/admin-panel-spike` @ `2b4d9f3`; не iCloud;
  окремий `.next`, окремий порт, окремий процес; `node_modules` — read-only
  symlink на основну копію). Основну копію й dev-сервер власника на `:3000` не
  чіпали.
- **`.env.local`** у цій копії вже створено — лише 3 несекретні рядки:
  `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github`, `KEYSTATIC_GITHUB_REPO_OWNER=DreamCar-vavd`,
  `KEYSTATIC_GITHUB_REPO_NAME=DREAM.CAR.VAVD`. `.env` і `.env.local` покриті
  `.gitignore` (`git status` чистий).
- **Dev-сервер setup вже запущений** на loopback: `http://127.0.0.1:3010`
  (процес `next dev` цієї копії, окремий від сервера власника). Адреса доступна
  лише на цьому Mac і лише поки сервер працює.
- **Маніфест GitHub App перевірено наживо** з цієї адреси (нижче — фактичні
  значення, без шаблонів). App **не** створювався, дозволи **не** підтверджувались.

Фактичний маніфест (з `http://127.0.0.1:3010/keystatic/setup`):

```json
{
  "name": "DreamCar-vavd Keystatic",
  "url": "http://127.0.0.1:3010/keystatic",
  "public": true,
  "redirect_url": "http://127.0.0.1:3010/api/keystatic/github/created-app",
  "callback_urls": [
    "http://127.0.0.1:3010/api/keystatic/github/oauth/callback",
    "http://127.0.0.1/api/keystatic/github/oauth/callback"
  ],
  "request_oauth_on_install": true,
  "default_permissions": { "contents": "write", "metadata": "read", "pull_requests": "read" }
}
```

## Діагностика першої спроби (2026-09-07)

Перша спроба власника впала: GitHub показав **«We didn't find an App Manifest
for your request.»**. На фото власника видно, що **він уже був залогінений**, а
екран був **«Confirm access»** (GitHub sudo-режим — повторне підтвердження
особи перед створенням App). У консолі також було попередження React про
`value` без `onChange` на `input[name="manifest"]`.

**Що доведено:**

- **Попередження React — НЕ причина.** У браузері `new FormData(form).get("manifest")`
  повертає повний валідний JSON (409 символів), `input.readOnly === false`,
  `input.disabled === false`, форма — `POST` `application/x-www-form-urlencoded`
  на `https://github.com/settings/apps/new`. Read-only поле все одно
  відправляється. Попередження — із зібраного `keystatic-core-ui.js` (вендор),
  косметичне; `node_modules` не патчимо, перевірки не вимикаємо.
- **Маніфест доходить до GitHub і приймається.** `curl -X POST …
  --data-urlencode "manifest=<той самий json>"` → GitHub відповідає
  `302 → /settings/apps/manifest` і ставить cookie `app_manifest_token=…`.
  Помилкової сторінки немає — тіло маніфесту прийняте.

**Що виміряно, але НЕ доведено як причину саме цього збою:**

- Cookie `app_manifest_token` у моєму експерименті мав `expires` через **~5 хв**
  (`HttpOnly; SameSite=Lax`). GitHub тримає надісланий маніфест за цим cookie на
  `/settings/apps/manifest`.
- Що цей cookie згас **саме під час спроби власника** — **не підтверджено**.
  Власник був залогінений, тож моя попередня версія «ланцюг логіна > 5 хв» не
  застосовна.

**Робоча гіпотеза (не факт):** проміжний екран **«Confirm access»** (sudo) між
POST маніфесту й сторінкою `/settings/apps/manifest` додає навігаційні переходи
й час; за цей проміжок або згасає ~5-хв cookie `app_manifest_token`, або
sudo-редірект його не доносить — і GitHub каже «We didn't find an App Manifest
for your request». (Окремий 1-годинний ліміт із доків GitHub — це вже `code` на
кроці `redirect_url` → `/app-manifests/{code}/conversions`, інша річ.)

**Практичне усунення (не залежить від того, яка з причин точна):**
1. Спершу **зняти sudo наперед**: відкрити `https://github.com/settings/apps` —
   якщо GitHub показує «Confirm access», пройти його там.
2. **Одразу** (у ті самі 1–2 хв) відкрити локальний setup і натиснути «Create
   GitHub App», не роблячи пауз на пересилання фото між кроками.
3. Якщо все одно «We didn't find an App Manifest» — **не повторювати нескінченно**:
   перейти на §«Запасний шлях» (ручне створення, без manifest-flow і без
   5-хв вікна).

Провалена спроба доходить лише до сторінки-підтвердження **до** кнопки «Create
GitHub App» — тобто App при цій помилці **не створюється**. Але це не гарантія:
перед новою спробою власник має звірити список (нижче).

## Перед новою спробою — звірити, що App ще не створено

**За перевіреними адресами App не знайдено; повний список створених App ще не
перевірено.** Асистент пробив кілька очікуваних слагів
(`GET /apps/dreamcar-vavd-keystatic` тощо і публічні сторінки) → 404, і в
setup-копії немає `.env`. Це **не доказ**, що App не створено: приватний App за
цими запитами теж дав би 404, а user-token не має ендпойнта для переліку
створених App. Сторінку `github.com/settings/apps` відкриває лише власник
(асистент не в його сесії GitHub). **Точну перевірку робить власник:**

- Створені App: **`https://github.com/settings/apps`** — списку не має містити
  «DreamCar-vavd Keystatic».
- Встановлені на репозиторій: **`https://github.com/DreamCar-vavd/DREAM.CAR.VAVD/settings/installations`**
  — не має бути Keystatic-App.

Якщо App там уже є — **не створювати другий**: повідомити, і далі працюємо з
наявним (додати Deployments: Read, звірити callback, за потреби перегенерувати
client secret).

## Права: потрібне зараз vs майбутнє

| Право | Навіщо | Коли |
|---|---|---|
| **Contents: Read and write** | Keystatic комітить контент прямо в гілку (без `branchPrefix` → без PR); наш адаптер публікації робить `PUT /contents` + читає файли й коміти | **зараз** — вхід + контентний адаптер |
| **Metadata: Read** | обов'язкове GitHub для будь-якого App | **зараз** |
| **Deployments: Read** | банер стану збірки в `/panel` (`deployStatus()` читає `/deployments` + `/statuses`); без нього банер показує «стан невідомий» — не помилка | **зараз** — додається вручну (маніфест його не просить) |
| **Pull requests: Read** | у типовому маніфесті Keystatic; наш конвеєр прямих комітів його **не** використовує, лише гілкова панель Keystatic показує посилання «View pull requests» | у маніфесті вже є; лишити як є (read-only) |
| ~~Pull requests: Write / Workflows / Administration / Actions / Secrets / Members~~ | **не запитуються.** Майбутній конвеєр `content-guard` → `main` (Б4) виконує **GitHub Actions workflow** окремим actor у bypass-списку ruleset, а **не** цей App | — |

`Pull requests: Read` наразі достатньо. Якщо колись знадобиться, щоб App
**відкривав** PR через API (зараз такої операції в коді немає) — це буде окрема
зміна дозволу з показом конкретної операції, і лише з погодженням власника.

---

## ЗАПИТ ДЛЯ ПЕРЕДАЧІ АСИСТЕНТУ

**Потрібна дія власника:**
Пройти справжнє створення GitHub App за готовим посиланням і встановити App
лише на репозиторій `DreamCar-vavd/DREAM.CAR.VAVD`. Три значення, які видасть
GitHub, залишаться у локальному файлі — нікуди їх не вставляти й не пересилати.

**Що вже підготовлено:**
Ізольована копія `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify` з
`.env.local` (3 несекретні рядки) і вже запущеним локальним сервером
`http://127.0.0.1:3010`. Маніфест перевірено (значення вище). Основну копію,
Vercel, `main`, сервер власника на `:3000` не чіпали.

**Точне робоче посилання:**
`http://127.0.0.1:3010/keystatic/setup`
(працює лише на цьому Mac, поки запущений підготовлений сервер).

**Що власник побачить:** екран **«Keystatic Setup»** з двома полями («Deployed
App URL», «GitHub organization») — **лишити порожніми** — і кнопкою **«Create
GitHub App»**. Косметичне попередження React у консолі — ігнорувати.

**Одна інструкція на весь процес (робити підряд, без пауз на фото):**

1. **Звірити акаунт.** Відкрити `https://github.com/settings/apps` — має бути
   акаунт **`DreamCar-vavd`** (праворуч угорі — його аватар; URL без
   `/organizations/…`). У списку **немає** «DreamCar-vavd Keystatic» (якщо є —
   стоп, повідомити, не створювати другий).
2. **Зняти «Confirm access» наперед.** Якщо на кроці 1 GitHub попросив «Confirm
   access» (sudo) — пройти його там (пароль / passkey / 2FA). Тепер вікно
   sudo-режиму відкрите.
3. **Відразу** відкрити `http://127.0.0.1:3010/keystatic/setup` → **«Create
   GitHub App»**. Відкриється сторінка GitHub **«Register new GitHub App»** уже
   заповнена.
4. **Звірити на цій сторінці GitHub** (нічого не міняти):
   - Name: **`DreamCar-vavd Keystatic`**
   - Callback URL: **`http://127.0.0.1:3010/api/keystatic/github/oauth/callback`**
   - «Request user authorization (OAuth) during installation» — **увімкнено**
   - Repository permissions: **Contents: Read and write**, **Metadata: Read**,
     **Pull requests: Read** (Webhook — вимкнено або без URL)
   Якщо замість форми знову «We didn't find an App Manifest» — перезавантажити
   `http://127.0.0.1:3010/keystatic/setup` і клікнути ще раз **один** раз.
   Якщо і вдруге те саме — **зупинитись** і перейти на «Запасний шлях» нижче
   (не повторювати далі).
5. Внизу натиснути **«Create GitHub App»**. GitHub поверне на
   `http://127.0.0.1:3010/api/keystatic/github/created-app`; Keystatic сам
   допише 3 значення у `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify/.env`
   і відкриє `/keystatic`.
6. GitHub → Settings → Developer settings → GitHub Apps → **DreamCar-vavd
   Keystatic** → **Permissions & events** → додати **Deployments → Read-only**
   → **Save changes**. (Якщо GitHub попросить — власник підтверджує оновлення
   дозволів для встановлення.)
7. Той самий App → **Install App** → **`DreamCar-vavd`** → **Only select
   repositories** → **`DREAM.CAR.VAVD`** → **Install** (або **Configure** →
   зберегти нові дозволи, якщо вже було встановлено на кроці «OAuth during
   installation»).
8. Написати асистенту один рядок: **«App створено й встановлено»** (за бажанням —
   назву App, якщо додавали суфікс). `.env` **не відкривати** й не звітувати про
   вміст — придатність конфігурації асистент перевірить сам.

**Які права погоджуються:**
Repository permissions **лише** для `DreamCar-vavd/DREAM.CAR.VAVD`:
**Contents: Read and write**, **Metadata: Read**, **Deployments: Read**,
**Pull requests: Read**. Більше нічого. Webhook вимкнено. Встановлення тільки
на один репозиторій, не org-wide, не «All repositories».
Гілки не перейменовувати, домен не додавати, приватність репозиторію не
змінювати, Production і Vercel не чіпати.

**Де залишаться секрети:**
Тільки у файлі **`/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify/.env`**
(Keystatic дописує його автоматично; файл у `.gitignore`, поза iCloud, окремо
від основної робочої копії). Значення `KEYSTATIC_GITHUB_CLIENT_ID`,
`KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` — **не** в Git, **не** в
основній копії, **не** в чаті. Наступний крок (окремий запит) — вписати ці 3
значення у Vercel → Environment Variables вручну (Preview, тільки гілка
`codex/admin-panel-spike`); доти цей `.env` — єдина копія, тож його **не**
видаляти.

**Як виглядає успішний результат:**
- GitHub → Settings → Developer settings → GitHub Apps — є **DreamCar-vavd
  Keystatic**; Permissions: Contents RW, Metadata R, Deployments R, Pull
  requests R; Webhook Active — знято.
- App → Install App — встановлений на `DreamCar-vavd/DREAM.CAR.VAVD` і більше
  ніде.
- У `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify/.env` з'явились
  рядки з іменами `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`,
  `KEYSTATIC_SECRET` (перевіряти **наявність імен**, значень не відкривати).
- `git -C /Users/apple/Projects/DREAM.CAR.VAVD-admin-panel-20260906 log origin/main -1`
  — без змін.
- Витрати: **$0**. Створення й встановлення GitHub App не тарифікуються GitHub
  і не потребують платного плану (GitHub Free для особистого акаунта дозволяє
  приватні репозиторії; джерела — `docs/PANEL-hosting-and-approvals.md` §2).

**Що повідомити після виконання:**
Одним рядком: **«App створено й встановлено»** (+ назва App, якщо з суфіксом).
`.env` не відкривати. Далі асистент сам звірить конфігурацію, дозволи, область
встановлення й callback, і проведе тестовий вхід.

---

## Запасний шлях: створити App вручну (без manifest-flow)

Якщо manifest-flow падає і вдруге. Тут немає 5-хвилинного вікна й екрана-«гаку».
Поля звірені з установленою `@keystatic/core@0.6.9` / `@keystatic/next@5.0.5`.

1. GitHub (залогінений, `DreamCar-vavd`) → Settings → Developer settings →
   GitHub Apps → **New GitHub App**. Якщо GitHub попросить «Confirm access» —
   пройти. Заповнити рівно так:

   | Поле | Значення |
   |---|---|
   | **GitHub App name** | `DreamCar-vavd Keystatic` (якщо зайнято → `DreamCar-vavd Keystatic Panel`) |
   | **Homepage URL** | `http://127.0.0.1:3010/keystatic` |
   | **Callback URL** | `http://127.0.0.1:3010/api/keystatic/github/oauth/callback` |
   | **Request user authorization (OAuth) during installation** | ✅ увімкнути |
   | **Expire user authorization tokens** | лишити як є (типово ✅) |
   | **Webhook → Active** | ✖ вимкнути (Webhook URL не потрібен) |
   | **Repository permissions → Contents** | **Read and write** |
   | **Repository permissions → Metadata** | **Read-only** (виставиться саме) |
   | **Repository permissions → Pull requests** | **Read-only** |
   | **Repository permissions → Deployments** | **Read-only** |
   | *решта permissions* | **No access** |
   | **Where can this GitHub App be installed?** | **Only on this account** |

   → **Create GitHub App**.
2. На сторінці App: скопіювати **Client ID** (вигляд `Iv23li…` або `Iv1.…`);
   **Generate a new client secret** → скопіювати (показується один раз).
3. У терміналі згенерувати `KEYSTATIC_SECRET` (Keystatic-сумісна довжина — 80 hex):
   `openssl rand -hex 40`
4. Створити файл `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify/.env`
   (git-ignored, **не** комітити) з трьома рядками — значення вставити **у файл**,
   не в чат:
   ```
   KEYSTATIC_GITHUB_CLIENT_ID=<Client ID>
   KEYSTATIC_GITHUB_CLIENT_SECRET=<client secret з кроку 2>
   KEYSTATIC_SECRET=<вивід openssl з кроку 3>
   ```
   (`.env.local` із 3 несекретними рядками вже є — його не чіпати.)
4. Створити файл `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify/.env`
   (git-ignored, **не** комітити; `.env.local` не чіпати) з трьома рядками —
   значення вставити **у файл**:
   ```
   KEYSTATIC_GITHUB_CLIENT_ID=<Client ID>
   KEYSTATIC_GITHUB_CLIENT_SECRET=<client secret>
   KEYSTATIC_SECRET=<вивід openssl>
   ```
5. App → **Install App** → `DreamCar-vavd` → **Only select repositories** →
   `DREAM.CAR.VAVD` → **Install**.
6. Написати асистенту: **«App створено вручну й встановлено»** (+ назва App).
   `.env` не звітувати. Асистент перезапустить сервер і проведе перевірку.

---

## Перевірка асистентом після дії власника (значень секретів не виводити)

1. `.env` у setup-копії містить рядки з іменами
   `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`,
   `KEYSTATIC_SECRET` — перевірка `grep -oE '^(KEYSTATIC_GITHUB_CLIENT_ID|KEYSTATIC_GITHUB_CLIENT_SECRET|KEYSTATIC_SECRET)='`
   (лише імена + «наявна/відсутня»). Наявні env-файли не перезаписувати.
2. Перезапустити setup-сервер (конкретний `kill <pid>` → перезапуск), відкрити
   `http://127.0.0.1:3010/keystatic` — має показати **«Sign in with GitHub»**
   (github-режим активний), а не екран Setup.
3. Через `gh` (акаунт `DreamCar-vavd`) звірити **реєстрацію App**:
   `gh api /apps/<slug>` — назва, `owner.login = DreamCar-vavd`, і що
   `permissions` містить `contents: write`, `metadata: read`,
   `pull_requests: read`, `deployments: read`.
   ⚠️ `GET /apps/<slug>` показує **дефолтні** дозволи й `installations_count` —
   він **НЕ** доказ, що конкретне встановлення обмежене одним репозиторієм.
4. **Область встановлення — окремо.** Достовірно її видно лише власнику:
   `https://github.com/settings/installations` → цей App → «Repository access»
   = **Only select repositories → DREAM.CAR.VAVD** (не «All repositories»).
   Побічно асистент підтвердить її тестовим входом (крок 6): Keystatic у
   github-режимі бачить лише `DreamCar-vavd/DREAM.CAR.VAVD`; спроба звернутись
   до іншого репо через токен встановлення дала б `404`.
5. Callback у налаштуваннях App = `http://127.0.0.1:3010/api/keystatic/github/oauth/callback`
   (той самий хост і порт, що й сервер).
6. **Тестовий вхід (пароль/passkey/коди вводить власник, асистент дивиться
   логи сервера й сторінки):**
   - `http://127.0.0.1:3010/keystatic` → «Sign in with GitHub» → Authorize →
     має відкритися редактор колекцій;
   - `http://127.0.0.1:3010/panel` → дашборд із розділами;
   - **вихід** (Keystatic → Sign out) → повторно відкрити `/panel` і
     «Переглянути чернетку» → має бути «Сесію завершено / потрібна авторизація»,
     дані панелі недоступні.
   Це і є критерій завершення Б1. Тестовий матеріал **не публікувати** (жодного
   «Опублікувати зміни»).

---

## Наступний крок — ЧЕРНЕТКА запиту (виконувати ТІЛЬКИ після підтвердженого локального входу)

Не діяти за цим, доки крок «Тестовий вхід» вище не дав ✅ (редактор + `/panel`
відкрились локально). Тоді — оформити й передати:

> **ЗАПИТ ДЛЯ ПЕРЕДАЧІ АСИСТЕНТУ — Vercel Preview для hosted-панелі**
>
> **Потрібна дія власника:** додати 6 (+1 опційну) env-змінні у Vercel і
> зробити redeploy — **лише для Preview гілки `codex/admin-panel-spike`**,
> Production не чіпати.
>
> **Точна гілка:** `codex/admin-panel-spike` (PR #26, draft).
> **Проєкт Vercel:** `dream.car.vavd` (team `6y7h9wdz4r-7375s-projects`).
> **Перевірена адреса:** стабільний branch-аліас Preview — **скопіювати** з
> Vercel → Project → Deployments (поряд із гілкою) або Settings → Domains
> (вигляд `dreamcarvavd-git-codex-admin-panel-spike-<scope>.vercel.app`;
> **не вигадувати**). Далі `<ALIAS>`.
>
> **Env (Vercel → Settings → Environment Variables; для кожної Environment =
> Preview → Specific Git Branches → `codex/admin-panel-spike`):**
> | Змінна | Значення | Секрет |
> |---|---|---|
> | `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND` | `github` | ні |
> | `KEYSTATIC_GITHUB_REPO_OWNER` | `DreamCar-vavd` | ні |
> | `KEYSTATIC_GITHUB_REPO_NAME` | `DREAM.CAR.VAVD` | ні |
> | `KEYSTATIC_GITHUB_CLIENT_ID` | з `…-panel-setup-verify/.env` | **так** |
> | `KEYSTATIC_GITHUB_CLIENT_SECRET` | з `…-panel-setup-verify/.env` | **так** |
> | `KEYSTATIC_SECRET` | з `…-panel-setup-verify/.env` | **так** |
> | `PANEL_CONTENT_BRANCH` *(опційно)* | `panel/content` | ні |
> Секрети вставляти лише у поле Value у Vercel — не в чат / Git.
>
> **Callback:** у GitHub App → Callback URLs **додати** (не замінювати
> локальний) `https://<ALIAS>/api/keystatic/github/oauth/callback`.
>
> **Redeploy:** Vercel → Deployments → останній для гілки → ⋯ → Redeploy
> (env застосовуються лише до нової збірки).
>
> **Спосіб перевірки:** `https://<ALIAS>/keystatic` → Sign in with GitHub →
> Authorize → редактор; `https://<ALIAS>/panel` → дашборд. Далі — повний
> протокол `docs/PANEL-hosted-verification.md` (вхід двох користувачів, відмова
> сторонньому, публікація за SHA, конфлікт, відкликання). Захист Preview vs
> OAuth — `docs/PANEL-hosting-and-approvals.md` §3.5 (оцінювати лише за
> фактичним збоєм, глобально не вимикати).
>
> **Межі:** Production / `main` / DNS / тарифи / видимість репо не чіпати.
> PR #26 лишається draft.

---

## Тимчасове відключення vs повне видалення (не плутати)

- **Тимчасово відключити, зберігши App і `.env`:** GitHub → репозиторій →
  Settings → GitHub Apps → Configure → **Suspend** встановлення (або Uninstall
  installation). Реєстрація App і його client id/secret лишаються. Плюс:
  зупинений локальний сервер робить `http://127.0.0.1:3010` недоступним.
- **Повністю видалити App і його креденшли:** GitHub → Settings → Developer
  settings → GitHub Apps → **Delete GitHub App**. Лише якщо від панелі
  відмовляються зовсім.
- Жодна з дій не змінює `main`, історію, контент, Production, DNS.
- Файли `.env` / `.env.local` / незакомічені файли при відключенні **не**
  видаляти — це не спосіб відключення, а втрата єдиної копії значень.

## Зупинити підготовлений сервер (коли перегляд завершено)

Конкретний процес, не за широким шаблоном. Поточний pid — `75636`
(`next dev` копії `panel-setup-verify`); якщо сервер перезапускали, актуальний
pid — у першому рядку `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify/setup-server.log`
або `lsof -nP -iTCP:3010 -sTCP:LISTEN -t`.
```
ps -p 75636 -o command=      # переконатись, що це саме той next dev
kill 75636
```
Worktree `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify` **лишити** —
у ньому `.env` із секретами. Прибрати його можна лише після того, як значення
перенесені у Vercel і hosted-перевірка пройдена (окремий крок).
