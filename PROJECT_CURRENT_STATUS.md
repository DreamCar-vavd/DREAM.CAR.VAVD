# DREAM.CAR.VAVD — актуальний стан проєкту

Останнє оновлення: **2026-09-03**
Основна робоча копія: **`/Users/apple/Projects/DREAM.CAR.VAVD`**
Поточна контрольна точка: **`4588d691ab312966d9068925e8ea5b994f0f0fd8`** (squash-коміт
PR #15, `perf: reduce hero image transfer size`, злито `2026-09-03T21:06:16Z`).
Хронологію продуктових, перформанс та observability-етапів після PR #5
(PR #8–#15) див. розділ 16; зовнішній стан домену й Google Search Console —
розділ 17; favicon у Google — розділ 18; впорядкований backlog A–E — розділ 19.

## Призначення цього файла

Це головне джерело актуального стану проєкту для наступних сесій. Перед
будь-якою роботою потрібно спочатку прочитати цей файл, потім `AGENTS.md`, а
`PROJECT_PROGRESS.md` і `SECURITY_BACKLOG.md` використовувати лише як
історичні журнали. Якщо старий запис суперечить цьому файлу, актуальним
вважається цей файл після повторної перевірки фактичного стану.

Після кожного завершеного етапу цей файл потрібно оновлювати. Заборонено
записувати сюди паролі, значення токенів, TOTP-секрети, recovery-коди,
платіжні реквізити, повні IP-адреси або персональні дані клієнтів.

## 1. Підтверджений технічний стан

- Основна робоча копія розташована поза iCloud:
  `/Users/apple/Projects/DREAM.CAR.VAVD`.
- Стара папка `/Users/apple/Desktop/MY PROEKT-2` є резервною історичною
  копією; не використовувати її для нової роботи та не видаляти без окремого
  дозволу власника.
- **Поточна підтверджена контрольна точка (2026-09-03, після merge PR #15):**
  `HEAD = origin/main = 4588d691ab312966d9068925e8ea5b994f0f0fd8`
  (squash-коміт PR #15, `perf: reduce hero image transfer size`, злито
  `2026-09-03T21:06:16Z`), активна гілка `main`, ahead/behind `0 0`, робоче
  дерево чисте; локально й віддалено залишилась лише `main`. CI на `push` у
  `main` — run `33806096697` (`Verify (TypeScript, ESLint, tests, build)`),
  `success`, 93 тести. Vercel Production deployment `6252896057`
  (ref `HShZWAJsyLnS8bp3AS4MskHTyMAT`) — `success`/`Current`, джерело
  `main`/`4588d691`, домен `dream-car-vavd.com` — HTTP 200. Хронологію
  PR #8–#15 див. розділ 16.
- **Попередня контрольна точка (2026-09-03, після merge PR #13):**
  `origin/main = ef13ac105c5d9c1d3e128faa874a824252b21652` (squash-коміт
  PR #13, `perf: improve hero image loading`, злито `2026-09-03T13:13:38Z`);
  між PR #13 і #15 — PR #14 (`docs: refresh current project status`,
  `90588fc6c97325390f15909a22078753a883c323`, лише `PROJECT_CURRENT_STATUS.md`).
- **Контрольна точка після merge PR #5 (2026-08-29, історична):**
  `origin/main = 69603763b36828c4fbb3858516c5feab33a65fe9`
  (squash-коміт PR #5, `docs: record GitHub access audit and 2FA`, злито
  `2026-08-29T20:53:15Z`). Деталі аудиту доступу — розділ 7; звуження Vercel
  repository access — розділ 8; практичний PR-тест інтеграції — розділ 9.
- **Історичні маркери (не поточні):**
  - контрольна точка перед документаційною корекцією Branch Protection:
    `origin/main = 4d30f46ae9bb67f62fee1f9e938eb60870c6d3dd`;
  - контрольна точка перед документаційною фіксацією Dependabot Security
    Updates: `origin/main = 364bd6127fae0c8a20c9382688cdd4613d2cbcb0`.
- Живий сайт: `https://dream-car-vavd.com`.
- Контактна форма працює через Formspree. Власник особисто підтвердив, що
  реальні заявки з сайту доставляються на його електронну пошту.
- API контактної форми вже посилено: строгий Content-Type, перевірка Origin,
  захист від upstream-redirect, `Cache-Control: no-store`, обмеження розміру
  запиту та локалізована обробка HTTP 429.
- Виправлення доступності форми, галерей, сервісних модалок, мобільного меню
  та перемикача мов розгорнуті у production.
- UK/RU/EN, CSP та основна інтерактивність були перевірені після deployment.

## 2. CI та GitHub — завершене

- Workflow: `.github/workflows/ci.yml`, commit `dc86a0c`.
- GitHub Actions run `32993236526` завершився успішно.
- Успішні кроки: `npm ci`, TypeScript, ESLint, **72/72 тести**,
  production build через Turbopack.
- Точна назва CI-check:
  `Verify (TypeScript, ESLint, tests, build)`.
- Джерело check: **GitHub Actions**.
- GitHub Secret Scanning і Push Protection підтверджені як увімкнені.
- Для `main` уже заборонені force-push і видалення; `enforce_admins = true`.
- Нових GitHub Rulesets немає; незбережена форма Ruleset не створює правила,
  доки не натиснуто `Create`.
- **Classic Branch Protection для `main` завершено й підтверджено через
  GitHub API 2026-08-29** (власник пройшов GitHub sudo-mode через email;
  код підтвердження, пароль, токени, TOTP і recovery-коди в чат не
  передавались):
  - Require a pull request before merging: **ENABLED**
    (`required_pull_request_reviews` не `null`);
  - Require approvals: **DISABLED** (`required_approving_review_count = 0`);
  - Require status checks to pass before merging: **ENABLED**;
  - єдиний required check: `Verify (TypeScript, ESLint, tests, build)`;
  - джерело check: **GitHub Actions** (`app_id = 15368`, незалежно
    підтверджено через `gh api app/15368` → `{"name":"GitHub Actions"}`);
  - `strict = false` (Require branches to be up to date — вимкнено);
  - `enforce_admins = true`; `allow_force_pushes = false`;
    `allow_deletions = false`;
  - Rulesets: `[]` — новий Ruleset не створювався, Classic Branch Protection
    не конвертувався; bypass-користувачі/програми та Vercel checks не
    додавались.

## 3. Практичний тест Branch Protection — завершено

Захист `main` перевірено не лише через read-only API (розділ 2), а й двома
послідовними PR:

**PR #1**

- Тестова гілка: `codex/docs-branch-protection-status`, commit `0e010c0`.
- Required check `Verify (TypeScript, ESLint, tests, build)` на PR —
  `success`.
- `Vercel` і `Vercel Preview Comments` з'явились автоматично як додаткові
  checks — вони **не входять** до required status checks Branch Protection.
- Стан PR: `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`; сторонні
  approvals не вимагались.
- Злито через **Squash and merge**; squash-коміт у `main`:
  `b9269c17035b8fa937856783623bca42041d677e`.
- CI run на `push` у `main` після merge: `33262469534` — `success`.

**PR #2**

- Документаційна гілка: `codex/docs-record-pr-protection-test`, перший
  commit `be36740`, останній tip перед merge — `11056b1`.
- Required check на PR (після проміжного текстового уточнення) — `success`,
  CI run `33263470326`.
- Стан PR: `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`.
- Злито через **Squash and merge**; squash-коміт у `main`:
  `4d30f46ae9bb67f62fee1f9e938eb60870c6d3dd`.
- CI run на `push` у `main` після merge: `33263520935`, event `push`,
  head SHA `4d30f46ae9bb67f62fee1f9e938eb60870c6d3dd` — `success`.
- Merge PR #2 містив лише `PROJECT_CURRENT_STATUS.md`.

**PR #3 — оновлення актуального статусу**

- Гілка: `codex/docs-refresh-current-status`, commit `b24cc6a74061c1543f463f28a1a1b705f807a558`.
- Required check `Verify (TypeScript, ESLint, tests, build)` — `success`,
  джерело — GitHub Actions.
- `Vercel` checks були додатковими, не required.
- Стан PR: `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`.
- Злито через **Squash and merge**; squash-коміт у `main`:
  `364bd6127fae0c8a20c9382688cdd4613d2cbcb0`, commit message
  `docs: refresh current project status`.
- Merge містив лише `PROJECT_CURRENT_STATUS.md`.
- CI на `push` у `main` після merge: run `33264806419` — `success`.
- Після merge: `HEAD = origin/main`, ahead/behind `0 0`, робоче дерево
  чисте.
- Службову гілку PR #3 видалено — локально й на GitHub.
- PR #3 залишається доступним зі статусом `MERGED`.

Прямий push у `main`, force push, rebase і reset під час усіх трьох PR не
використовувались. Після кожного merge і зеленого CI локальна `main`
синхронізувалась лише через `git switch main` + `git pull --ff-only`.

Усі три службові гілки (`codex/docs-branch-protection-status`,
`codex/docs-record-pr-protection-test`, `codex/docs-refresh-current-status`)
**видалені — як локально, так і на GitHub** — після підтвердженого merge і
зеленого CI кожного разу. PR #1, PR #2 і PR #3 залишаються доступними в
GitHub зі статусом `MERGED` як історичний доказ.

## 4. Dependabot — перевірено та налаштовано

**До увімкнення** (розширений read-only аудит, API + UI незалежно
збігались): Dependabot Alerts — `ENABLED`; Dependabot Security Updates —
`DISABLED`; open alerts — `0`; fixed alerts — `1`; Dependabot PR — `0`;
Version Updates — `NOT CONFIGURED` (`.github/dependabot.yml` відсутній);
Grouped Security Updates — `DISABLED`; Malware Alerts — `DISABLED`;
auto-merge — `DISABLED`.

**Виконана зміна:** `2026-08-29`, у GitHub UI натиснута лише одна кнопка —
`Enable dependabot security updates`. Sudo mode не запитувався; жодні коди,
паролі чи токени не передавались. Жодні інші Dependabot/security
налаштування не змінювались.

**Після увімкнення — 3 незалежні докази:**

1. Repository API: `security_and_analysis.dependabot_security_updates.status = enabled`.
2. Automated Security Fixes API: явний результат `enabled = true, paused = false`.
3. GitHub UI: біля Dependabot Security Updates показується кнопка `Disable`.

**Підсумковий стан:** Dependabot Alerts — `ENABLED`; Dependabot Security
Updates — `ENABLED`; open alerts — `0`; fixed alerts — `1`; Dependabot PR —
`0`; Version Updates — `NOT CONFIGURED`; Grouped Security Updates —
`DISABLED`; Malware Alerts — `DISABLED`; auto-merge — `DISABLED`; API та UI
узгоджені; побічних змін не виявлено.

**Dependency Graph і локальна перевірка:** Dependency Graph здоровий — SBOM
API розпізнав 467 пакетів, `package-lock.json` без parsing errors. CI
сумісний із майбутніми Dependabot PR: `pull_request` trigger,
`permissions: contents: read`, `persist-credentials: false`, жодних
`secrets.*`, без write/push/merge/deploy кроків. `npm audit --json`: exit
`0`, 0 вразливостей локально — використаний лише як додатковий сигнал,
`package.json`/`package-lock.json` не змінювались.

**Історичний alert (не потребує дій):** `npm` / `nanoid`, severity `high`,
vulnerable `< 3.3.18`, patched `3.3.18`, scope `runtime`, стан `fixed`; open
alerts зараз — `0`.

## 5. Vercel WAF — очікує зовнішньої відповіді

- Активне правило `Contact form rate limit`:
  - path equals `/api/contact`;
  - method equals `POST`;
  - Fixed Window;
  - 10 запитів за 60 секунд;
  - counting key: IP Address;
  - поточна follow-up action: **Log**.
- Спроба вибрати `Too Many Requests (429)` показала модальне вікно
  `Upgrade ... to Pro`. `Continue`, Save, Review Changes і Publish не
  натискалися; тариф і правило не змінені.
- Vercel Support case: `#01tppcuj583XiPMj`, статус останньої перевірки —
  Open / Awaiting response.
- До письмової відповіді співробітника Vercel не натискати `Continue` і не
  змінювати WAF або billing.

## 6. Захист акаунтів — підтверджене

- Захист основної електронної пошти: власник підтвердив завершення.
- Formspree: 2FA увімкнено; recovery-коди збережені власником.
- Vercel: Two-Factor Authentication **Active**, Authenticator App (TOTP)
  Enrolled; recovery-коди збережені власником.
- GitHub: повний read-only аудит доступу та автентифікації, включно з
  2FA, PAT, Security keys і GitHub Apps, — розділ 7 (завершено повністю,
  без відкритих непідтверджених деталей).
- Recovery-коди, TOTP-секрети й паролі не передавати асистентам і не
  вставляти в чат.

## 7. GitHub — аудит доступу та автентифікації (завершено)

Read-only аудит виконано `2026-08-29` через офіційний GitHub UI та `gh api`
(лише GET-запити), без зміни жодного налаштування. Три раніше непідтверджені
деталі (fine-grained PAT scope/permissions, Security keys, детальні
permissions Authorized GitHub Apps) незалежно перевірені й закриті
`2026-08-29`.

**2FA:** Enabled. Preferred method — Authenticator app; метод — Google
Authenticator, статус **Configured**; recovery codes налаштовані, власник
підтвердив їх безпечне збереження (роздруковані, перевірені; завантажений
незахищений файл recovery codes видалено остаточно). Самі коди, QR-код,
setup key і TOTP-коди ніде не записувались і не переглядались асистентом.
SMS — не додано. GitHub Mobile — не додано. Passkey — не додано.

**Активні сеанси:** 1 поточний очікуваний сеанс; підозрілих сеансів не
виявлено. IP та інші приватні значення в цьому файлі не записуються.

**Fine-grained PAT (підтверджено `2026-08-29` через `/settings/personal-access-tokens/18727062`):**
1 токен, назва `DreamCar Git Push`, опис `Git push for DREAM.CAR.VAVD`,
resource owner `DreamCar-vavd`; створено `Tue, Aug 25 2026`, строк дії —
`Thu, Sep 24 2026`; на момент аудиту — `Never used`. Repository access:
`Only select repositories`, вибрано 1 репозиторій —
`DreamCar-vavd/DREAM.CAR.VAVD`. User permissions — відсутні (`This token
does not have any user permissions`). Organization permissions — відсутні.
Repository permissions: `Metadata` — Read; `Code and workflows` — Read and
Write. Pending approval — відсутній. Значення токена не переглядалось і не
записувалось.

Оцінка мінімальності (не безумовна): Contents/Code Read and Write відповідає
потребі `git push`; Workflows Read and Write потрібне лише за умови
редагування `.github/workflows/*` цим токеном — тому набір є мінімальним
лише за умови запланованого редагування workflow-файлів. Токен жодного разу
не використовувався, оскільки фактичні git-операції цієї сесії виконувались
через окрему OAuth-авторизацію `gh` CLI. Рішення залишити, звузити чи
видалити токен не прийнято — розділ 12.

**Classic PAT:** 0.

**SSH keys:** 0. **GPG keys:** 0.

**Security keys (підтверджено `2026-08-29`):** `0`. На сторінці `Password
and authentication` розділ `Security keys` після розгортання (`Edit` →
`Hide`) показує лише кнопку `Register new security key`, без жодного
зареєстрованого ключа. Не плутати з SSH keys (0, вище) чи passkeys (не
додано).

**Authorized OAuth Apps (2):** `GitHub CLI` — офіційний, owned by github,
використовувався; `Visual Studio Code` — офіційний, owned by
Visual-Studio-Code, на момент аудиту `Never used`. Доступи не відкликались і
не змінювались.

**Authorized GitHub Apps (акаунт, 4, деталі підтверджено `2026-08-29`):**

- `Claude` — publisher `anthropics`, на момент аудиту `Never used`.
- `Copilot Chat App` — publisher `github`, на момент аудиту `Never used`.
- `Mem0` — publisher `mem0ai`, на момент аудиту `Never used`, user-level
  доступ включає перегляд email-адреси (`View email addresses`).
- `Vercel` — publisher `vercel`, використовувався протягом останнього тижня
  на момент аудиту, user-level доступ включає перегляд email-адреси.

Це user-level авторизації із узагальненими категоріями GitHub (`Verify your
identity`, `Know what resources...`, `Act on your behalf`) — не точні
repository permissions; ці категорії не перетворюються в цьому файлі на
вигадані деталі. **На рівні репозиторію `DREAM.CAR.VAVD` встановлено
(Installed GitHub Apps) лише `Vercel`** — це окрема, репозиторій-специфічна
авторизація з детальними permissions, описаними в розділі 8. Доступи
жодного з чотирьох Authorized GitHub Apps не відкликались і не змінювались
під час цього аудиту.

**Collaborators:** 0; pending invitations — 0; доступ на запис має лише
власник.

**Deploy keys:** 0.

**Webhooks:** 0 на репозиторії; інтеграція з Vercel працює через GitHub App,
а не через класичний webhook.

**GitHub CLI (`gh`):** автентифікація чинна, окрема OAuth-авторизація (не
той самий механізм, що fine-grained PAT вище). Значення OAuth-токена не
переглядалось і не записувалось.

## 8. Vercel GitHub App — звуження repository access

- До зміни: `Repository access = All repositories`.
- `2026-08-29`, у GitHub UI (`/settings/installations/154222719`), виконано
  єдину зміну: `Repository access → Only select repositories`, вибрано
  `DreamCar-vavd/DREAM.CAR.VAVD` (1 репозиторій).
- Permissions застосунку не змінювались: Read — `actions`, `metadata`; Read
  and Write — `administration`, `checks`, `code`, `commit statuses`,
  `deployments`, `issues`, `pull requests`, `repository hooks`, `workflows`.
  Це стандартний набір чинної Vercel installation; UI не дозволяє звужувати
  ці permissions по одному пункту.
- Installation не suspended, не uninstalled (у `Danger zone` доступні лише
  кнопки `Suspend`/`Uninstall`, жодна не натискалась).
- Production не постраждав: зміна не викликала нового deployment,
  `dream-car-vavd.com` залишався HTTP 200.
- Повторно read-only підтверджено `2026-08-29`: `Only select repositories`,
  вибрано 1 репозиторій — `DreamCar-vavd/DREAM.CAR.VAVD`, permissions без
  змін; `Save` під час цієї повторної перевірки не натискався.

## 9. Практичний тест PR №6 — GitHub↔Vercel Preview

Мета: підтвердити, що звуження repository access (розділ 8) не порушує
створення Preview deployment через реальний, одноразовий PR.

- Тестова гілка `codex/test-vercel-repository-scope` від `main`
  (`69603763b36828c4fbb3858516c5feab33a65fe9`); один тимчасовий файл
  `VERCEL_INTEGRATION_TEST.md`; commit
  `63e9c5b69d2507b332a7d60d72ee1160dfc879e6`.
- [PR #6](https://github.com/DreamCar-vavd/DREAM.CAR.VAVD/pull/6)
  `test: verify Vercel repository access`.
- Required check `Verify (TypeScript, ESLint, tests, build)` — `success`,
  GitHub Actions run `33276771941`.
- Vercel Preview deployment `3uk9kbtFeVsure97tn9uRzC8d7xq` — `Ready`,
  тривалість `30s`, environment `Preview`, джерело
  `codex/test-vercel-repository-scope` / `63e9c5b`.
- Smoke-check: Preview URL відкрито напряму, сайт (`/uk`) відрендерився
  повністю, без Deployment Protection чи помилок Vercel; контактна форма не
  надсилалась.
- Production не постраждав протягом усього тесту: залишався `main` /
  `6960376`, `Ready`, `dream-car-vavd.com` — HTTP 200; Preview не
  promoted.
- PR #6 закрито без merge (`state: CLOSED`, `mergedAt: null`,
  `mergeCommit: null`); тестову гілку видалено — remote і локально;
  тестовий файл відсутній у `main`.
- Висновок: звуження repository access не порушує GitHub↔Vercel
  Preview-інтеграцію.

## 10. Preview build incident на PR №5 (історичний, вирішено)

- Перший Preview deployment (`yVuDoJMTSzJX7KoXNJc6hkARgpN1`, гілка
  `codex/docs-record-github-2fa`, commit `eac715b`) завершився `Error` через
  `45m 59s`: `Your deployment's build step did not complete within the
  maximum of 45min`. Build-лог містив лише 4 рядки — до `Cloning
  completed`, далі без активності протягом усього часу очікування.
- Виконано рівно один контрольований Redeploy без Build Cache: новий
  deployment `2uZtxxxmEKRN6TfPE2c4KPinZZvj`, той самий commit `eac715b`,
  environment `Preview`, результат `Ready` за `42s`.
- Точна першопричина не доведена; сильна, але непряма гіпотеза — збій
  відновлення Build Cache або суміжної Vercel orchestration-фази. Код PR і
  конфігурація проєкту не змінювались і не розглядаються як ймовірна
  причина.
- Другий Redeploy не виконувався. Інцидент не вплинув на Production.

## 11. Потребує окремої перевірки, а не припущення

- Стан 2FA, Domain Lock, auto-renew і дати завершення домену в 123 Reg —
  станом на `2026-09-03` підтверджено власником (розділ 17). Раніші
  припущення більше не діють; актуальні значення — лише в розділі 17.
- DNSSEC не вмикати без окремого read-only аудиту authoritative DNS,
  підтримки провайдера та плану відкату (станом на `2026-09-03` —
  `Disabled`, розділ 17).

## 12. Відкриті рішення власника (не активні проблеми)

Це рішення власника, а не незавершені технічні завдання — жодне з них не
прийнято в цьому документі:

1. Чи потрібен невикористаний fine-grained PAT `DreamCar Git Push`
   (на момент аудиту — `Never used`).
2. Чи потрібне право `Workflows: Read and Write` для цього PAT, якщо
   редагування `.github/workflows/*` через нього не планується.
3. Чи відкликати невикористовувані authorizations: `Visual Studio Code`
   (Authorized OAuth App), `Claude`, `Copilot Chat App`, `Mem0` (Authorized
   GitHub Apps).
4. Чи додавати резервний passkey або security key до GitHub-акаунту.
5. Подальші зовнішні етапи (кожен — окреме рішення і окремий етап):
   123-reg / DNS / DNSSEC; Vercel WAF Support case; performance/media
   аудит; SEO; monitoring; актуальність бізнес-даних.

## 13. Наступні покращення — не блокують поточну роботу сайту

Ці пункти не можна називати незавершенням працездатності сайту. Виконувати
лише окремими етапами після рішення власника щодо розділу 12:

1. ~~Read-only аудит Core Web Vitals і фактичної швидкості production.~~
   **Виконано 2026-09-03** — два read-only аудити мобільної швидкодії та
   Hero/LCP (розділ 16).
2. За результатами аудиту — окрема оптимізація фотографій. **Частково:**
   PR #8 (стиснення всіх зображень), PR #13 (пріоритет Hero + `sizes`
   логотипів) і PR #15 (hero `quality` 90→75, −42.85/−44.45%) виконані
   (розділ 16). Глибша оптимізація ранніх ресурсів (raw-PNG shimmer-маски
   ~197 КБ, preload-шрифти, `minimumCacheTTL`, AVIF) — відкрита, лише за
   новими доказами (розділ 19, блок A).
3. Окремо — оптимізація відео та кешування. **Відкрито** (розділ 19, блок B).
4. Перевірка актуальності бізнес-даних і контенту власником. **Відкрито**
   (розділ 19, блок D).
5. Контроль SEO лише за результатами нового аудиту: базові metadata,
   canonical, hreflang, sitemap, robots.txt і JSON-LD вже реалізовані.
   Sitemap подано в Google Search Console (розділ 17).
6. Моніторинг доступності сайту, кодів відповіді `/api/contact` без PII,
   доставки заявок, Formspree quota, строку домену та строку PAT.
7. Фінальний production-аудит після всіх погоджених змін.

## 14. Правила безпечної роботи

- Перед будь-якою дією перевіряти, що робота ведеться в
  `/Users/apple/Projects/DREAM.CAR.VAVD`.
- Перед змінами перевіряти `git status`, `HEAD`, `origin/main` і показувати
  точний план та область змін.
- Не виконувати commit, push, deploy, merge, оплату, зміну тарифу, DNS,
  акаунтів або зовнішніх налаштувань без явного дозволу власника.
- Кожен логічний етап завершувати перевіреною контрольною точкою; не
  переходити далі після невдалих тестів.
- Не використовувати старі твердження з `PROJECT_PROGRESS.md` або
  `SECURITY_BACKLOG.md` без звірки з цим файлом і фактичним станом.
- Після завершення кожного етапу оновлювати цей файл: переносити пункт із
  активного/очікуваного до завершеного й записувати доказ перевірки.

## 15. Наступна одна дія

**Активної технічної задачі немає.** Останній завершений етап — PR #15
(`perf: reduce hero image transfer size`, hero `quality` 90→75), злитий і
перевірений на Production `2026-09-03`. Контрольна точка й докази — розділ 1;
повний запис PR #8–#15 — розділ 16; зовнішній стан — розділ 17; впорядкований
backlog — розділ 19.

Наступний рекомендований етап (окремим дорученням власника): **одноразовий
READ-ONLY аудит ранніх конкурентних ресурсів** — CSS-mask
`dream-car-logo.png` (~197 КБ), preload-шрифти (~132 КБ), hero-logo WebP,
ранній JavaScript. **Без повторного аудиту Hero і без численних
PageSpeed-прогонів.** Деталі — розділ 19, блок A.

Історична частина (без змін): GitHub/Vercel access audit — розділ 7; Vercel
repository access звужено та підтверджено практичним PR-тестом (розділи
8–9); Preview build incident на PR №5 задокументовано як вирішений (розділ
10).

Фактично незавершені питання зібрані нижче — жодне не блокує роботу сайту і
кожне є окремим рішенням власника (повний backlog — розділ 19):

1. Накопичення реальних даних у Google Search Console (розділ 17) — потрібен
   час і трафік.
2. Оновлення favicon у видачі Google Search (розділ 18) — залежить від
   циклу переобходу Google; конкретний строк не гарантується.
3. Реальні Core Web Vitals у Vercel Speed Insights / CrUX — після
   накопичення достатнього трафіку; порівняння лише за медіанами, не за
   одиничним прогоном.
4. Письмове уточнення від 123 Reg щодо статусу `clientRenewProhibited` для
   домену (розділ 17).
5. Окреме рішення власника щодо DNSSEC (наразі `Disabled`, розділ 17) — лише
   після read-only аудиту authoritative DNS і плану відкату.
6. Подальше покращення мобільного LCP. PR #13 (пріоритет Hero) і PR #15
   (hero `quality` 90→75) виконані; **стабільне покращення LCP жодним із них
   лабораторно не доведено** (два збалансовані A/B-раунди дали протилежні
   знаки медіани — у межах шуму Lighthouse). Наступні кандидати — розділ 19,
   блок A; тільки за новими доказами, порівняння за медіанами 3+3/5+5.
7. Відкриті рішення власника з розділу 12 (невикористаний fine-grained PAT,
   `Workflows` scope, невикористані OAuth/GitHub Apps, резервний
   passkey/security key) — без змін.

## 16. Продуктові, перформанс та observability-етапи (PR #8–#15)

Усі перелічені PR злиті через **Squash and merge**, кожен required CI-check
`Verify (TypeScript, ESLint, tests, build)` на `main` після merge —
`success`, кожен Vercel Production deployment — `success`. Службові гілки
видалені (remote + локально) після кожного merge. Оновлення цього файла
винесені в окремі документаційні PR (#14, потім цей запис).

- **PR #8 — `perf: optimize site images`.** Squash-коміт
  `42ec6bd8caedfc7b0c55905d9dc30cae2501026c`, злито `2026-08-30T12:55:51Z`,
  CI run на `main` `33312798383`. Стиснення всіх зображень сайту (галерея,
  автомобілі в продажу, hero, логотип) — сумарний обсяг зменшено з ~140 МБ
  до ~23 МБ (≈83%). Змінено 34 файли: 33 зображення в `public/images/**` +
  `src/components/HeroSection.tsx`. Форма, тексти, переклади, маршрути й
  конфігурація не змінювались.
- **PR #9 — `feat: update Dream Car favicon`.** Squash-коміт
  `90fd33108b75959ac156598f09b11d87cf424096`, злито `2026-08-30T14:59:22Z`,
  CI run на `main` `33318361617`. Новий чорно-золотий favicon із короною
  (референс наданий і погоджений власником). Змінено рівно 1 файл —
  `src/app/favicon.ico`. Файл `.ico` містить 6 вбудованих кадрів — 16×16,
  32×32, 48×48, 64×64, 128×128, 256×256 (256×256 — найбільший, а не єдиний).
  На Production `/favicon.ico` → HTTP 200, `image/vnd.microsoft.icon`; у
  `<head>` — `<link rel="icon">` з cache-busting-параметром. Кеш Google —
  розділ 18.
- **PR #10 — `feat: add Vercel analytics and speed insights`.** Squash-коміт
  `c5016b520d09608578c2abebeeb711216212c972`, злито `2026-08-30T19:11:37Z`,
  CI run на `main` `33330181280`. Додано Vercel Web Analytics і Speed
  Insights у `src/app/[locale]/layout.tsx` + оновлено сторінки
  Privacy Policy та Cookies (`src/app/[locale]/privacy-policy/page.tsx`,
  `src/app/[locale]/cookies/page.tsx`) з розкриттям про збір знеособленої
  телеметрії, uk/ru/en. Змінено 5 файлів (+`package.json`,
  `package-lock.json`). Web Analytics отримує реальні дані на Production;
  Speed Insights приймає Production-події (розділ 17).
- **PR #11 — `feat: add structured car service modal content`.** Squash-коміт
  `fd8fcd043ebbb304b2efc9b995c4629e601c0b85`, злито `2026-09-02T08:35:21Z`,
  CI run на `main` `33609520581` (78 тестів). Структурований опис послуги
  «Автосервіс» (лід + 5 секцій / 19 пунктів) **виключно в модальному вікні**,
  uk/ru/en. Змінено 7 файлів: `src/content/types.ts`,
  `src/content/dictionaries/{uk,ru,en}.ts`, `src/components/ServicesGrid.tsx`,
  `src/components/ServiceModal.tsx` + новий тест
  `src/content/carServiceModal.test.ts`. Зміни в словниках — суто
  additive; SEO-сторінка `/[locale]/services/car-service` (стара
  longDescription + 4 пункти, JSON-LD `AutoRepair`+`BreadcrumbList`) не
  змінювалась; інші послуги зберігають старий fallback-рендер.
- **PR #12 — `content: update detailing service copy`.** Squash-коміт
  `6e5f705fd8f1ce83b80d903349e609e4679ea883`, злито `2026-09-02T09:31:32Z`,
  CI run на `main` `33614590155` (93 тести). Оновлено **лише користувацькі
  тексти** — картки (касети) послуги та розгорнутого опису «Детейлінг і
  полірування» в модальному вікні, uk/ru/en. Іконка, зображення, графіка
  (зокрема сама графічна касета), дизайн і функціональність **не
  змінювалися**. Змінено 8 файлів: `src/content/types.ts`,
  `src/content/dictionaries/{uk,ru,en}.ts`, `src/components/ServicesGrid.tsx`,
  `src/components/ServiceModal.tsx`, `src/content/carServiceModal.test.ts` +
  новий `src/content/detailingModal.test.ts`. SEO-сторінка детейлінгу та
  назва послуги збережені; структурований модал автосервісу та fallback
  інших послуг не порушені. CSS/маршрутів/конфігурації зміна не торкалась.
- **PR #13 — `perf: improve hero image loading`** (гілка
  `codex/perf-prioritize-hero-images`, назва PR
  `perf: prioritize hero image loading`). Squash-коміт
  `ef13ac105c5d9c1d3e128faa874a824252b21652`, злито `2026-09-03T13:13:38Z`,
  CI run на `main` `33759873675` (93 тести), Vercel Production deployment
  `6244736017` (ref `5MR4kqizB3uK47ky4EZ9Vwj7C7Gi`) — `success`/`Current`.
  Змінено 7 файлів у `src/components/` (+23/−9): `HeroSection.tsx`,
  `DreamLogo.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`,
  `CarsForSaleSection.tsx`, `GalleryProjectModal.tsx`, `NotFoundContent.tsx`.
  Суть:
  - hero-фото: застарілий проп `priority` замінено на
    `loading="eager"` + `fetchPriority="high"` (у Next.js 16 `fetchPriority`
    сам по собі не скасовує lazy);
  - у `DreamLogo` прибрано проп `priority` повністю, додано опційний
    `sizes`; коректні `sizes` проставлені на всіх викликах логотипа;
  - результат на Production перевірено: у `<head>` **рівно один** image
    preload — hero-фото, з `fetchpriority="high"`; **окремого preload для
    `dream-car-logo.png` немає** (раніше логотип предзавантажувався як
    `w=1920`/`w=3840`); hero `<img>` має `loading="eager"` +
    `fetchpriority="high"`; ручних `<link rel="preload">` не додавалось —
    єдиний preload генерує сам Next/React;
  - hero `currentSrc` відповідає viewport (Mobile `w=1200`, Tablet/Desktop
    `w=1920`, `q=90`); DreamLogo не завантажується як `w=1920`/`w=3840`
    (максимум `w=1080` на DPR 3, `q=75`); усі 4 логотипи — `loading="lazy"`;
  - візуал hero не змінився (`object-fit: cover`,
    `object-position: 50% 38%` / `50% 50%`), CLS ≈ 0, битих зображень і
    console/CSP-помилок на Production немає на всіх 7 маршрутах.
  - Дизайн, тексти, переклади, зображення, `next.config.ts`, кешування,
    анімації та функціональність не змінювались. `priority` (застарілий)
    свідомо залишено на 2 не-DreamLogo `<Image>` у модальних галереях
    (`GalleryProjectModal.tsx`, `CarListingGallery.tsx`) — поза областю
    цього етапу.

  **Формулювання щодо швидкодії (лабораторне, не польове):** PageSpeed /
  Lighthouse — це лабораторні синтетичні прогони, а не реальні користувацькі
  Core Web Vitals (польові дані — лише в Google Search Console / CrUX, розділ
  17). PageSpeed **не запускати** як критерій цього етапу. Порівняння 3+3
  mobile-прогонів (pagespeed.web.dev) до/після дало медіани Performance
  83→81, **LCP 4.7 с→4.7 с (у лабораторному порівнянні не покращився)**,
  CLS 0→0, Speed Index 2.3 с→2.3 с — це **не доводить ані регресію, ані
  прискорення** (у межах природної варіативності Lighthouse). Єдиний
  підтверджений технічний результат: аудит *«LCP request discovery /
  missing `fetchpriority`»* присутній у всіх 3 прогонах Production і зник у
  всіх 3 прогонах Preview. Коректне формулювання: **усунено конкретний
  технічний аудит missing `fetchpriority` та надлишковий preload логотипа;
  один Hero preload залишено; підтвердженої регресії CLS чи LCP немає.**
  Загальне «сайт став швидшим» без польових доказів не стверджується.

  **Vercel Preview `feedback.js`:** на Preview-деплойментах Vercel інжектує
  власний скрипт `vercel.live/_next-live/feedback/feedback.js`, який блокує
  CSP застосунку (`script-src 'self' 'unsafe-inline'`) → одна console-помилка
  на Preview. Це Preview-артефакт, інжектований Vercel, — **не частина
  застосунку DREAM.CAR.VAVD** (0 згадок у origin-HTML застосунку, тег несе
  атрибут `data-deployment-id`). Заголовок `x-vercel-skip-toolbar` ховає
  Toolbar UI, але в проведеному тесті інжекцію `feedback.js` не прибрав.
  **На Production цього ресурсу та пов'язаної CSP-помилки немає** (0 згадок
  `vercel.live` у HTML головних маршрутів).

- **PR #14 — `docs: refresh current project status`.** Squash-коміт
  `90588fc6c97325390f15909a22078753a883c323`, злито `2026-09-03T18:46:24Z`,
  CI run на `main` `33792491096`. Лише `PROJECT_CURRENT_STATUS.md`, +255/−31:
  консолідовано PR #8–#13 + Google Search Console + 123 Reg + favicon у нові
  розділи 16–18; документ приведено до 18 розділів.

- **PR #15 — `perf: reduce hero image transfer size`.** Squash-коміт
  `4588d691ab312966d9068925e8ea5b994f0f0fd8`, злито `2026-09-03T21:06:16Z`,
  CI run на `main` `33806096697` (93 тести), Vercel Production deployment
  `6252896057` (ref `HShZWAJsyLnS8bp3AS4MskHTyMAT`) — `success`/`Current`.
  **Рівно один рядок в одному файлі** — `src/components/HeroSection.tsx`:
  hero `<Image>` `quality={90}` → `quality={75}`. Джерело зображення, `sizes`,
  `loading="eager"`, `fetchPriority="high"`, кроп / `object-fit` /
  `object-position` / aspect ratio — **без змін**.
  - **Підтверджений результат (жива Production-перевірка):** вага hero-WebP
    зменшилась: `w=1200` **161 462 → 92 278 B (−42.85%)**, найбільший реально
    виданий варіант (`w=1920` → фактично **1682 px**, обмеження джерела)
    **266 172 → 147 858 B (−44.45%)**. Формат WebP/VP8, aspect ratio без
    змін, Next не апскейлить вище 1682 px. PSI-аудит «Покращте показ
    зображень» знизився до ~215 КіБ (був 247–309), і його більше не очолює
    hero.
  - **На Production перевірено (uk/ru/en × mobile/tablet/desktop):** hero —
    LCP-елемент; `loading="eager"` + `fetchpriority="high"` збережені;
    рівно 1 image-preload у `<head>` (hero), 0 preload логотипа; дубльованого
    запиту hero немає; **CLS 0**; 0 битих зображень; 0 app console/CSP
    errors. HTTP→HTTPS 308, `/`→`/uk` 307, favicon (144 725 B),
    Автосервіс/Детейлінг/Полірування, cars-for-sale, `_vercel/insights` +
    `_vercel/speed-insights` (200), sitemap 27 URL, robots.txt — без змін.
  - **Візуальна якість:** порівняння Production `q90` vs candidate `q75` у
    3 в'юпортах + збільшення 200% реальних пікселів 5 найчутливіших ділянок
    (капот чорного авто з відблисками, гладка панель SUV, межа світло/тінь на
    стелі, фон, фара). **Артефактів стиснення немає** — без banding,
    blocking, ringing/halo. Відмінності від `q90`: трохи більше шуму в
    глибоких тінях і трохи м'якший розмитий фон; об'єкти (авто) не
    відрізнити. Авто-метрика: SSIM ≈ 0.97, PSNR ≈ 36 dB, похибка у
    високочастотних деталях (не у пласких зонах → banding відсутній).
    **Власник прийняв візуальну якість q75.**
  - **Формулювання:** PR #15 прийнято як **оптимізація ваги / трафіку
    hero-зображення**, а **НЕ як «виправлення LCP»**. Два збалансовані
    mobile-A/B-раунди (3+3, потім 5+5) дали медіанний LCP **у межах шуму** з
    протилежними знаками між раундами (Preview −0.5 с гірше, потім −0.3 с
    краще); стабільне покращення LCP не заявляється. Один найкращий прогін як
    доказ не використовується.

### Перформанс-аудити мобільного LCP (READ-ONLY, 2026-09-03)

Два незалежні read-only діагностики (без зміни коду), докази з коду +
Production-HTML + throttled-браузера + PageSpeed web UI:

- **LCP-елемент = hero-фото `hero-cars-logo-final.jpg`** — стабільно у всіх
  режимах, в'юпортах і 3 мовах.
- **Вузьке місце — тривалість завантаження hero-ресурсу** (не пізнє
  виявлення, не пріоритет, не JS/hydration, не анімації, не сервер, не
  шрифти напряму). Причина довгого завантаження: конкуренція за смугу з
  ~640 КБ ранніх ресурсів у тому ж вікні — 6 preload-шрифтів (~132 КБ),
  **сирий `dream-car-logo.png` ~197 КБ** (CSS `mask-image` у
  `globals.css:98` для shimmer), hero-logo WebP (~128 КБ на DPR 3),
  ~165 КБ JS.
- **Відкинуто як причину:** JS/hydration (TBT 20–130 мс, 2 long tasks
  ~70 мс; HeroSection — серверний компонент), анімації/shimmer у
  критичному шляху LCP, шрифти як причина CLS (CLS = 0), сервер/мережа
  (TTFB 30–60 мс, edge-cache HIT).
- **Desktop проблеми не має** (LCP ~1.0 с, Performance ~99).
- Наступні кандидати для ізольованих доказових етапів — розділ 19, блок A.

## 17. Зовнішній стан: Google Search Console та домен 123 Reg

Значення в цьому розділі станом на `2026-09-03` підтверджені власником за
результатами його власних read-only перевірок. Секрети (значення Google
verification TXT, паролі, TOTP, setup keys, recovery-коди, токени) сюди не
записуються.

**Google Search Console (`dream-car-vavd.com`):**

- Domain property `dream-car-vavd.com` — **підтверджено**; метод
  підтвердження — **DNS** (значення Google TXT не розкривається й не
  зберігається).
- Sitemap `https://dream-car-vavd.com/sitemap.xml` — подано й **успішно
  оброблено**. Два узгоджені, але **різні** джерела: (а) сам XML на
  Production містить **27 `<url>`** (незалежно read-only підтверджено); (б)
  GSC на момент перевірки показав **27 знайдених сторінок**. `robots.txt` →
  HTTP 200, `Allow: /`, декларує sitemap.
- `/uk` — у GSC на момент перевірки: «URL is on Google» та окремо пройдено
  Live Test; повторний запит індексації `/uk` було надіслано (це не
  гарантує негайного оновлення favicon чи миттєвого переобходу). Read-only
  на Production: `noindex` відсутній, canonical і hreflang
  uk/ru/en/x-default присутні.
- Manual Actions — проблем не виявлено (на момент перевірки).
- Security Issues — проблем не виявлено (на момент перевірки).
- HTTPS — критичних проблем немає (на момент перевірки).
- Core Web Vitals — це **польовий** звіт GSC/CrUX (окремий від лабораторного
  PageSpeed, розділ 16); реальних польових даних поки недостатньо, звіт ще
  накопичується.

**Домен у 123 Reg:**

- 2-Step Verification — **Enabled**; Authenticator app — **DEFAULT**
  (секрети не розкривались).
- Auto-renew — **On**; Domain Lock — **On**; рівень захисту — **Full
  Protection**.
- DNSSEC — **Disabled** (на момент перевірки). Це не означає, що DNSSEC не
  потрібен — рішення відкрите (розділ 15, п. 5) і потребує окремого
  read-only аудиту authoritative DNS та плану відкату.
- Після додавання Google verification TXT у таблиці DNS **8 записів** —
  стан на момент перевірки (саме значення verification TXT у документ не
  додається).
- Інші параметри домену не змінювались.
- Невирішене питання для 123 Reg Support: письмове уточнення щодо статусу
  `clientRenewProhibited` для домену (розділ 15, п. 4).

**Vercel (read-only, без змін налаштувань):**

- Production `Current` відповідає `main` / `4588d691` (PR #15).
- Web Analytics — працює (отримує реальні події на Production).
- Speed Insights — приймає Production-події.
- Домен `dream-car-vavd.com` — працює (HTTP 200).

## 18. favicon у видачі Google Search

- Production-favicon коректний: `src/app/favicon.ico` (PR #9) містить 6
  вбудованих кадрів від 16×16 до 256×256 (256×256 — найбільший, не єдиний).
  `/favicon.ico` → HTTP 200, `image/vnd.microsoft.icon`; `<link rel="icon">`
  присутній у `<head>` з cache-busting-параметром.
- Google у видачі може **ще деякий час показувати старий значок** через
  власний кеш і цикл повторного сканування — це очікувано і не є дефектом
  реалізації.
- Search Console підключено, повторну індексацію `/uk` замовлено (розділ
  17) — це коректні кроки, щоб пришвидшити переобхід, але **вони не
  гарантують строку** оновлення значка.
- **Конкретний строк оновлення favicon у результатах пошуку Google не
  гарантується** і не фіксується в цьому документі.

## 19. Впорядкований backlog (A–E)

Зведений список робіт після PR #15. Жоден пункт не блокує роботу сайту.
Кожен — окремий етап за окремим дорученням власника, у безпечному flow
(гілка → commit → PR → CI/Preview → зупинка перед merge). Не об'єднувати
незалежні гіпотези в один PR.

### A. Мобільний LCP — ранні конкурентні ресурси

**Наступний рекомендований етап: одноразовий READ-ONLY аудит** (без
повторного аудиту Hero, без численних PageSpeed-прогонів), потім — по одній
ізольованій зміні з A/B-виміром медіан (3+3 або 5+5, не одиничний прогін):

| # | Кандидат | Гіпотеза | Ризик |
|---|---|---|---|
| A1 | Сирий `dream-car-logo.png` ~197 КБ (CSS `mask-image`, `globals.css:98`, shimmer) — більший за hero, не оптимізований, у критичному вікні | замінити маску на легкий асет (SVG-контур / крихітний PNG) або прибрати shimmer | середній — зачіпає візуальний ефект, потрібне схвалення дизайну |
| A2 | 6 preload-шрифтів ~132 КБ (Playfair + Manrope × latin/latin-ext/cyrillic × ваги) | зменшити ваги, `preload: false` на body-шрифт | середній — FOUT, ризик CLS (зараз 0) |
| A3 | hero-logo WebP ~128 КБ на DPR 3 | уточнити `sizes` hero-логотипа | низький |
| A4 | `minimumCacheTTL` для `_next/image` (зараз `max-age=0, must-revalidate`) | підняти TTL → менше ревалідацій для повторних відвідувачів (польовий, не лабораторний ефект) | низький — `next.config.ts` |
| A5 | AVIF (`formats: ['image/avif','image/webp']`) | ~20% менше за WebP | низький-середній — довше перше кодування, подвоєння кеш-сховища; дока Next радить WebP |

**Правило формулювань:** не називати «виправленням LCP» без доведеного зсуву
медіани mobile LCP ≥ 0.3 с або ≥ 7% у двох збалансованих раундах.

### B. Вага репозиторію та асетів

| # | Дія | Пріоритет |
|---|---|---|
| B1 | Read-only перевірити відсутність посилань, потім видалити невикористані backup/старі зображення (~11 МБ): `*-old-backup.png`, `hero-cars.png`, `hero-cars-logo-final.png`, `hero-cars-logo-updated.png`, `reference-banner.png`, `cars-for-sale-gallery-logo.png`, `cars-for-sale-car.png` | середній (гігієна, швидший clone/білд) |
| B2 | Відео walkaround (`dacia-walkaround.mp4` ~49 МБ + `12-walkaround.mp4` ~7 МБ у `public/`) — стиснути або винести на зовнішній хостинг (Vercel Blob / YouTube unlisted) | **високий**, якщо відео показується на сайті |
| B3 | Фото авто в продажу — пережати вихідні JPG (зараз 1+ МБ, роздільність до 5712 px) | середній |

### C. SEO та зовнішній стан (очікування / рішення власника)

| # | Дія |
|---|---|
| C1 | Дочекатись накопичення даних у Google Search Console та реальних Core Web Vitals (CrUX) — потрібен трафік і час (розділ 15, п. 1, 3) |
| C2 | Favicon у видачі Google оновиться після переобходу — строк не гарантується (розділ 18) |
| C3 | Письмово уточнити в 123 Reg статус `clientRenewProhibited` (розділ 15, п. 4; розділ 17) |
| C4 | Окреме рішення щодо DNSSEC (зараз Disabled) — лише після read-only аудиту authoritative DNS і плану відкату (розділ 15, п. 5; розділ 17) |
| C5 | Розглянути додавання до sitemap окремих сторінок авто в продажу / галерейних проєктів, якщо з'являться |

### D. Функціональні / бізнесові

| # | Дія |
|---|---|
| D1 | Vercel WAF Support case `#01tppcuj583XiPMj` — дочекатись відповіді; рішення щодо Pro-тарифу для дії `Too Many Requests (429)` (зараз rate-limit лише логується, розділ 5) |
| D2 | Перевірка актуальності бізнес-даних власником: телефон, email, WhatsApp, соцмережі, адреса, ціни/наявність авто (значення — у `src/lib/social.ts` та env, не тут) |
| D3 | Локальний `.env.local` містить `NEXT_PUBLIC_FORM_ENDPOINT`, а код читає `CONTACT_FORM_ENDPOINT` (server-only). Production на Vercel працює (форма підтверджена робочою), але локально форма поверне 503; вирівняти назву зі `.env.example` / кодом (це локальний файл, не в git) |
| D4 | Оновити застарілу секцію «Зображення» в `README.md` (згадує `hero-cars.png`, а сайт використовує `hero-cars-logo-final.jpg`) |

### E. Гігієна коду / документації (низький пріоритет)

| # | Дія |
|---|---|
| E1 | `PROJECT_PROGRESS.md` (~337 КБ) і `PROJECT_CURRENT_STATUS.md` — розглянути архівацію старих журналів |
| E2 | `priority` (застарілий у Next 16) на 2 не-DreamLogo `<Image>` — `GalleryProjectModal.tsx`, `CarListingGallery.tsx` — замінити на `loading="eager"` за потреби |
| E3 | Після кожного продуктового PR оновлювати цей файл окремим документаційним PR |

## 20. Резервна копія проєкту

- **2026-09-03:** повний локальний бекап створено поза репозиторієм —
  `~/Desktop/DREAM.CAR.VAVD-backup-20260903-2221/`: `git bundle` усієї
  історії, tar.gz робочого дерева, tar.gz із `public/images`, знімок стану,
  повний аналіз проєкту та звіти сесії. GitHub-репозиторій — повна віддалена
  копія. Ці бекапи не входять до Git.

## 21. PR #17, #18, #19 — злиті й підтверджені на Production (2026-09-05)

Усі три PR пройшли review, злиті через **Squash and merge**, кожен required
CI-check (`Verify (TypeScript, ESLint, tests, build)`) — `success`, кожен
Vercel Production deployment — `success`.

| PR | Тема | Squash-комміт у `main` |
|---|---|---|
| [#17](https://github.com/DreamCar-vavd/DREAM.CAR.VAVD/pull/17) | `perf: reduce logo mask transfer size` | `448acd47cb941681b4fe14d714191e36379f0d41` |
| [#18](https://github.com/DreamCar-vavd/DREAM.CAR.VAVD/pull/18) | `feat: add "go to contacts" CTA to the service modal` | `e59795ae925bdf987ff2c59b3580b1ed23bc14cf` |
| [#19](https://github.com/DreamCar-vavd/DREAM.CAR.VAVD/pull/19) | `feat: pass the selected car listing into the contact form` | `f5846a0a196c28177e9a980339de63b46780cde9` |

Фінальний `main`/Production SHA: **`f5846a0a196c28177e9a980339de63b46780cde9`**.

**Узгодження #19 з `main` після мерджу #18:** виконано звичайним `git merge
origin/main` у гілку `codex/vehicle-contact-cta` (без force-push, без
rebase) — один конфлікт у `src/components/ContactForm.tsx` (розбіжність
формулювання коментаря між service-only і вже об'єднаною версією тексту)
вирішено вручну на користь об'єднаного варіанту, звірено побайтово з раніше
протестованим станом. Після зміни бази PR на `main` "Files changed"
підтверджено чистим — лише 4 автомобільні файли, без повторних змін #18.
Required CI повторно пройдено проти `main` для цього коміту (не замінено
попереднім `workflow_dispatch`).

**Перевірка на Production (`https://dream-car-vavd.com`), після кожного
deployment:**
- Нова CSS-маска логотипу (`dream-logo-mask.png`, 17 705 B) — завантажується
  200 OK, усі 4 інстанси `.dream-logo__shimmer` (шапка/hero/footer) її
  використовують, візуальних відмінностей немає.
- CTA "Замовити консультацію" в модалці послуги — закриває модалку, знімає
  scroll-lock, переходить на `#contacts`, підставляє обрану послугу у форму,
  фокус коректно потрапляє на заголовок "Контакти". Перевірено uk/ru/en.
- CTA "Зв'язатися з нами" для всіх **трьох** автомобілів каталогу
  (`Suzuki SX4 S-Cross`, `Dacia Sandero`, `Dacia Sandero Comfort`) — точна
  назва підставляється в поле форми; поле лишається редагованим, ручний
  ввід зберігається.
- Мобільний viewport (375px) — обидві CTA-кнопки в межах екрана.
- Нових помилок консолі/CSP на Production не виявлено.
- Реальних заявок під час перевірки не надсилалось.

**Ручна перевірка власником:** власник надав дозвіл на послідовний merge на
основі попереднього інтеграційного звіту (сесія 2026-09-05); окремого
підтвердження результатів ручної Safari-перевірки за наданим чеклистом у
чат не надходило — це залишається відкритим пунктом (розділ нижче).

**Залишкові обмеження (не блокують уже змерджену роботу):**
- Реальний Safari (десктоп/iOS) — досі не підтверджено жодною стороною.
- Автозаповнення браузера (не власний JS сайту) — не перевірено.
- Клавіатурна навігація ВСЕРЕДИНІ відкритого нативного `<select>` —
  платформна поведінка браузера, не піддається наявним інструментам
  автоматизації; не є кодом цього проєкту.
- Доставку реальних заявок через форму жоден із цих трьох PR не тестував
  на живому endpoint — усі перевірки payload виконувались виключно через
  mock; за попередніми задачами форма на Production вже підтверджена
  робочою (див. розділ "DREAM.CAR.VAVD contact form live" — не стосується
  саме цих трьох PR).
