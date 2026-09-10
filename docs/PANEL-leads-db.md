# База заявок: підключення (тестове, для Preview)

На цьому етапі — **тільки тестова база** (або окрема тестова гілка Neon-бази)
для **Preview**. Production-змінні НЕ додаються.

## Правило розділення тестових і робочих даних

- **Окрема база (або гілка) для тесту** й **окрема для Production** — різні
  `LEADS_DATABASE_URL`, різні облікові дані. **Не** використовувати той самий
  connection string у Production потім: у тесті будуть синтетичні заявки, у
  Production — реальні персональні дані; змішувати їх не можна.
- Neon: у Console → проєкт → **Branches** → створити гілку `preview` від
  `main` (або окремий проєкт `dream-car-leads-test`). Preview працює з гілкою
  `preview`; Production пізніше — з `main` (окремим кроком, поза цим завданням).

## Два набори прав

| Роль | Права | Де використовується |
|---|---|---|
| **міграційна** (owner / `neondb_owner`) | `CREATE`, `ALTER`, індекси — тобто DDL зі `schema.sql` | лише `npm run leads:migrate`, вручну |
| **застосунку** | лише `SELECT`, `INSERT` на таблиці `leads`; **без** `UPDATE` / `DELETE` / `CREATE` / `DROP` / доступу до інших таблиць | `LEADS_DATABASE_URL` у Vercel |

Створення обмеженої ролі застосунку (виконати міграційною роллю **один раз**):

```sql
CREATE ROLE leads_app LOGIN PASSWORD '<згенерований-пароль>';
GRANT CONNECT ON DATABASE <db> TO leads_app;
GRANT USAGE ON SCHEMA public TO leads_app;
GRANT SELECT, INSERT ON leads TO leads_app;
-- НЕ надавати UPDATE/DELETE: рантайм-адаптер (src/lib/leads/postgres.ts) робить
-- лише SELECT і INSERT ... ON CONFLICT DO NOTHING RETURNING id — звірено із
-- запитами адаптера (задача 16:08, блок 4). Soft-delete deleted_at для
-- політики зберігання — окрема ручна дія власника міграційною роллю.
```

`LEADS_DATABASE_URL` у Vercel = connection string саме ролі `leads_app`
(не owner).

**Точні запити рантайму** (звірка мінімальних прав, `src/lib/leads/postgres.ts`):

| Операція | SQL | Потрібне право |
|---|---|---|
| dedup-перевірка | `SELECT id FROM leads WHERE idempotency_key IN ($1,$2) …` | `SELECT` |
| запис заявки | `INSERT INTO leads (…) VALUES (…) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id` | `INSERT` |
| re-select при гонці | `SELECT id FROM leads WHERE idempotency_key = $1` | `SELECT` |
| список | `SELECT … FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT $n` | `SELECT` |
| лічильник | `SELECT count(*) FROM leads WHERE deleted_at IS NULL` | `SELECT` |
| одна заявка | `SELECT … FROM leads WHERE id = $1 AND deleted_at IS NULL` | `SELECT` |

`id` — `gen_random_uuid()` за замовчуванням (не sequence), `created_at` — `now()`;
окремих прав на sequence не треба.

## TLS і спосіб зʼєднання

- Обовʼязково `?sslmode=require` наприкінці connection string (Neon вимагає
  TLS; адаптер `pg` це поважає).
- Пул адаптера: `max: 3`, таймаути 5–10 с (уже в `src/lib/leads/postgres.ts`).
  Для Neon serverless цього достатньо; за потреби пізніше — Neon pooler-URL
  (`-pooler` у хості).

## Пароль — НЕ в історію shell

`LEADS_DATABASE_URL` містить пароль. **Не** запускати
`LEADS_DATABASE_URL="postgres://user:pass@…" npm run leads:migrate` — пароль
осяде в `~/.zsh_history`. Замість цього:

1. Створити локальний файл поза Git (він у `.gitignore` — `*.env*`, крім
   `.env.example`):
   ```
   # .env.migrate  (не комітиться)
   LEADS_DATABASE_URL=postgresql://OWNER:PASSWORD@HOST/DB?sslmode=require
   ```
2. Запустити з нього:
   ```bash
   set -a; source .env.migrate; set +a
   npm run leads:migrate
   unset LEADS_DATABASE_URL
   ```
   або одноразово: `env $(cat .env.migrate | xargs) npm run leads:migrate`
   (теж не потрапляє в історію як аргумент з паролем).
3. Видалити `.env.migrate` після міграції, якщо він більше не потрібен.

Для Vercel — вставляти connection string **лише в поле Value змінної**
`LEADS_DATABASE_URL` (Environment = Preview, Branch = `codex/admin-panel-spike`),
**не** в чат / Git / звіт.

## Перевірка міграції та повторний запуск

`npm run leads:migrate`:
- `schema.sql` — увесь `CREATE TABLE / INDEX IF NOT EXISTS` + `CREATE UNIQUE
  INDEX IF NOT EXISTS`, **без** `DROP`, **без** зміни даних → **ідемпотентний**,
  безпечно запускати повторно;
- наприкінці виводить колонки таблиці `leads` — звірити з очікуваними
  (`id, created_at, name, phone, email, service, vehicle, message,
  idempotency_key, deleted_at`).

Після підключення на Preview:
- `/panel/leads` → блок «Сховище заявок не налаштоване» **зникає**, список
  порожній («Заявок поки немає») (на hosted-Preview демо-банера не було);
- надіслати синтетичну заявку через форму на Preview → з'являється рядок;
- надіслати її **ще раз одразу** → **новий рядок не з'являється**
  (ідемпотентність);
- сценарії А–Д — `src/lib/leads/deliver.ts` + тести.

## Скасування без видалення даних

- **Зупинити інтеграцію:** прибрати `LEADS_DATABASE_URL` у Vercel Preview →
  **redeploy** → `/panel/leads` знову показує «Сховище заявок не налаштоване»
  (у hosted) або демо (локально). Дані в Neon **лишаються**.
- **Ротація пароля ролі застосунку:** `ALTER ROLE leads_app PASSWORD '<новий>';`
  → оновити `LEADS_DATABASE_URL` у Vercel → redeploy. Старий рядок більше не
  діє.
- Прибирання env ≠ ротація доступу: якщо пароль десь засвітився — треба саме
  `ALTER ROLE … PASSWORD`, не лише видалення змінної.
- **Видалення даних / бази** — окрема руйнівна дія, **не** входить у це
  завдання й не виконується як «звичайне скасування».

---

# ПАКЕТ РІШЕННЯ — Б3: БД заявок (наступний етап підключення)

**Статус:** підготовлено (задача 15:26). **Не підключено** — потрібне рішення й
дії власника. Обрано як наступний етап: найменша залежність (одна змінна),
чиста користь, код готовий, жодного дотику до `main`/Production/публікації.

## 1. Результат для бізнесу

Зараз заявки з форми йдуть на email (Formspree) — працює, але їх **не видно в
панелі**. На hosted-Preview/Production `/panel/leads` показує «Сховище заявок
не налаштоване» (не демо — демо-рядки лишень у локальному dev або за явним
`LEADS_DEMO_MODE=1`; звірено задачею 16:08, блок 2). Після Б3 власник бачить
**реальні заявки** списком у `/panel/leads` (ім'я, телефон, email, послуга,
авто, повідомлення, час) — одне місце для всіх звернень, з пагінацією й без
дублів від повторних надсилань форми. Email-сповіщення лишається як є.

## 2. Що вже готове в коді (нічого писати не треба)

| Файл | Що робить |
|---|---|
| `src/lib/leads/schema.sql` | `CREATE TABLE leads` + 2 індекси, усе `IF NOT EXISTS` (ідемпотентно) |
| `src/lib/leads/postgres.ts` | `pg`-пул (`max: 3`, таймаути 5–10 с), поважає `?sslmode=require` |
| `src/lib/leads/store.ts` | `resolveLeadsMode()` → `database` \| `demo` \| `not-configured`; `PostgresLeadsStore` — keyset-пагінація `(created_at DESC, id)`, `INSERT … ON CONFLICT DO NOTHING` |
| `src/lib/leads/idempotency.ts` | `deriveIdempotencyKeys()` → `{current, previous}` (повтор на межі 10-хв бакета не дублює) |
| `src/lib/leads/deliver.ts` | `/api/contact` пише рядок best-effort **перед** email; без PII в логах |
| `src/app/panel/leads/page.tsx` | сторінка списку — dynamic + `no-store` + за storage-session-гейтом |
| `scripts/leads-migrate.mjs` (`npm run leads:migrate`) | застосовує `schema.sql`, наприкінці друкує колонки таблиці |
| Тести | `src/lib/leads/{store,postgres,idempotency}.test.ts` — контракт mode/пагінації/ідемпотентності (в CI) |

## 3. Що залишилося (лише інфраструктура + жива перевірка)

1. Створити **тестову** БД Neon (окремий проєкт `dream-car-leads-test` або гілку
   `preview`) — Production-база пізніше, окремо.
2. Прогнати міграцію (`npm run leads:migrate` з локального `.env.migrate`).
3. Створити обмежену роль застосунку `leads_app` (SQL у розділі «Два набори
   прав» вище).
4. Додати `LEADS_DATABASE_URL` (рядок ролі `leads_app`) у Vercel → Environment
   **Preview**, Branch **`codex/admin-panel-spike`**.
5. Redeploy Preview; прогнати перевірку успіху (розділ 6).

## 4. Точні назви (без значень)

- **Змінна середовища:** `LEADS_DATABASE_URL` (Vercel Preview, гілка
  `codex/admin-panel-spike`). Формат: `postgresql://leads_app:PASSWORD@HOST/DB?sslmode=require`.
- **Допоміжна (лише локально, не в Vercel):** `LEADS_DEMO_MODE=1` — вмикає
  демо-режим у dev; у hosted без `LEADS_DATABASE_URL` показує «Сховище заявок
  не налаштоване», **не** демо.
- **Ролі БД:** `neondb_owner` (міграційна, DDL + ручний soft-delete) і
  `leads_app` (застосунку — лише `SELECT, INSERT` на `leads`, без
  `UPDATE`/`DELETE`/`CREATE`/`DROP`).
- **Таблиця:** `leads` (колонки: `id, created_at, name, phone, email, service,
  vehicle, message, idempotency_key, deleted_at`).
- **Файл поза Git:** `.env.migrate` (у `.gitignore`; видалити після міграції).

## 5. Дії — хто що робить

| Крок | Хто | Дія |
|---|---|---|
| Neon-проєкт/гілка | **власник** | Neon Console → New Project `dream-car-leads-test` (або Branch `preview`). Скопіювати connection string ролі owner. |
| `.env.migrate` | **власник** (локально) або агент за вказівкою | створити файл з owner-рядком, **не** в чат/Git |
| Міграція | агент (за вказівкою) або власник | `set -a; source .env.migrate; set +a; npm run leads:migrate; unset LEADS_DATABASE_URL` — звірити надрукований список колонок |
| Роль `leads_app` | **власник** або агент | виконати SQL зі `CREATE ROLE leads_app …` (розділ «Два набори прав») міграційною роллю |
| `LEADS_DATABASE_URL` у Vercel | **власник** (значення бачить лише власник) | Vercel → Project → Settings → Environment Variables → Add: name `LEADS_DATABASE_URL`, value = рядок `leads_app`, Environment **Preview**, Branch `codex/admin-panel-spike` |
| Redeploy Preview | **власник** (кнопкою) | Vercel → Deployments → Redeploy останнього Preview |
| Жива перевірка | агент | розділ 6 |

Агент **ніколи** не вставляє connection string у чат/Git/звіт; лише в поле
Value змінної (це робить власник) або в локальний `.env.migrate`.

## 6. Перевірка успіху

Після redeploy Preview (авторизована сесія):
1. `/panel/leads` → блок «Сховище заявок не налаштоване» **зник**; список
   порожній («Заявок поки немає»). (На hosted-Preview демо-банера не було —
   до Б3 там саме «не налаштоване».)
2. Надіслати **синтетичну** заявку через форму на Preview (ім'я «ZZZ Test»,
   тестовий телефон/email, повідомлення «DELETE ME») → за кілька секунд рядок
   з'являється у `/panel/leads`.
3. Надіслати ту саму заявку **ще раз одразу** → **новий рядок не з'являється**
   (ідемпотентність по 10-хв бакету).
4. Прибрати тестові рядки: `UPDATE leads SET deleted_at = now() WHERE
   message = 'DELETE ME';` (soft-delete; код ніколи не робить hard-delete) або
   `DELETE` міграційною роллю — це руйнівна дія, робить власник.
5. Звірити: `git status` чистий, `main` @ `ce1977af`, PR #26 draft.

## 7. Витрати й ліміти (офіційно, neon.com, станом на 2026-09)

Джерела: <https://neon.com/faqs/free-plan-limits-and-quotas>,
<https://neon.com/pricing>, <https://neon.com/docs/introduction/plans>.

**Регіон:** обрати при створенні проєкту найближчий до Vercel-деплою й
клієнтів — для автосалону в UK це `AWS eu-west-2 (London)` або
`AWS eu-central-1 (Frankfurt)`. Змінити регіон після створення не можна —
лише новий проєкт.

**Оцінка навантаження (щоб «запас» не був голослівним):**

- Обсяг заявок: 5–15 на день → ~150–450 рядків/місяць → ~2–5 тис./рік.
- Розмір рядка: ~0.5–1 КБ (текстові поля) → ~5 МБ/рік. Ліміт 0.5 ГБ ≈
  **100+ років** записів.
- Compute: один `INSERT` форми ~10–50 мс + перегляди панелі власником
  (кілька на день, кожен ~1–2 с активної БД). Разом < **1 CU-години/місяць**
  проти ліміту 100 → БД майже завжди спить.
- Transfer: килобайти на заявку + сторінки панелі → одиниці МБ/місяць проти
  5 ГБ.

Отже Free-план перекриває реальне навантаження **з дво-тризначним запасом** —
не через маркетинг, а за цим підрахунком.

**Neon Free — $0/місяць:**

| Ресурс | Free | Наш ужиток |
|---|---|---|
| Проєкти | 100 | 1 (тест) + 1 (prod пізніше) |
| Гілки на проєкт | 10 | 1–2 |
| Compute | **100 CU-годин / проєкт / місяць** (≈400 год при 0.25 CU) | майже нуль — БД спить (scale-to-zero через 5 хв, вимкнути не можна), прокидається на запит форми |
| Storage | **0.5 ГБ / проєкт** | рядок заявки ~1 КБ → десятки тисяч рядків вміщаються |
| Мережа (public transfer) | 5 ГБ / проєкт / місяць | мізерно |
| Instant restore | 6 годин історії (до 1 ГБ змін) | достатньо |
| Підтримка | community | — |

**Якщо перевищити Free:** дані **не видаляються**. CU-години вичерпані →
compute призупиняється до наступного періоду або апгрейду; storage > 0.5 ГБ →
`INSERT`/`UPDATE` падають, доки не звільнити місце. Для нашого обсягу це
недосяжно.

**Наступний тариф (якщо колись знадобиться):** Launch — pay-as-you-go,
$0.106/CU-година + $0.35/ГБ-місяць, без місячного мінімуму. Приклад легкого
ужитку в доці Neon: ~$1–5/місяць. Для форми автосалону перехід не потрібен.

## 8. Спосіб відновлення / скасування

- **Зупинити:** прибрати `LEADS_DATABASE_URL` у Vercel Preview → redeploy →
  `/panel/leads` знову «Сховище заявок не налаштоване». Дані в Neon лишаються.
  Код повертається на `resolveLeadsMode()` → `not-configured` без змін.
- **Ротація доступу** (якщо пароль засвітився): `ALTER ROLE leads_app PASSWORD
  '<новий>';` → оновити `LEADS_DATABASE_URL` → redeploy. Прибирання env ≠
  ротація.
- **Контрольна версія коду:** будь-який SHA гілки — адаптери вже в ньому;
  підключення суто через змінну середовища, коду не міняє.
- Видалення бази/даних — окрема руйнівна дія власника, не «звичайне
  скасування».

## 9. Які дозволи ще потрібні

- **Власник:** акаунт Neon (безкоштовний); доступ до Vercel Environment
  Variables проєкту `dream.car.vavd` (є).
- **Агент:** дозвіл виконати `npm run leads:migrate` з локального `.env.migrate`
  (одноразово) і драйвити живу перевірку в браузері власника. Секрети в чат не
  передавати. Production-змінні (`LEADS_DATABASE_URL` для Production) — **поза**
  цим етапом.

## 10. Питання зберігання/видалення — потрібне рішення власника

Ці пункти **не** вирішуються кодом і мають бути погоджені (для тесту не
критично, для Production — обовʼязково перед Б3-prod):

1. **Термін зберігання** активних рядків (пропозиція: 24 міс, далі
   `deleted_at`, ще +6 міс — фізичне видалення). Див. `PANEL-backup-restore.md`.
2. **Хто й як часто** робить `pg_dump` у приватне сховище (пропозиція: власник,
   раз на тиждень).
3. **Місце зберігання дампів** (зашифроване, не в Git).
4. **Видалення на запит субʼєкта даних** (GDPR): процедура —
   `UPDATE … SET deleted_at = now()` + прибрати з наступного дампу.
5. **Production-база** окремо від тестової (різні `LEADS_DATABASE_URL`),
   рішення про регіон і провайдера (Neon / Vercel Postgres).
6. **Чи потрібен експорт у панелі** (кнопка «вивантажити CSV») — зараз коду
   немає, це окремий етап розробки.

Для **тестового Preview-етапу**: пункти 1–4 можна відкласти (синтетичні дані,
`DELETE ME`), але зафіксувати як умову переходу до Production.

---

# Шлях заявки: Production vs Preview (звірка коду, задача 16:08 блок 3)

Звірено з кодом (`src/app/api/contact/route.ts`, `src/lib/leads/store.ts`,
`src/lib/leads/deliver.ts`) — без надсилання форми, без значень env.

## A. Поточний Production (сайт на `main`, гілка коду без БД-адаптера в дії)

```
Форма (src/components/**, клієнт)
  │  POST /api/contact  (JSON)
  ▼
src/app/api/contact/route.ts
  ├─ origin/content-type/honeypot/валідація
  ├─ getWritableLeadsStore()
  │     └─ resolveLeadsMode(): немає LEADS_DATABASE_URL → "not-configured"
  │        → повертає null  →  крок БД ПОВНІСТЮ пропускається
  └─ email-канал: fetch(CONTACT_FORM_ENDPOINT)  →  Formspree  →  пошта власника
                     (redirect:"error", timeout 10 с)
        │
        ▼
   resolveLeadResponse({ hasStore:false, savedToDb:false, email })  →  200 / 502 / 504
```

Наслідок: **на Production заявка ніде не зберігається в БД** — лише email.
`/panel/leads` на Production-хості: «Сховище заявок не налаштоване».

## B. Preview після Б3 (Neon підключено ТІЛЬКИ до Preview)

```
Форма на Preview-деплої
  │  POST /api/contact
  ▼
route.ts  (той самий код, інше середовище)
  ├─ getWritableLeadsStore()
  │     └─ resolveLeadsMode(): LEADS_DATABASE_URL заданий (Vercel → Preview,
  │        Branch codex/admin-panel-spike) → "database"
  │        → createPgLeadsStore(pool)
  │     └─ store.create(input, deriveIdempotencyKeys(input))
  │          INSERT INTO leads … ON CONFLICT DO NOTHING     ← best-effort, try/catch
  │            (помилка → console.warn БЕЗ PII, email далі)
  └─ email-канал: Formspree  →  пошта власника (як і був)
        │
        ▼
   resolveLeadResponse({ hasStore:true, savedToDb, email })  →  200(+code) / 502 / 504

Neon (гілка preview) ──select──►  /panel/leads на Preview  (dynamic, no-store,
                                   за storage-session-гейтом)
```

## Ключове питання: чи побачить панель заявки з ПОТОЧНОГО Production, якщо Neon під'єднано лише до Preview?

**Ні.** Причини, з коду й з моделі Vercel:

1. `LEADS_DATABASE_URL` — змінна **на середовище** (Vercel Environment = Preview,
   Branch = `codex/admin-panel-spike`). Production-деплой (`main`) її не отримує
   → `resolveLeadsMode()` там = `not-configured` → `getWritableLeadsStore()`
   повертає `null` → `route.ts` не робить жодного `INSERT`.
2. Немає іншого маршруту даних: Production `/api/contact` пише лише в email;
   Formspree не має конектора до Neon; `/panel/leads` читає **тільки** свою
   `LEADS_DATABASE_URL` (тобто preview-гілку).
3. Отже заявки з живого сайту в панель **не потраплять**, доки БД не під'єднано
   до Production-середовища окремо (розділ нижче).

Показувати власнику заявки з Production у панелі можна **лише** після окремого
кроку «Б3-prod»: своя Neon-гілка `main`, `LEADS_DATABASE_URL` у Vercel
Environment = **Production**, redeploy Production. Це окреме рішення власника й
поза поточним дозволом.

## Розбивка пакета Б3

| Етап | Що дає | Дозвіл |
|---|---|---|
| **Б3-preview** (цей) | тестова Neon-гілка + `LEADS_DATABASE_URL` у Preview; синтетичні заявки з Preview-форми осідають у панелі; жива перевірка адаптера/ідемпотентності/пагінації | у межах поточного завдання (міграція з `.env.migrate`, жива перевірка) |
| **Б3-prod** (окремо) | окрема Neon-гілка `main` + `LEADS_DATABASE_URL` у Production; реальні заявки з сайту в панелі | **потрібне окреме рішення власника**: створення prod-бази, ротація/зберігання пароля, політика retention/експорту/видалення персональних даних, GDPR-обовʼязки |
| Поза дозволом зараз | зміна `main`, Production env, DNS, тарифів; hard-delete даних; автоматичний retention | — |

---

# Готовність адаптера: звірка поведінки (задача 16:08 блок 4)

Переглянуто `schema.sql`, `scripts/leads-migrate.mjs`, `src/lib/leads/postgres.ts`,
`deriveIdempotencyKeys`, обробку помилок. Наявні тести
(`postgres.test.ts` 11 → 14, `idempotency.test.ts`, `deliver.test.ts`) не
дублюються. Додано лише непокриті випадки.

## Узгодження дизайну з фактичним кодом

- **Коли заявку вважати прийнятою.** Відвідувач отримує `200`, якщо спрацював
  **хоча б один** тривкий канал: БД-рядок існує **або** email пішов. Обидва
  впали → `502`/`504` (`resolveLeadResponse`, сценарії Г). `create()` повертає
  `{id, inserted}`; `inserted:false` на дедуп-збігу теж рахується як
  `savedToDb:true` (рядок уже є) — повторне надсилання не стає помилкою.
- **Що таке «повтор».** Той самий `name|телефон-цифри|email|message` у тому ж
  або сусідньому 10-хв бакеті (вікно 10–20 хв). Повтор **не** створює новий
  рядок — повертає наявний `id`, `inserted:false`. **Email надсилається на
  кожну спробу** незалежно від `inserted` (`route.ts` завжди доходить до
  email-кроку; `idempotency.test.ts` це фіксує). Тобто повторний сабміт за
  15 хв → 1 рядок у БД, але може бути 2 листи — навмисно (email — головний
  канал власника, дедуп лише для тривкої копії).
- **Чи губиться email при збої БД.** Ні. `route.ts` обгортає `leadsStore.create`
  у `try/catch`, ковтає помилку (`console.warn` фіксованим рядком, без PII) і
  **безумовно** виконує email-крок далі. Сценарій В: БД впала + email ок →
  `200 EMAILED_NOT_SAVED`.

## Виправлений дефект: витік деталей підключення в UI/логах

`src/app/panel/leads/page.tsx` раніше рендерив сиру помилку
(`Не вдалося завантажити список: {err.message}`). Повідомлення `pg`/DNS містять
хост/порт/роль/назву БД (`getaddrinfo ENOTFOUND …neon.tech`,
`ECONNREFUSED …:5432`, `password authentication failed for user "leads_app"`).
Тепер: новий `src/lib/leads/loadError.ts` → фіксований текст у панель, у
серверний лог лише коарс-код (`ENOTFOUND`, `28P01`, …). Тести —
`src/lib/leads/loadError.test.ts` (7). Ані `route.ts`, ані адаптер не логують
рядок помилки з деталями.

## Рекомендація (потребує рішення власника, НЕ зроблено)

Адаптер має `connectionTimeoutMillis: 5000`, але **не** має ліміту на
тривалість запиту. Здеградована БД може затримати `/api/contact` на весь
таймаут функції. Пропозиція окремим кроком: додати `statement_timeout`
(через `?options=-c%20statement_timeout%3D4000` у connection string або в
пулі). Не критично для кількох заявок на день; не змінюю в межах цього
завдання.
