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
for your request.»**, а в консолі — попередження React про `value` без
`onChange` на службовому `input[name="manifest"]`.

**Перевірено (не припущення):**

- **Попередження React — НЕ причина.** У браузері `new FormData(form).get("manifest")`
  повертає повний валідний JSON (409 символів), `input.readOnly === false`,
  `input.disabled === false`, форма — `POST` `application/x-www-form-urlencoded`
  на `https://github.com/settings/apps/new`. Read-only поле все одно
  відправляється. Попередження походить із зібраного `keystatic-core-ui.js`
  (вендорний код) — косметичне, `node_modules` не патчимо, перевірки не
  вимикаємо.
- **Маніфест доходить до GitHub і приймається.** Відтворення тим самим тілом
  (`curl -X POST … --data-urlencode "manifest=<json>"`) → GitHub відповідає
  `302 → https://github.com/settings/apps/manifest` і ставить cookie
  `app_manifest_token=…` з **терміном життя ~5 хвилин** (`expires` через 5 хв,
  `HttpOnly; SameSite=Lax`). Помилкової сторінки немає — маніфест прийнято.
- **Сторінка підтвердження вимагає входу.** `GET /settings/apps/manifest` без
  активної сесії GitHub → `302 → /login?return_to=/settings/apps/manifest`.

**Підтверджена причина:** GitHub тримає надісланий маніфест на своєму боці за
короткоживучим cookie `app_manifest_token` (~5 хв). Якщо власник **не був
залогінений** у GitHub у тому самому браузері, ланцюг «POST → редірект на
логін → пароль → 2FA/SSO/passkey → назад» перевищує 5 хвилин, cookie згасає, і
`/settings/apps/manifest` каже «We didn't find an App Manifest for your
request». (Окремий 1-годинний ліміт із доків GitHub — це вже `code` на кроці
`redirect_url` → `/app-manifests/{code}/conversions`, інша річ.)

**Мінімальне усунення:** увійти в GitHub у цьому браузері **до** відкриття
setup-сторінки й пройти екран GitHub швидко (значно менше 5 хв). Тоді
POST одразу відкриває заповнену сторінку без гаку на логін. Провалена спроба
**нічого не створює** — можна просто перезавантажити setup і клікнути ще раз
(новий маніфест, новий 5-хв cookie), дублікатів не буде.
Якщо не спрацює й із входом наперед — детермінований запасний шлях без
manifest-flow: §«Запасний шлях» нижче.

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
App URL додається в App пізніше). У консолі буде косметичне попередження React
про `manifest` — його **ігнорувати** (див. «Діагностика» вище).

**Що натиснути:**
0. **Спершу відкрити `https://github.com` у ЦЬОМУ ж браузері й переконатися, що
   вхід виконано** (видно свій аватар). Це головне — інакше 5-хвилинний cookie
   маніфесту згасне на екрані логіна.
1. Тоді відкрити `http://127.0.0.1:3010/keystatic/setup` → **«Create GitHub App»**
   → відкриється сторінка GitHub «Register new GitHub App» із заповненими назвою
   `DreamCar-vavd Keystatic`, callback і правами `contents: write`,
   `metadata: read`, `pull_requests: read`. **Пройти її швидко** (< 5 хв).
   Якщо натомість «We didn't find an App Manifest…» — повернутись на
   `http://127.0.0.1:3010/keystatic/setup`, перезавантажити, клікнути ще раз
   (нічого не створилось, дубля не буде). Двічі поспіль не вийшло → «Запасний
   шлях» нижче.
2. На GitHub — кнопка **«Create GitHub App»**. GitHub поверне на
   `http://127.0.0.1:3010/api/keystatic/github/created-app`, і Keystatic
   **сам** допише 3 значення у файл
   `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify/.env`.
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

## Запасний шлях: створити App вручну (без manifest-flow)

Якщо manifest-flow падає навіть із входом наперед (агресивне блокування cookie
тощо). Тут немає 5-хвилинного вікна.

1. GitHub (залогінений) → Settings → Developer settings → GitHub Apps →
   **New GitHub App**. Заповнити:
   - **GitHub App name:** `DreamCar-vavd Keystatic` (якщо зайнято — додати
     суфікс, напр. `DreamCar-vavd Keystatic Panel`; тоді те саме ім'я
     використати далі).
   - **Homepage URL:** `http://127.0.0.1:3010/keystatic` (будь-який валідний
     годиться).
   - **Callback URL:** `http://127.0.0.1:3010/api/keystatic/github/oauth/callback`
   - **Request user authorization (OAuth) during installation:** ✅ увімкнути.
   - **Webhook → Active:** ✖ **вимкнути** (URL не потрібен).
   - **Repository permissions:** Contents = **Read and write**;
     Metadata = **Read-only** (стане автоматично); Pull requests = **Read-only**;
     Deployments = **Read-only**. Більше нічого.
   - **Where can this GitHub App be installed?** → **Only on this account**.
   - **Create GitHub App**.
2. На сторінці App: скопіювати **Client ID**; натиснути **Generate a new client
   secret** → скопіювати секрет (показується один раз).
3. У терміналі згенерувати `KEYSTATIC_SECRET`:
   `openssl rand -hex 32`
4. Створити файл `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify/.env`
   (git-ignored, **не** комітити) з трьома рядками — значення вставити **у файл**,
   не в чат:
   ```
   KEYSTATIC_GITHUB_CLIENT_ID=<Client ID>
   KEYSTATIC_GITHUB_CLIENT_SECRET=<client secret з кроку 2>
   KEYSTATIC_SECRET=<вивід openssl з кроку 3>
   ```
   (`.env.local` із 3 несекретними рядками вже є — його не чіпати.)
5. App → **Install App** → акаунт `DreamCar-vavd` → **Only select repositories**
   → `DREAM.CAR.VAVD` → **Install**.
6. Перезапустити підготовлений сервер, щоб він підхопив `.env`
   (`kill <pid>` конкретного `next dev`, тоді знову
   `npx next dev --webpack -H 127.0.0.1 -p 3010` з тієї копії). Успішний
   результат — той самий, що вище.

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
