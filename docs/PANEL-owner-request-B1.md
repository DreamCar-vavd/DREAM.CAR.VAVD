# Б1 — GitHub App для hosted-панелі: запит власнику (крок 1)

> Один крок. Не БД, не Blob, не тариф, не приватність репозиторію.
> Повний контекст — `docs/PANEL-hosting-and-approvals.md` §2–§3.
> Протокол перевірки після підключення — `docs/PANEL-hosted-verification.md`.

Значення маніфесту звірені з кодом і **фактично відтворені** локально
2026-09-07 (ізольований `next dev` на loopback-порту, github-режим):
`/keystatic/setup` відкривається, кнопка веде на
`POST https://github.com/settings/apps/new`, тіло маніфесту:

```json
{
  "name": "DreamCar-vavd Keystatic",
  "url": "http://localhost:<порт>/keystatic",
  "public": true,
  "redirect_url": "http://localhost:<порт>/api/keystatic/github/created-app",
  "callback_urls": [
    "http://localhost:<порт>/api/keystatic/github/oauth/callback",
    "http://127.0.0.1/api/keystatic/github/oauth/callback"
  ],
  "request_oauth_on_install": true,
  "default_permissions": { "contents": "write", "metadata": "read", "pull_requests": "read" }
}
```

`<порт>` підставляється автоматично з адреси, з якої відкрито сторінку
(Keystatic бере `window.location.origin`) — тому **вільний порт годиться**,
callback у маніфесті підлаштується сам. App створюється в акаунті власника;
асистент його не створював і дозволів не підтверджував.

---

## ЗАПИТ ДЛЯ ПЕРЕДАЧІ АСИСТЕНТУ

**Потрібна дія:**
Створити GitHub App «DreamCar-vavd Keystatic» **локально на цьому Mac** і
встановити його **лише** на репозиторій `DreamCar-vavd/DREAM.CAR.VAVD`.
Три секрети, які GitHub видасть, — залишити у локальному файлі `.env`
(він у `.gitignore`), нікуди не вставляти. Перенесення секретів у Vercel,
redeploy і hosted-перевірка — **окремий наступний запит**, не зараз.

**Навіщо:**
Hosted-режим панелі (`/panel` + `/keystatic` на Vercel Preview) вмикається лише
коли існує GitHub App: він дає вхід через GitHub і право панелі писати
контент-коміти в гілку. Обробник, що дописує секрети в `.env`, на Vercel падає
(файлова система read-only), тому App створюється саме локально. Зараз на
Preview `/panel` і `/keystatic` віддають 404 — це очікувано.

**Що вже підготовлено:**
- Гілка `codex/admin-panel-spike`, PR #26 (draft) — увесь код панелі готовий,
  CI зелений; `main` (`ce1977af`) не чіпається.
- Сторінка `/keystatic/setup` працює й формує правильний маніфест (звірено вище).
- Шаблон env для локального кроку: `docs/keystatic-app-setup.env`.
- Покрокова інструкція: `docs/PANEL-hosting-and-approvals.md` §3.1.
- `.env.local` у копії немає — наявних локальних налаштувань крок не зачіпає.

**Точне посилання:**
`http://localhost:<порт>/keystatic/setup` на локальному dev-сервері цієї копії
(`/Users/apple/Projects/DREAM.CAR.VAVD-admin-panel-20260906`).
Порядок:
1. У корені копії створити `.env.local` з умістом `docs/keystatic-app-setup.env`:
   ```
   NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github
   KEYSTATIC_GITHUB_REPO_OWNER=DreamCar-vavd
   KEYSTATIC_GITHUB_REPO_NAME=DREAM.CAR.VAVD
   ```
2. Якщо файловий dev-сервер уже зайняв порт 3000 і потрібен далі — не спиняти
   його, а підняти setup на вільному порту:
   `npm run dev -- -p 3100` → відкрити `http://localhost:3100/keystatic/setup`
   (саме `localhost`, не `127.0.0.1`; той самий хост протягом усього входу).
   Якщо порт 3000 вільний — звичайне `npm run dev` і `.../localhost:3000/...`.

**Що власник побачить і натисне:**
Екран «Keystatic Setup» з полями «Deployed App URL» і «GitHub organization» —
**обидва лишити порожніми** (акаунт `DreamCar-vavd` — особистий, не організація;
Deployed App URL додається в App пізніше) — і синьою кнопкою **«Create GitHub
App»**. Кнопка веде на GitHub на екран створення App із уже заповненим
маніфестом → на GitHub натиснути **«Create GitHub App»** → GitHub поверне назад
на локальний сервер, і Keystatic сам допише 3 значення у файл `.env`. Далі на
GitHub: App → **Permissions & events** → додати **Deployments: Read**; **Webhook
→ Active вимкнути**; App → **Install App** → акаунт `DreamCar-vavd` → **Only
select repositories → `DREAM.CAR.VAVD`** → Install.

**Які права погоджує:**
Repository permissions App (лише цей репозиторій):
- **Contents: Read and write** — контент-коміти панелі у гілку;
- **Metadata: Read** — обов'язкове GitHub;
- **Pull requests: Read** — з маніфесту Keystatic;
- **Deployments: Read** — додається вручну, для банера стану збірки в `/panel`.
Більше нічого: без Actions, Secrets, Administration, Workflows, Members.
Webhook вимкнено. Встановлення — тільки на `DREAM.CAR.VAVD`, не org-wide.
Гілки не перейменовувати, окремий домен не потрібен, приватність репозиторію
цим кроком не змінюється, Production і Vercel не зачіпаються.

**Витрати та джерело:**
$0. GitHub App і Actions на приватному репозиторії — безкоштовний тариф GitHub
(2000 хв Actions/міс достатньо). Зміни тарифу Vercel цей крок не потребує
(перегляд джерел трафіку в панелі — окреме рішення, Б5, не тепер).

**Як перевірити результат:**
- GitHub → Settings → Developer settings → **GitHub Apps** — є App
  «DreamCar-vavd Keystatic», Webhook Active off, permissions як вище
  (Contents RW, Metadata R, Pull requests R, Deployments R).
- App → Install App — встановлений на `DreamCar-vavd/DREAM.CAR.VAVD` і більше
  ніде.
- Локальний `.env` містить рядки з іменами `KEYSTATIC_GITHUB_CLIENT_ID`,
  `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` (перевірити **наявність
  імен**, значень не показувати й нікуди не копіювати).
- `git status` у копії — чисто (`.env`, `.env.local` git-ignored).
- `main` (`git log origin/main -1`) — без змін.
Зупинити локальний dev-сервер setup; `.env.local` поки лишити (він потрібен,
якщо доведеться повторити локальний вхід до кроку 2). Наявність секретів у
`.env` — це ще **не** робоча hosted-панель: далі окремий запит (Vercel env для
Preview гілки `codex/admin-panel-spike` + redeploy + протокол
`docs/PANEL-hosted-verification.md`).

**Як відкликати доступ без видалення даних:**
На цьому кроці App нічого не записав і не підключений до Vercel, тож відкликання
безпечне для будь-яких даних:
- GitHub → Developer settings → GitHub Apps → App → **Uninstall** (прибирає
  доступ до репозиторію) або **Delete GitHub App** (повне видалення App).
- Локально видалити `.env.local` і рядки `KEYSTATIC_*` з `.env` (обидва файли
  git-ignored, лежать лише на цьому Mac).
`main`, історія, контент, Production, DNS — не зачіпаються ні створенням App,
ні його видаленням.
