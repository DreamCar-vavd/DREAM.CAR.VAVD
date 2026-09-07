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

| Пункт | Значення | Звідки |
|---|---|---|
| **Тип інтеграції** | **GitHub App** (не OAuth App). Keystatic створює його сам через App-manifest flow: у `/keystatic` кнопка «Create GitHub App» → GitHub повертає `client_id` / `client_secret` / App id. | `@keystatic/core` `github/created-app` → `api.github.com/app-manifests/{code}/conversions` |
| **Рекомендована тестова адреса** | Поточний Preview-домен гілки: `https://dreamcarvavd-<hash>-6y7h9wdz4r-7375s-projects.vercel.app`. Він **стабільний для гілки** — переіменування гілки або новий піддомен **не потрібні** (технічний доказ: Keystatic будує `redirect_uri` як `${reqUrl.origin}/api/keystatic/github/oauth/callback` з поточного запиту — працює на будь-якому домені, що є в списку Callback URLs App). Для першого тесту зручніший **стабільніший** аліас Vercel `dream.car.vavd-git-<branch>-<team>.vercel.app`, якщо він увімкнений у проєкті. | `keystatic-core-api-generic…redirect_uri` |
| **Фактичний callback path** | `/api/keystatic/github/oauth/callback` — додати як Callback URL повний(і) URL: `https://<preview-домен>/api/keystatic/github/oauth/callback`, а для локальної розробки ще `http://127.0.0.1:3000/api/keystatic/github/oauth/callback`. | код вище |
| **Homepage URL App** | будь-який робочий, напр. `https://dream-car-vavd.com`. | — |
| **Дозволи App (repository permissions)** | **Contents: Read and write** (комміти контенту), **Pull requests: Read and write** (Keystatic вміє відкривати PR), **Deployments: Read** (банер стану збірки в `/panel`), **Metadata: Read** (обов'язково). Більше нічого — без Actions, Secrets, Administration, Workflows. | `deployStatus()` у `store/github.ts`; Keystatic PR-режим |
| **Where installed** | **Only select repositories → `DreamCar-vavd/DREAM.CAR.VAVD`**. Не org-wide. | — |
| **Env (де задавати)** | **Vercel → Project → Settings → Environment Variables**, середовища **Preview** (для тесту) і потім Production: `KEYSTATIC_STORAGE_KIND=github`, `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` (будь-який довгий випадковий рядок, напр. `openssl rand -hex 32`), `KEYSTATIC_GITHUB_REPO_OWNER=DreamCar-vavd`, `KEYSTATIC_GITHUB_REPO_NAME=DREAM.CAR.VAVD`. Необов'язково `PANEL_CONTENT_BRANCH=panel/content`. **Ніколи не в репозиторії, ніколи не в чат.** | `.env.example`, `keystatic.config.ts` |
| **Звідки власник бере кожне значення** | `CLIENT_ID` / `CLIENT_SECRET` — GitHub показує **один раз** одразу після «Create GitHub App» (Keystatic виведе їх на екран `/keystatic` — скопіювати у Vercel). `KEYSTATIC_SECRET` — власник генерує сам. Owner/Repo — вже відомі. | — |
| **Як перевірити вхід (2 користувачі)** | Після встановлення env на Preview: власник відкриває `https://<preview>/keystatic` → «Sign in with GitHub» → погоджує App → бачить колекції. Потім помічник (окремий GitHub-акаунт, роль **Write** на репозиторії) робить те саме у своєму браузері. Обидва редагують різні картки, кожен публікує свою у `/panel` — вони **не** бачать чужих неопублікованих змін у знімку. | — |
| **Як відкликати доступ** | Помічнику: GitHub → Repo → Settings → Collaborators → Remove. Або самому користувачу: GitHub → Settings → Applications → Authorized GitHub Apps → Revoke. Наступний рендер `/panel` / чернетки одразу перестає працювати для нього (сесія перевіряється щоразу — `report/37`). Повністю: видалити App у Settings → Developer settings. | `siteContent.ts` re-check |
| **Платні функції** | **Не потрібні.** GitHub App + Actions на приватному репозиторії — у безкоштовному тарифі (Actions: 2000 хв/міс для private, цього процесу вистачає з запасом). Vercel: 1 користувач у Hobby; **другому реальному Vercel-акаунту** для панелі місця немає лише якщо потрібен доступ до самого Vercel-дашборда — для роботи в `/keystatic` Vercel-акаунт помічнику **не потрібен** (він автентифікується через GitHub). |

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

## 3. Одна конкретна наступна дія власника

Створити GitHub App через `/keystatic` на **Preview**-деплої гілки
`codex/admin-panel-spike` (кнопка «Create GitHub App» з'явиться, щойно на цьому
деплої буде виставлено `KEYSTATIC_STORAGE_KIND=github` + `KEYSTATIC_SECRET` у
Vercel Preview env), потім вставити видані `CLIENT_ID` / `CLIENT_SECRET` у ті
самі Preview env і ще раз відкрити `/keystatic` — це дає робочий hosted-логін
для перевірки двох користувачів, без зміни Production, DNS, гілок чи тарифів.
