# Б1 — GitHub App для hosted-панелі: запит власнику

> Повний контекст — `docs/PANEL-hosting-and-approvals.md` §2. Протокол
> hosted-перевірки — `docs/PANEL-hosted-verification.md`.

## СТАТУС на 2026-09-08 (щоб не робити двічі)

| Крок | Стан |
|---|---|
| Створити GitHub App `DreamCar-vavd Keystatic` (slug `dreamcar-vavd-keystatic`) | ✅ **ЗРОБЛЕНО** — другий App не створювати |
| `.env` (Client ID / Client Secret / `KEYSTATIC_SECRET` / slug) | ✅ **ЗРОБЛЕНО** — 4 ключі звірено |
| Локальний вхід через GitHub у `/keystatic` + `/panel` | ✅ **ПРАЦЮЄ** — 3 авто / 8 галерея / 5 послуг / 1 контакт на `codex/admin-panel-spike` |
| App встановлено на `DREAM.CAR.VAVD` (тільки на нього) | ✅ **ЗРОБЛЕНО** — звірено в `settings/installations`: Only select repositories → `DreamCar-vavd/DREAM.CAR.VAVD`; Contents **Read and write**; Metadata/Pull requests/Deployments **Read**; Webhook **Active off** |
| Тест виходу з живої сесії + повторний вхід | ✅ **ПРОЙДЕНО** — після Sign out `/panel`,`/panel/leads`,`/panel/video` → «Ви не увійшли»; чернетка → «Сесію завершено…»; повторний вхід відновлює 3/8/5/1 |
| Vercel Preview (env + callback + redeploy) | ⏳ **готовий запит** нижче — виконується окремо |

**Локальний Б1 завершено.** Розділи нижче («Встановити App», «Ручний шлях»,
«manifest-flow», «Діагностика») — історія пройдених кроків, не повторювати.
**Не перевірено:** запис/публікація з панелі (право `Contents: write` надано,
але коміт не робився); робота на Vercel Preview.

---

## ~~Встановити App на `DREAM.CAR.VAVD`~~ — виконано 2026-09-08

Звірено в `github.com/settings/installations` → DreamCar-vavd Keystatic:
**Only select repositories → `DreamCar-vavd/DREAM.CAR.VAVD`** ·
Permissions: Read and write access to code · Read access to deployments,
metadata, and pull requests · **Webhook Active — off** · Redirect URI
`http://127.0.0.1:3010/api/keystatic/github/oauth/callback`.

---

## Коротка інструкція користування локальною панеллю

Працює **лише на цьому Mac** і **лише поки запущений сервер setup** (`next dev`
на `127.0.0.1:3010`). З інтернету, телефону чи іншого комп'ютера — недоступно.

| Дія | Як |
|---|---|
| **Увійти** | відкрити `http://127.0.0.1:3010/keystatic` → **«Log in with GitHub»** → Authorize (пароль/passkey — власник) |
| **Відкрити матеріал** | `http://127.0.0.1:3010/panel` — «Панель публікації». Угорі має бути **«Робоча гілка: codex/admin-panel-spike»**. Розділи: Автомобілі (3), Галерея (8), Послуги (5), Контакти (1). Кнопка **«Редагувати в Keystatic →»** біля картки відкриває редактор **на тій самій гілці** |
| **Переглянути чернетку** | на `/panel` → **«Переглянути чернетку на сайті →»** — показує робочу версію на макеті сайту (ще не опубліковану). Повернення: додати `?disable=1` або кнопку виходу з режиму чернетки |
| **Вийти** | у Keystatic (нижній лівий кут) → меню користувача → **Sign out**. Після цього `/panel` і чернетка без входу недоступні |

Публікувати (кнопка «Опублікувати зміни») поки **не потрібно** — етап Б1 це не
передбачає.

---

## Історія етапу створення (нижче) — вже виконано, не повторювати

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

> **Рекомендований шлях — «Ручний шлях» нижче** (без 5-хв вікна, без терміналу;
> `.env` уже підготовлено). Manifest-flow у цьому розділі лишається як варіант,
> але він крихкий (перша спроба власника впала — див. «Діагностика»).

**Потрібна дія власника:**
Пройти справжнє створення GitHub App і встановити App лише на репозиторій
`DreamCar-vavd/DREAM.CAR.VAVD`. Значення, які видасть GitHub, вставляються лише
у локальний файл `.env` — нікуди більше.

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

## Ручний шлях (рекомендований) — без терміналу, без 5-хв вікна

Поля звірені з установленими `@keystatic/core@0.6.9` / `@keystatic/next@5.0.5`.
**`.env` у setup-копії вже підготовлено асистентом:** права `600`, git-ignored,
`KEYSTATIC_SECRET` згенеровано (не показується). Власнику лишається вставити
**два** значення у файл; `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` асистент впише
сам після створення App (реальний slug із GitHub, не вгаданий).

### Крок 1 (власник) — створити App

GitHub (залогінений, `DreamCar-vavd`) → **`https://github.com/settings/apps/new`**.
Якщо попросить «Confirm access» — пройти. Заповнити рівно так:

| Поле | Значення |
|---|---|
| **GitHub App name** | `DreamCar-vavd Keystatic` (якщо зайнято → `DreamCar-vavd Keystatic Panel`; сказати асистенту фактичну назву) |
| **Homepage URL** | `http://127.0.0.1:3010/keystatic` |
| **Identifying and authorizing users → Redirect URI** | `http://127.0.0.1:3010/api/keystatic/github/oauth/callback` |
| **Expire user authorization tokens** | лишити ✅ (типово) |
| **Request user authorization (OAuth) during installation** | ✅ **увімкнути** |
| **Enable Device Flow** | лишити вимкненим |
| **Webhook → Active** | ✖ **вимкнути** |
| **Repository permissions → Contents** | **Read and write** |
| **Repository permissions → Pull requests** | **Read-only** |
| **Repository permissions → Deployments** | **Read-only** |
| Metadata | стане **Read-only** саме |
| *решта permissions* | **No access** |
| **Where can this GitHub App be installed?** | **Only on this account** |

→ **Create GitHub App**. **App поки НЕ встановлювати.**

### Крок 2 (власник) — скопіювати Client ID і Client secret

На сторінці App:
- **Client ID** — просто на сторінці (вигляд `Iv23li…`);
- **Client secrets → Generate a new client secret** → скопіювати (показується
  один раз).

### Крок 3 (власник) — вставити їх у підготовлений файл (без терміналу)

1. Finder → меню **Перехід → Перехід до папки…** (`Cmd+Shift+G`) → вставити
   `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify` → Enter.
2. Показати приховані файли: `Cmd+Shift+.` (крапка). З'явиться файл **`.env`**.
3. Відкрити його **у TextEdit**: правою кнопкою на `.env` → **Відкрити у
   програмі → TextEdit**. Якщо TextEdit перемкнувся у форматований режим —
   меню **Формат → Зробити звичайним текстом**.
4. У файлі вже є рядки. Заповнити **тільки** ці два (кожен на своєму рядку,
   без пробілів навколо `=`):
   ```
   KEYSTATIC_GITHUB_CLIENT_ID=<сюди Client ID>
   KEYSTATIC_GITHUB_CLIENT_SECRET=<сюди client secret>
   ```
   Рядки `KEYSTATIC_SECRET=…` і `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=`
   **не чіпати**.
5. **Зберегти** (`Cmd+S`). Якщо TextEdit пропонує додати `.txt` — відмовитись,
   ім'я лишити `.env`.
6. Написати асистенту: **«Client ID і secret вставлено у .env»** (+ фактична
   назва App, якщо з суфіксом). Вміст файлу **не** пересилати.

### Крок 4 (асистент) — дописати slug, перезапустити сервер, звірити

- Отримати **фактичний slug** App: `gh api /apps/<slug-кандидат>` або зі
  сторінки `github.com/apps/<slug>` → вписати
  `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=<slug>` у `.env` (лише цей рядок).
- Звірити **наявність** усіх 4 ключів (імена + «наявний/порожній», без значень).
- Перезапустити **лише свій** setup-сервер (`kill <pid>` конкретного `next dev`
  → перезапуск).
- **Перевірити готовність callback:** `GET /api/keystatic/github/login` має
  тепер вести на `github.com/login/oauth/...` (а не редіректити на
  `/keystatic/setup`); `GET /api/keystatic/github/oauth/callback` — вже **не**
  `404`. `GET /keystatic` — показує **«Sign in with GitHub»**, не екран Setup.
  Доти OAuth власнику **не** пробувати.

### Крок 5 (власник) — встановити App і авторизуватися

- App → **Install App** → `DreamCar-vavd` → **Only select repositories** →
  **`DREAM.CAR.VAVD`** → **Install**.
- `http://127.0.0.1:3010/keystatic` → **Sign in with GitHub** → Authorize
  (пароль/passkey/коди — власник).

---

## Перевірка асистентом після дії власника (значень секретів не виводити)

1. `.env` містить **усі 4** ключі — `KEYSTATIC_GITHUB_CLIENT_ID`,
   `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`,
   `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` — перевірка `grep -oE '^[A-Z_]+='`
   (лише імена + «наявний/порожній»). Значень **не** друкувати; наявні
   `.env`/`.env.local` не перезаписувати (тільки дописати slug-рядок).
2. Callback готовий (крок 4 вище): `/keystatic` → «Sign in with GitHub»;
   `/api/keystatic/github/login` ініціює OAuth; `/api/keystatic/github/oauth/callback`
   не 404.
3. Через `gh` (акаунт `DreamCar-vavd`) звірити **реєстрацію App**:
   `gh api /apps/<slug>` — назва, `owner.login = DreamCar-vavd`, і що
   `permissions` містить `contents: write`, `metadata: read`,
   `pull_requests: read`, `deployments: read`.
   ⚠️ `GET /apps/<slug>` показує **дефолтні** дозволи й `installations_count` —
   він **НЕ** доказ, що конкретне встановлення обмежене одним репозиторієм.
4. **Область встановлення — окремо.** Асистент відкриває
   `https://github.com/settings/installations` у Chrome власника → цей App →
   «Repository access» = **Only select repositories → DREAM.CAR.VAVD**
   (не «All repositories»). Побічно підтверджується тестовим входом: Keystatic
   у github-режимі бачить лише `DreamCar-vavd/DREAM.CAR.VAVD`.
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

## Наступний крок — ГОТОВИЙ запит Vercel Preview

Локальний Б1 **завершено й перевірено** (2026-09-08, П22): App встановлено на
`DREAM.CAR.VAVD` (тільки на нього), дозволи звірені, Webhook off; тест виходу з
живої сесії + повторний вхід — пройдено. Vercel цим документом **не** змінюється —
запит нижче передається для окремого виконання.

> **ЗАПИТ ДЛЯ ПЕРЕДАЧІ АСИСТЕНТУ — Vercel Preview для hosted-панелі**
>
> **Потрібна дія власника:** додати 7 env-змінних у Vercel, додати callback у
> GitHub App і зробити redeploy — **лише для Preview гілки
> `codex/admin-panel-spike`**. Production не чіпати.
>
> **Проєкт Vercel:** `dream.car.vavd` · team `6y7h9wdz4r-7375s-projects` (Hobby).
> **Гілка:** `codex/admin-panel-spike` (PR #26, draft).
> **Перевірений branch-аліас Preview** (звірено у Vercel Dashboard 2026-09-08):
> `dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`
> (у Deployments позначений «Branch link for codex/admin-panel-spike»; Vercel
> скорочує довгу назву гілки до `codex-admin-p` + хеш `648563` — це нормально).
>
> **1. Env** (Vercel → Settings → Environment Variables → Add; для кожної:
> Environment = **Preview**, і в **Specific Git Branches** вибрати
> `codex/admin-panel-spike`). Жодної з цих 7 у проєкті ще немає (звірено).
> Перелік звірено з `@keystatic/next@5.0.5` + `src/lib/content/store/branch.ts`.
>
> | Змінна | Значення | Тип |
> |---|---|---|
> | `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND` | `github` | звичайна |
> | `KEYSTATIC_GITHUB_REPO_OWNER` | `DreamCar-vavd` | звичайна |
> | `KEYSTATIC_GITHUB_REPO_NAME` | `DREAM.CAR.VAVD` | звичайна |
> | `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | `dreamcar-vavd-keystatic` | звичайна (публічний slug; інлайниться у збірку) |
> | `KEYSTATIC_GITHUB_CLIENT_ID` | з `…-panel-setup-verify/.env` | **ідентифікатор** (не пароль, але лише в env, не в чат) |
> | `KEYSTATIC_GITHUB_CLIENT_SECRET` | з `…-panel-setup-verify/.env` | **СЕКРЕТ** |
> | `KEYSTATIC_SECRET` | з `…-panel-setup-verify/.env` | **СЕКРЕТ** (підпис сесії) |
>
> `PANEL_CONTENT_BRANCH` — **не задавати**: на Vercel `VERCEL_GIT_COMMIT_REF`
> для Preview цієї гілки вже = `codex/admin-panel-spike`, і `branch.ts` бере
> його автоматично. (Якщо колись задавати вручну — рівно `codex/admin-panel-spike`,
> **не** `panel/content`.)
>
> Значення 3 секретних/ідентифікатора вставляти **тільки** в поле Value у Vercel
> — не в чат / Git / звіт. Джерело — файл `…-panel-setup-verify/.env` (права 600,
> git-ignored). Асистент прочитає лише **імена** ключів для звірки.
>
> **2. Callback** — у GitHub App `dreamcar-vavd-keystatic` → General →
> «Identifying and authorizing users» → **Add redirect URI** (локальний
> `http://127.0.0.1:3010/api/keystatic/github/oauth/callback` **лишити**):
> `https://dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app/api/keystatic/github/oauth/callback`
> → Save changes.
>
> **3. Redeploy** — Vercel → Deployments → останній для гілки
> `codex/admin-panel-spike` → ⋯ → **Redeploy** (env застосовуються лише до нової
> збірки).
>
> **4. Критерій перевірки (на Preview):**
> `https://dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app/keystatic`
> → «Sign in with GitHub» → Authorize → редактор;
> `…/panel` → дашборд, «Робоча гілка: codex/admin-panel-spike», матеріали
> **3/8/5/1**, банер **«(Preview)»**; потім **Sign out** → `/panel` і чернетка
> недоступні. Далі — повний протокол `docs/PANEL-hosted-verification.md`.
>
> **Увага (Hobby-план):** Preview-деплої за замовчуванням під **Vercel
> Authentication** (бачить лише команда). GitHub-редірект на callback може
> впертися в цей захист — тоді діяти за `docs/PANEL-hosting-and-approvals.md`
> §3.5 (мінімальна зміна за фактичним доказом; глобально захист Preview **не**
> вимикати).
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
