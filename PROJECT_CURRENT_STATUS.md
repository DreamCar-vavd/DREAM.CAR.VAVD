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
  2FA, — розділ 7.
- Recovery-коди, TOTP-секрети й паролі не передавати асистентам і не
  вставляти в чат.

## 7. GitHub — аудит доступу та автентифікації (завершено)

Read-only аудит виконано `2026-08-29` через офіційний GitHub UI та `gh api`
(лише GET-запити), без зміни жодного налаштування.

**2FA:** Enabled. Preferred method — Authenticator app; метод — Google
Authenticator, статус **Configured**; recovery codes налаштовані, власник
підтвердив їх безпечне збереження (роздруковані, перевірені; завантажений
незахищений файл recovery codes видалено остаточно). Самі коди, QR-код,
setup key і TOTP-коди ніде не записувались і не переглядались асистентом.
SMS — не додано. GitHub Mobile — не додано. Passkey — не додано. **Стан
Security keys не підтверджений однозначно** — кнопка `Edit` на сторінці не є
достатнім доказом наявності чи відсутності ключа.

**Активні сеанси:** 1 поточний очікуваний сеанс; підозрілих сеансів не
виявлено. IP та інші приватні значення в цьому файлі не записуються.

**Fine-grained PAT:** 1 токен, безпечна назва "DreamCar Git Push"; статус на
момент аудиту — `Never used`; строк дії — **2026-09-24**. **Точні
permissions і repository scope підтвердити не вдалось** — сторінка деталей
не відкрилась одним кліком, повторно не форсувалось. Значення токена не
переглядалось і не записувалось.

**Classic PAT:** 0.

**SSH keys:** 0. **GPG keys:** 0.

**Authorized OAuth Apps (2):** `GitHub CLI` — офіційний, owned by github,
використовувався; `Visual Studio Code` — офіційний, owned by
Visual-Studio-Code, на момент аудиту `Never used`. Доступи не відкликались і
не змінювались.

**Authorized GitHub Apps (акаунт, 4):** `Claude`, `Copilot Chat App`,
`Mem0`, `Vercel`. **На рівні репозиторію `DREAM.CAR.VAVD` встановлено лише
`Vercel`.** Детальні permissions кожного застосунку не перевірялись —
безпечність не визначається лише назвою чи видавцем.

**Collaborators:** 0; pending invitations — 0; доступ на запис має лише
власник.

**Deploy keys:** 0.

**Webhooks:** 0 на репозиторії; інтеграція з Vercel працює через GitHub App,
а не через класичний webhook.

**GitHub CLI (`gh`):** автентифікація чинна, окрема OAuth-авторизація (не
той самий механізм, що fine-grained PAT вище). Значення OAuth-токена не
переглядалось і не записувалось.

## 8. Потребує окремої перевірки, а не припущення

- Точні permissions і repository scope fine-grained PAT "DreamCar Git Push"
  (розділ 7) — не підтверджено, потребує перегляду власником через UI.
- Фактична наявність або відсутність Security keys на GitHub-акаунті
  (розділ 7) — не підтверджено однозначно.
- Детальні permissions кожного Authorized GitHub App (`Claude`,
  `Copilot Chat App`, `Mem0`, `Vercel`) — не перевірялись.
- Стан 2FA, Domain Lock, auto-renew і дати завершення домену в 123-reg не
  записувати як завершений без прямої перевірки або підтвердження власника.
- DNSSEC не вмикати без окремого read-only аудиту authoritative DNS,
  підтримки провайдера та плану відкату.

## 9. Наступні покращення — не блокують поточну роботу сайту

Ці пункти не можна називати незавершенням працездатності сайту. Виконувати
лише окремими етапами після завершення GitHub-захисту та рішення щодо WAF:

1. Read-only аудит Core Web Vitals і фактичної швидкості production.
2. За результатами аудиту — окрема оптимізація фотографій.
3. Окремо — оптимізація відео та кешування.
4. Перевірка актуальності бізнес-даних і контенту власником.
5. Контроль SEO лише за результатами нового аудиту: базові metadata,
   canonical, hreflang, sitemap, robots.txt і JSON-LD вже реалізовані.
6. Моніторинг доступності сайту, кодів відповіді `/api/contact` без PII,
   доставки заявок, Formspree quota, строку домену та строку PAT.
7. Фінальний production-аудит після всіх погоджених змін.

## 10. Правила безпечної роботи

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

## 11. Наступна одна дія

**Branch Protection для `main` завершено, підтверджено через read-only API
та практично перевірено через PR #1, PR #2 і PR #3 (розділи 2–3). Dependabot
read-only аудит завершено; Dependabot Security Updates увімкнено й
підтверджено трьома незалежними джерелами (розділ 4). GitHub 2FA увімкнено,
а повний read-only аудит доступу та автентифікації GitHub завершено (розділ
7) — залишились лише три вузькі непідтверджені деталі (розділ 8). Службові
гілки видалені локально й на GitHub; локально та віддалено залишилась лише
`main`. Активна технічна задача наразі не оголошується. Passkey, security
key та GitHub Mobile свідомо не налаштовувались — окреме майбутнє рішення,
не розпочато. Не переходити до Vercel/WAF, DNS чи performance без окремого
рішення.**
