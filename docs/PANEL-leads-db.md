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
| **застосунку** | лише `SELECT`, `INSERT`, `UPDATE (deleted_at)` на таблиці `leads`; **без** `CREATE` / `DROP` / доступу до інших таблиць | `LEADS_DATABASE_URL` у Vercel |

Створення обмеженої ролі застосунку (виконати міграційною роллю **один раз**):

```sql
CREATE ROLE leads_app LOGIN PASSWORD '<згенерований-пароль>';
GRANT CONNECT ON DATABASE <db> TO leads_app;
GRANT USAGE ON SCHEMA public TO leads_app;
GRANT SELECT, INSERT ON leads TO leads_app;
GRANT UPDATE (deleted_at) ON leads TO leads_app;
```

`LEADS_DATABASE_URL` у Vercel = connection string саме ролі `leads_app`
(не owner).

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
- `/panel/leads` → банер «Демонстраційні дані» **зникає**, список порожній
  («Заявок поки немає»);
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
панелі**: `/panel/leads` показує демо-дані. Після Б3 власник бачить **реальні
заявки** списком у `/panel/leads` (ім'я, телефон, email, послуга, авто,
повідомлення, час) — одне місце для всіх звернень, з пагінацією й без дублів
від повторних надсилань форми. Email-сповіщення лишається як є.

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
- **Ролі БД:** `neondb_owner` (міграційна, DDL) і `leads_app` (застосунку —
  `SELECT, INSERT` на `leads` + `UPDATE (deleted_at)`, без `CREATE`/`DROP`).
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
1. `/panel/leads` → банер «Демонстраційні дані» **зник**; список порожній
   («Заявок поки немає»).
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

**Neon Free — $0/місяць.** Для форми автосалону (кілька заявок на день)
достатньо з великим запасом:

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
