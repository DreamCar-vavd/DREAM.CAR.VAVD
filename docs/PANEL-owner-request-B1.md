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

**Що власник побачить:**
Екран **«Keystatic Setup»** з двома полями — «Deployed App URL» і «GitHub
organization (if any)» — і синьою кнопкою **«Create GitHub App»**. Обидва поля
**лишити порожніми** (акаунт `DreamCar-vavd` особистий, не організація; Deployed
App URL додається в App пізніше).

**Що натиснути:**
1. **«Create GitHub App»** на цій сторінці → відкриється сторінка GitHub
   «Register new GitHub App» із заповненими назвою `DreamCar-vavd Keystatic`,
   callback і правами `contents: write`, `metadata: read`, `pull_requests: read`.
2. На GitHub — кнопка **«Create GitHub App»**. GitHub поверне на
   `http://127.0.0.1:3010/api/keystatic/github/created-app`, і Keystatic
   **сам** допише 3 значення у файл `.env` цієї копії.
3. GitHub → Settings → Developer settings → GitHub Apps → новий App →
   **Permissions & events**: додати **Deployments → Read-only** → Save.
4. Той самий App → **General**: переконатися, що **Webhook → Active** знято.
5. Той самий App → **Install App** → акаунт `DreamCar-vavd` → **Only select
   repositories** → вибрати **`DREAM.CAR.VAVD`** → **Install**.

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
Одним рядком: «App створено в акаунті DreamCar-vavd, встановлено лише на
DREAM.CAR.VAVD, права Contents RW / Metadata R / Deployments R / Pull requests R,
Webhook off, у `.env` є 3 імені `KEYSTATIC_*`». **Значень не надсилати.**
Якщо повернення на `http://127.0.0.1:3010/...` не спрацювало — спершу перевірити
GitHub → Developer settings → GitHub Apps, чи App уже створено (щоб не робити
дубль), і повідомити стан.

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
