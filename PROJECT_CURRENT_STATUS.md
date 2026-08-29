# DREAM.CAR.VAVD — актуальний стан проєкту

Останнє оновлення: **2026-08-29**
Основна робоча копія: **`/Users/apple/Projects/DREAM.CAR.VAVD`**

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
- **Поточна підтверджена контрольна точка (2026-08-29, після merge PR #5):**
  `HEAD = origin/main = 69603763b36828c4fbb3858516c5feab33a65fe9`
  (squash-коміт PR #5, `docs: record GitHub access audit and 2FA`, злито
  `2026-08-29T20:53:15Z`), ahead/behind `0 0`, робоче дерево чисте; локально
  й віддалено залишилась лише `main`. CI на `push` у `main` — run
  `33274634343`, `success`. Production deployment
  `BwmPSyf47tddUeZPaLECNeUyqarC` — `Ready`, `29s`, джерело `main`/`6960376`.
  Деталі аудиту доступу — розділ 7; звуження Vercel repository access —
  розділ 8; практичний PR-тест інтеграції — розділ 9.
- Остання підтверджена контрольна точка перед документаційною корекцією
  Branch Protection: `HEAD = origin/main = 4d30f46ae9bb67f62fee1f9e938eb60870c6d3dd`,
  ahead/behind `0 0`, робоче дерево чисте, активна гілка `main`; локально й
  віддалено залишилась лише `main`.
- Остання підтверджена контрольна точка перед документаційною фіксацією
  Dependabot Security Updates: `HEAD = origin/main = 364bd6127fae0c8a20c9382688cdd4613d2cbcb0`,
  ahead/behind `0 0`, робоче дерево чисте, активна гілка `main`; локально й
  віддалено залишилась лише `main`.
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

- Стан 2FA, Domain Lock, auto-renew і дати завершення домену в 123-reg не
  записувати як завершений без прямої перевірки або підтвердження власника.
- DNSSEC не вмикати без окремого read-only аудиту authoritative DNS,
  підтримки провайдера та плану відкату.

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

1. Read-only аудит Core Web Vitals і фактичної швидкості production.
2. За результатами аудиту — окрема оптимізація фотографій.
3. Окремо — оптимізація відео та кешування.
4. Перевірка актуальності бізнес-даних і контенту власником.
5. Контроль SEO лише за результатами нового аудиту: базові metadata,
   canonical, hreflang, sitemap, robots.txt і JSON-LD вже реалізовані.
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

**GitHub/Vercel access audit завершено повністю (розділ 7), включно з
раніше непідтвердженими деталями PAT, Security keys і Authorized GitHub
Apps. Vercel repository access звужено до одного репозиторію та підтверджено
практичним PR-тестом (розділи 8–9). Preview build incident на PR №5
задокументовано як вирішений, першопричина не доведена (розділ 10). Активна
технічна задача наразі не оголошується. Наступний етап обирає власник
окремим рішенням (розділ 12) — жодна нова технічна зміна не розпочата.**
