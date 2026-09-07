# Панель: підключення (OAuth) і схема погодження публікації

Доповнює `docs/PANEL.md`. Дві теми, які раніше були описані неточно:

1. **Успішний check ≠ обов'язковий approving review.** Це два різні механізми
   GitHub. Нижче — точна схема, хто що робить.
2. **Картка підключення hosted-логіну** — усі значення, зібрані з коду.

Джерела GitHub (перевірено, вересень 2026):
[About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches),
[Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
[Creating rulesets for a repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).

---

## 1. Публікація контенту: check і review — це різні речі

### 1.1. Два незалежні правила захисту гілки

| Правило (ruleset / branch protection) | Що робить | Чи замінює інше |
|---|---|---|
| **Require a pull request before merging** | будь-яка зміна `main` — лише через PR | — |
| **Require approvals** (N ≥ 1) | PR не змержити, доки N користувачів із правом Write не поставлять **Approve** у вкладці Reviewers | **ні** — це людське рішення |
| **Require status checks to pass** (`Verify`) | PR не змержити, доки перелічені checks не `success`/`neutral`/`skipped` | **ні** — це автомат |
| **Require approval of the most recent reviewable push** | Approve має поставити **не той**, хто зробив останній push | закриває самопогодження |

**Зелений `Verify` (чи `content-guard`) — це "тести пройшли", а не "PR погоджено".**
GitHub рахує їх окремо: PR може мати всі зелені checks і все одно бути
незмерджуваним, бо бракує approving review, і навпаки.

### 1.2. Звичайні code-PR — без змін

`main` захищений ruleset-ом: **PR + `Verify` (green) + 1 approving review + гілка
актуальна**. Помічник (роль **Write**) створює гілку й PR; змерджити його може
лише власник, поставивши Approve. Жоден код не потрапляє в `main` без ока
власника. Цей PR (#26) іде саме цим шляхом.

### 1.3. Контент-публікація — окремий, вужчий шлях

Мета: власник у `/panel` натискає «Опублікувати», і оновлений
`published.json` + `review-state.json` + нові медіа потрапляють у `main`
**без того, щоб власник щоразу відкривав GitHub і робив Approve** — але й **без
можливості протягнути цим шляхом довільний код**.

| Питання | Відповідь |
|---|---|
| Хто створює контент-PR / push | Панель: `/panel` → адаптер пише файли на **гілку контенту** (`PANEL_CONTENT_BRANCH`, напр. `panel/content`) через GitHub API під токеном **того, хто ввійшов** (власник або помічник). |
| Який check перевіряє дані | Workflow `content-guard.yml` (з `main`): на `push` у гілку контенту робить `git merge-base`, `git diff base..push` і **валить**, якщо diff торкається будь-чого, крім `src/content/cms/published.json`, `src/content/cms/review-state.json`, `public/images/cms/**`; далі запускає `npm run content:guard` (**checkout `main`**, дані з гілки читаються лише через `git show <sha>:file`, скрипти гілки не виконуються) — структура знімка, обов'язкові мови, review-хеші, тип і розмір медіа (magic bytes). |
| Хто/що виконує «злиття» в `main` | Той самий workflow: якщо обидві перевірки пройшли — `git checkout <sha> -- <рівно файли з маніфесту>` і `git push` у `main`. Це **fast-forward контенту**, не GitHub-merge PR. |
| Які права потрібні автоматизації | Actor цього workflow (GitHub App **або** вбудований `github-actions[bot]`) має бути **у Bypass list цього ruleset** — тоді його push у `main` не блокується правилами PR/approvals/checks. `permissions:` у workflow — лише `contents: write`. Доступу до Actions/Secrets/Admin/rulesets він не має. |
| Чому цим шляхом не проходить довільний код | Bypass дозволено **тільки** для гілки контенту і **тільки** після кроку «diff = дозволений allowlist». Будь-який `.ts`/`.js`/`.yml`/`package.json` у diff → workflow падає, push у `main` не робиться. Сам `content-guard.yml` живе в `main`; змінити його = звичайний code-PR (п.1.2). Гілка контенту свою копію workflow **не запускає** (спрацьовує копія з `main` на подію `push`). |
| Самопогодження / небезпечний bypass | Тут немає approving review взагалі — тому немає й «сам собі Approve». Захист — не review, а **машинний allowlist + checkout з `main`**. Bypass list містить **лише** actor автоматизації, не людей. |

### 1.4. Bootstrap: код guard ще не в `main`

`content-guard.yml` зараз лежить у `.github/workflows-proposed/` (push-токен
сесії не має scope `workflow`, тож у `.github/workflows/` його не додати
автоматично — і це правильно). Поки його немає в `main`:

- **шлях 1.3 не існує**; публікація контенту = помічник відкриває звичайний PR
  зі зміненим `published.json`, власник дивиться diff і **Approve + Merge**
  (це review у сенсі п.1.1 — людське рішення);
- активувати шлях 1.3 = один звичайний code-PR, який додає
  `.github/workflows/content-guard.yml` (вміст — з `workflows-proposed/`), і
  налаштування ruleset (нижче). Обидва — **рішення й дії власника**; помічник
  їх не робить.

### 1.5. Що саме має налаштувати власник для шляху 1.3

1. Змержити code-PR, що переносить `content-guard.yml` у `.github/workflows/`.
2. Repo → Settings → Rules → Rulesets → гілка `main`:
   - Require a pull request before merging → Required approvals: **1**;
   - Require status checks: **`Verify`** (і, за бажанням, `content-guard`);
   - Require approval of the most recent reviewable push: **on**;
   - **Bypass list**: додати actor автоматизації (App або `github-actions`) —
     **тільки його**.
3. Перевірити: у `/panel` опублікувати дрібну зміну → у гілці `panel/content`
   з'явився коміт → `content-guard` зелений → у `main` фаст-форвардом лише
   2 JSON (+ медіа) → Vercel зібрав. Спробувати вручну додати у гілку контенту
   зміну `.ts` → `content-guard` **падає**, `main` не змінюється.

---

## 2. Картка підключення hosted-логіну (Keystatic github-режим)

Усе нижче — з коду (`@keystatic/core` 0.6.9, `keystatic.config.ts`,
`src/lib/keystaticEnabled.ts`, `src/lib/content/store/*`).

| Пункт | Значення | Звідки (перевірено з `@keystatic/core@0.6.9`) |
|---|---|---|
| **Тип інтеграції** | **GitHub App** (не OAuth App). Keystatic допомагає створити його через App-manifest flow (кнопка «Create GitHub App» у `/keystatic`), або власник створює App вручну: GitHub → Settings → Developer settings → GitHub Apps → New. | `github/created-app` → `POST api.github.com/app-manifests/{code}/conversions` |
| **⚠️ Де запускати «Create GitHub App»** | **Локально (`next dev`), НЕ на Vercel Preview.** Обробник Keystatic після створення App робить `fs.writeFile('.env', …)` — на Vercel файлова система read-only, тож на Preview цей крок падає з 500 і видані значення губляться. Правильний порядок: локально з `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github` + `KEYSTATIC_GITHUB_REPO_OWNER/NAME` у `.env.local` → `/keystatic` → «Create GitHub App» → Keystatic **сам** дописує `KEYSTATIC_GITHUB_CLIENT_ID` / `_SECRET` / `KEYSTATIC_SECRET` (80 hex-символів) у локальний `.env` → скопіювати ці 3 значення у **Vercel env**. Або створити App вручну в GitHub UI й згенерувати `KEYSTATIC_SECRET` самому. | `keystatic-core-api-generic.node.react-server.js` рядки 78–90 |
| **Тестова адреса** | Поточний Preview-домен гілки: `https://dreamcarvavd-<hash>-…vercel.app`. **Стабільний для гілки** — переіменування гілки чи новий піддомен **не потрібні**: Keystatic будує `redirect_uri` як `${reqUrl.origin}/api/keystatic/github/oauth/callback` з поточного запиту, тож працює на будь-якому домені зі списку Callback URLs App. Кожен новий Preview-хеш — це новий домен, тож зручніше додати в App **wildcard** callback або стабільний branch-аліас `…-git-<branch>-<team>.vercel.app`. | `redirect_uri` у коді |
| **Callback URL(и) App** | `/api/keystatic/github/oauth/callback`. Додати повні URL: `https://<preview>/api/keystatic/github/oauth/callback` (+ стабільний branch-аліас, якщо є) і для локальної розробки `http://127.0.0.1:3000/api/keystatic/github/oauth/callback`. | код |
| **Homepage URL App** | будь-який робочий, напр. `https://dream-car-vavd.com`. | — |
| **Дозволи App (repository permissions)** | **Contents: Read and write**, **Pull requests: Read and write**, **Deployments: Read**, **Metadata: Read** (обов'язково). Більше нічого — без Actions, Secrets, Administration, Workflows, Members. | `deployStatus()`; Keystatic PR-режим |
| **Webhook** | **Вимкнути** (Active — off). Keystatic вебхук не використовує. | — |
| **Where installed** | **Only select repositories → `DreamCar-vavd/DREAM.CAR.VAVD`**. Не «All repositories», не org-wide. | — |
| **Env (точні назви, де задавати)** | **Vercel → Project → Settings → Environment Variables**, спершу **Preview**, потім Production: `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github`; `KEYSTATIC_GITHUB_CLIENT_ID`; `KEYSTATIC_GITHUB_CLIENT_SECRET`; `KEYSTATIC_SECRET` — **рядок ≥ 32 символи** (Keystatic кидає помилку, якщо коротший; його власний генератор дає 80 hex — `openssl rand -hex 32` теж годиться); `KEYSTATIC_GITHUB_REPO_OWNER=DreamCar-vavd`; `KEYSTATIC_GITHUB_REPO_NAME=DREAM.CAR.VAVD`. Необов'язково `PANEL_CONTENT_BRANCH=panel/content` (без нього — гілка деплою `VERCEL_GIT_COMMIT_REF`, ніколи не `main` на Preview). Скорочені імена (`CLIENT_ID` тощо) код **не** читає. | `keystatic-core-api-generic.js` рядки 74–76, 28; `store/index.ts` |
| **Обмеження Preview env гілкою** | Vercel env для «Preview» застосовується до **всіх** preview-гілок. Щоб тільки ця гілка: у полі змінної Vercel вибрати **Preview → Specific Branches → `codex/admin-panel-spike`**. | Vercel env UI |
| **Повторний deployment після env** | **Так, обов'язково.** Vercel не застосовує нові env до вже зібраного деплою — після додавання значень зробити Redeploy гілки (Deployments → ⋯ → Redeploy) або новий push. | Vercel |
| **Повернення після OAuth** | `/api/keystatic/github/oauth/callback` ставить cookie сесії й редіректить назад на сторінку, з якої почався вхід (Keystatic зберігає `from` у підписаному cookie `ks-<state>`). Токен GitHub — у cookie `keystatic-gh-access-token` (не httpOnly, бо його читає і панель). | код callback |
| **Звідки власник бере кожне значення** | `CLIENT_ID` / `CLIENT_SECRET` / `KEYSTATIC_SECRET` — з локального `.env`, куди їх дописав Keystatic після «Create GitHub App» (крок вище), або: `CLIENT_ID`/`SECRET` з GitHub App settings, `KEYSTATIC_SECRET` — `openssl rand -hex 32`. Owner/Repo — вже відомі. **Значення — лише в Vercel env, не в Git, не в чат, не в звіт.** | — |
| **Безпека початкового налаштування** | Поки на Preview стоїть `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github` + `KEYSTATIC_SECRET`, але ще немає `CLIENT_ID`, `/keystatic` показує кнопку «Create GitHub App» будь-кому, хто відкриє Preview. Сторонній не отримає доступу до репо (App створиться в **його** акаунті й не буде встановлений на репозиторій; на Vercel крок ще й падає 500), але це зайвий шум. **Рекомендація:** на час налаштування увімкнути Vercel **Deployment Protection → Vercel Authentication** для Preview, або робити «Create GitHub App» **локально** (варіант вище). Після того, як усі env задані й App встановлений, кнопки більше немає. | `keystaticEnabled`, `localModeApiHandler` 404 |
| **Перевірка входу (2 користувачі)** | **Не обіцяється до фактичного прогону.** Після env + redeploy: власник → `https://<preview>/keystatic` → «Sign in with GitHub» → Authorize → бачить колекції та `/panel`. Потім помічник (окремий GitHub-акаунт, роль **Write** на репо) — те саме у своєму браузері. Протокол повного прогону — `docs/PANEL-hosted-verification.md`. | — |
| **Відкликання доступу** | Помічнику: GitHub → Repo → Settings → Collaborators → Remove **або** користувач сам: GitHub → Settings → Applications → Authorized GitHub Apps → `<App>` → Revoke. Наступний рендер `/panel` / чернетки одразу недоступний (сесія перевіряється щоразу). Повне вимкнення: видалити App у Developer settings. | `siteContent.ts` re-check |
| **Платні функції** | **Не потрібні для панелі.** GitHub App + Actions на приватному репо — безкоштовний тариф (Actions 2000 хв/міс private). Vercel: `/keystatic` не потребує Vercel-акаунта помічнику (він входить через GitHub). Окремо: **Vercel Web Analytics API** (джерела трафіку в панелі, §нижче) — потребує **Pro** ($20/міс) + Access Token; сама панель від цього не залежить. |

### 2.1. Доступ помічника — три різні речі

| До чого | Що потрібно | Що НЕ потрібно |
|---|---|---|
| **Панель `/keystatic` + `/panel`** | GitHub-акаунт + роль **Write** на репозиторії + одноразове погодження App при першому вході | Vercel-акаунт, Admin |
| **GitHub-контент** (комміти в гілку контенту) | та сама роль **Write** — Keystatic комітить під його токеном | scope `workflow`, доступ до Settings/Secrets |
| **Захищений Preview** | якщо на Vercel-проєкті увімкнено Deployment Protection — помічник відкриває Preview або через **share-link** (генерує власник), або йому дають Vercel-доступ рівня **Member** тільки для перегляду. Якщо захист Preview вимкнено — нічого. | повний Vercel-доступ |

### 2.2. Приватність репозиторію — одна рекомендація

**Зробити репозиторій приватним перед підключенням помічника.** Наслідки:
GitHub Pages з цього репо немає (не використовується); Actions на private —
2000 безкоштовних хвилин/міс (достатньо); клонувати й бачити код зможуть лише
запрошені співавтори. Мінус: втрата публічної видимості історії — для маркетингового
сайту це не потрібно. **Не** робити приватним лише заради косметики — але тут
причина реальна: у гілці контенту й у майбутньому в заявках можуть бути
персональні дані клієнтів, а публічний репозиторій індексувати їх не має.

Реальні приватні матеріали (фото клієнтів, заявки) **не завантажувати**, доки
репозиторій публічний і доки не ухвалено це рішення.

---

## 3. Покрокова інструкція власнику (hosted-логін для Preview)

Порядок важливий. Production, DNS, гілки, тарифи, **Vercel Deployment
Protection** — на цьому кроці **не** чіпаються (питання захисту Preview — §3.5,
окремо, після створення App).
**Перевірено наживо на цьому Mac** (2026-09-07): у підготовленій ізольованій
копії сторінка `/keystatic/setup` відкривається, кнопка веде на
`POST github.com/settings/apps/new`, маніфест сформовано правильно. App не
створювався, дозволи не підтверджувались.

### 3.1. Локально створити App (не на Vercel — там FS read-only, крок падає 500)

**Асистент уже підготував це середовище** (див. `docs/PANEL-owner-request-B1.md`):
окремий `git worktree` `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify`
з `.env.local` (3 несекретні рядки) і запущеним `next dev` на
`http://127.0.0.1:3010`. Власнику достатньо кроків 2–6. Якщо середовище треба
відтворити з нуля:

1. У корені ізольованої копії створити **`.env.local`** (у `.gitignore`) з
   умістом `docs/keystatic-app-setup.env`:
   ```
   NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github
   KEYSTATIC_GITHUB_REPO_OWNER=DreamCar-vavd
   KEYSTATIC_GITHUB_REPO_NAME=DREAM.CAR.VAVD
   ```
   і підняти `npx next dev -H 127.0.0.1 -p <вільний-порт>` (loopback).
2. Відкрити **`http://127.0.0.1:3010/keystatic/setup`** (той самий хост і порт
   протягом усього входу — не чергувати `127.0.0.1` і `localhost`). Екран
   **«Keystatic Setup»** із полями «Deployed App URL», «GitHub organization»
   і кнопкою **«Create GitHub App»**.
3. Поля лишити **порожніми** (акаунт `DreamCar-vavd` — це користувач, не
   організація; Deployed App URL можна додати в App пізніше) → натиснути
   **«Create GitHub App»**. Форма робить `POST https://github.com/settings/apps/new`
   з готовим маніфестом (name `DreamCar-vavd Keystatic`, callback
   `http://127.0.0.1:3010/api/keystatic/github/oauth/callback` +
   `http://127.0.0.1/api/keystatic/github/oauth/callback`, permissions
   `contents: write`, `metadata: read`, `pull_requests: read`).
4. На GitHub натиснути **Create GitHub App** → GitHub редіректить назад на
   `http://127.0.0.1:3010/api/keystatic/github/created-app`, і Keystatic
   **сам дописує** у файл **`.env`** цієї копії (не `.env.local`;
   CWD dev-сервера) три значення: `KEYSTATIC_GITHUB_CLIENT_ID`,
   `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`. **Це секрети** —
   у підготовленому середовищі це
   `/Users/apple/Projects/DREAM.CAR.VAVD-panel-setup-verify/.env`.
5. GitHub → Settings → Developer settings → GitHub Apps → `<новий App>` →
   **Permissions & events**: додати **Deployments: Read** (маніфест Keystatic
   його не просить, а банер стану збірки в `/panel` його потребує; без нього
   банер показуватиме «стан невідомий» — не критично). Webhook → **Active off**.
6. Той самий App → **Install App** → акаунт `DreamCar-vavd` → **Only select
   repositories** → `DREAM.CAR.VAVD` → Install.
7. Зупинити підготовлений dev-сервер конкретним процесом (`kill <pid>` того
   самого `next dev`, не за широким шаблоном). **`.env.local` і `.env` не
   видаляти** — `.env` тримає єдину копію секретів до перенесення у Vercel, а
   `.env.local` (3 несекретні рядки) потрібен для повторного локального входу.
   Ця копія — окремий worktree, тож `.env.local` у ній не заважає ні основній
   копії, ні `npm run build` десь інде. Прибрати worktree разом з `.env` можна
   **лише** після кроку 3.2 і успішної hosted-перевірки (§3.4).

### 3.2. Vercel env (лише Preview потрібної гілки)

**Vercel → Project `dream.car.vavd` → Settings → Environment Variables.** Для
кожної: Environment = **Preview**, і в Advanced обрати **Specific Git Branches
→ `codex/admin-panel-spike`** (щоб не зачепити інші preview-гілки):

| Змінна | Значення | Секрет? |
|---|---|---|
| `NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND` | `github` | ні |
| `KEYSTATIC_GITHUB_REPO_OWNER` | `DreamCar-vavd` | ні |
| `KEYSTATIC_GITHUB_REPO_NAME` | `DREAM.CAR.VAVD` | ні |
| `KEYSTATIC_GITHUB_CLIENT_ID` | з локального `.env` | **так** |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | з локального `.env` | **так** |
| `KEYSTATIC_SECRET` | з локального `.env` (80 hex) | **так** |
| `PANEL_CONTENT_BRANCH` *(необов'язково)* | `panel/content` | ні |

Секрети вставляти **лише в поле Value у Vercel**, не в чат / Git / звіт.

### 3.3. Callback після redeploy (проблема адреси, що змінюється)

Кожен деплой має **унікальний** URL `dreamcarvavd-<hash>-…vercel.app`, але у
Vercel є **стабільний branch-аліас** виду
`dreamcarvavd-git-codex-admin-panel-spike-<scope>.vercel.app` (точний рядок —
у Vercel → Project → Deployments, поряд із гілкою, або Settings → Domains;
**не вигадувати**, скопіювати звідти). Keystatic будує `redirect_uri` як
`${origin}/api/keystatic/github/oauth/callback`, тож:

- **відкривати `/keystatic` треба саме через branch-аліас**, не через
  per-deployment хеш-URL — тоді `redirect_uri` завжди той самий і стабільний;
- у GitHub App → **Callback URLs** додати рівно два рядки:
  `https://<branch-аліас>/api/keystatic/github/oauth/callback` і
  `http://localhost:3000/api/keystatic/github/oauth/callback` (для локалі).
- GitHub App приймає **кілька** Callback URLs і їх можна редагувати будь-коли —
  переіменування гілки чи новий піддомен **не потрібні**.

Захист Preview на цей крок (створення App локально) **не впливає** —
локальний вхід іде на `127.0.0.1`, не на Vercel. Взаємодія hosted-OAuth із
Vercel Deployment Protection — окремо, §3.5, і лише якщо реальна перевірка
покаже проблему.

### 3.4. Redeploy і перевірка

8. Vercel → Deployments → останній деплой гілки → ⋯ → **Redeploy**
   (env застосовуються лише до нової збірки).
9. Відкрити `https://<branch-аліас>/keystatic` → **Sign in with GitHub** →
   Authorize. Має відкритися список колекцій; `/panel` — дашборд.

**Додавання env НЕ гарантує роботу.** Після цього — реальна перевірка входу,
збереження й прав за протоколом `docs/PANEL-hosted-verification.md` (вхід двох
користувачів, відмова сторонньому, публікація за SHA, конфлікт, відкликання).

**Після підготовки — окреме погодження на конкретне підключення.**

### 3.5. Hosted-вхід і захист Preview (оцінювати окремо, після створення App)

**Не робити наперед.** Тільки якщо крок 3.4 (реальний вхід на branch-аліасі)
покаже, що редірект GitHub на `/api/keystatic/github/oauth/callback` не
завершується:

1. Спершу зібрати доказ: який саме крок падає (URL, код відповіді, чи дійшов
   `?code=` до callback, чи це саме Vercel-challenge, а не помилка App).
2. Мінімальна зміна під конкретну причину, у такому порядку переваги:
   - додати branch-аліас у **Protection Bypass for Automation** / OPTIONS
     allowlist, якщо проблема лише в OAuth-редіректі;
   - або тимчасове звуження захисту саме для цього branch-аліаса на час
     перевірки, з поверненням одразу після;
   - глобально Deployment Protection для Preview **не** вимикати.
3. Зафіксувати в `docs/PANEL-hosted-verification.md`, що саме змінювали й що
   повернули.

Production і його захист — не чіпати за жодного зі сценаріїв.

---

## 4. Джерела трафіку — рішення власника

**Що вже підключено:** Vercel **Web Analytics** + **Speed Insights**
(`src/app/[locale]/layout.tsx`), розкрито в Політиці конфіденційності та
Cookies, **без аналітичних cookie**.

**Які дані збираються:** перегляди, відвідувачі, маршрут, **referrer
(`referrerHostname`)**, **UTM-мітки** (`utmSource`/`utmMedium`/…), країна,
пристрій, браузер, ОС — агреговано й анонімно. Тобто **джерела відвідувань уже
фіксуються** (referrer + UTM). Speed Insights — це Core Web Vitals, **не**
джерела трафіку; не змішувати.

**Підтримуваний спосіб показати в панелі:** офіційний Web Analytics REST API
(публічний із травня 2026):
`GET https://api.vercel.com/v1/query/web-analytics/visits/count?projectId=…&since=…&until=…&filter=…`
з групуванням за `referrerHostname` / `utmSource`. Потрібен **Bearer
Vercel Access Token** в env і, судячи зі схеми відповіді (код `402`), **тариф
Pro** ($20/міс) — поточний проєкт на Hobby.

**Обмеження:** вбудований перегляд у `/panel` = Pro + Access Token. Нових
трекерів або cookie це **не** потребує (дані вже є).

**Рекомендація (рішення власника):**
- **Найпростіше зараз:** користуватися вкладкою **Analytics** у дашборді Vercel
  (там є фільтр за referrer / UTM). Це зовнішній дашборд, **не** вбудована
  статистика панелі.
- **Якщо потрібен перегляд усередині `/panel`:** перейти на Vercel **Pro**,
  створити Access Token, додати env `VERCEL_ANALYTICS_TOKEN` — тоді можна
  зробити read-only сторінку `/panel/traffic`, що раз на годину тягне з API
  топ-referrer'ів. Обсяг — окремий невеликий етап **після** рішення про тариф.

Джерел трафіку в панелі зараз **немає** і це не називається реалізованим.

Джерела GitHub / Vercel (перевірено, вересень 2026):
[Web Analytics API](https://vercel.com/changelog/web-analytics-api),
[Counts page views (REST)](https://vercel.com/docs/rest-api/web-analytics/counts-page-views).
