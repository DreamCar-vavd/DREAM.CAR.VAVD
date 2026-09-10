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

-- Ліміт тривалості запиту — на рівні РОЛІ, лише для runtime-ролі (не Production,
-- не міграційна). Стандартний Postgres GUC, Neon підтримує ALTER ROLE ... SET;
-- діє для direct і pooled endpoint; НЕ потребує зміни коду адаптера.
ALTER ROLE leads_app SET statement_timeout = '4000ms';
ALTER ROLE leads_app SET idle_in_transaction_session_timeout = '10s';
```

Чому `statement_timeout` саме так, а не `?options=` у connection string:
роль-рівневий параметр не залежить від того, як зібрано URL, переживає зміну
пулера, і його видно в `\drds` / `pg_db_role_setting`. `4000 мс` < ліміт
Vercel-функції (`/api/contact`) → здеградована БД не затримує email-канал.
Спосіб звірено з Neon (vanilla Postgres 17 на SQL-рівні; `statement_timeout`
підтверджено в docs Neon для pg_cron/міграцій).

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

**Статус (2026-09-10, задача 20:24): НЕ підключено.** Дозвіл власника є, але
кроки нижче фізично потребують дій, які асистент виконати не може:
- **реєстрація / вхід у Neon** — асистент не створює акаунти й не вводить
  паролі (перевірено: `console.neon.tech` показує екран входу; акаунта немає);
- **`LEADS_DATABASE_URL` у Vercel** — це значення-секрет, вводить лише власник
  у полі Value (Vercel MCP-доступ до проєкту — 403, тобто й через API не можна);
- **connection string** ніколи не потрапляє в чат / команди з видимим виводом /
  логи / Git.

Що асистент **зробив** цієї сесії: звірив умови Neon Free за офіційним джерелом
(нижче), уточнив спосіб `statement_timeout` (розділ «Ліміт тривалості»),
підготував точний runbook власника (розділ 5) і перевірку (розділ 6). Після
кроків власника (Neon-проєкт + `.env.migrate` + Vercel env) асистент виконає
міграцію, створення ролі, синтетичні перевірки й живу звірку.

Обрано як наступний етап: найменша залежність (одна змінна), чиста користь,
код готовий, жодного дотику до `main`/Production/публікації.

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

## 5. Дії — хто що робить (RUNBOOK)

| # | Крок | Хто | Точна дія |
|---|---|---|---|
| 1 | Neon-акаунт | **власник** | <https://console.neon.tech> → Sign up (Google/GitHub/email). Асистент акаунти не створює. |
| 2 | Тестовий проєкт | **власник** | Neon Console → **New Project** → name `dream-car-leads-test`, регіон `AWS eu-west-2 (London)` (або Frankfurt), Postgres 17. **Не** обирати платний план. |
| 3 | Fixed compute | **власник** | проєкт → Branches → `production` → Edit compute → min=max=**0.25 CU** (економія CU-годин). |
| 4 | Connection strings | **власник** | Dashboard → Connect → скопіювати рядок ролі **owner** (`neondb_owner`). Це піде у `.env.migrate` (не в чат). |
| 5 | `.env.migrate` | **власник** (локально в `…/dcv-panel-dev-20260909/repo`) | створити файл (у `.gitignore`): `LEADS_DATABASE_URL=<owner-рядок>?sslmode=require`. Повідомити асистенту лише «готово». |
| 6 | Міграція | **асистент** | `set -a; source .env.migrate; set +a; npm run leads:migrate; unset LEADS_DATABASE_URL` — звірити 10 колонок |
| 7 | Роль `leads_app` + timeout | **асистент** | SQL з розділу «Два набори прав» (owner-рядком). Згенерувати пароль `openssl rand -base64 24`. |
| 8 | `leads_app` рядок | **асистент → власник** | асистент складає рядок `postgresql://leads_app:<pwd>@<host>/<db>?sslmode=require` і **записує у `.env.migrate` поряд**, повідомляє власнику: «рядок у файлі, поле `LEADS_APP_URL`» — **у чат не пише** |
| 9 | Vercel env | **власник** (значення бачить лише власник) | <https://vercel.com> → project `dream.car.vavd` → Settings → Environment Variables → **Add New**: Key `LEADS_DATABASE_URL`, Value = рядок `leads_app` з файлу, Environments = **Preview only**, ✅ "Specific Branches" → `codex/admin-panel-spike` → Save |
| 10 | Redeploy Preview | **власник** | Vercel → Deployments → останній Preview гілки → ⋯ → **Redeploy** (без "use existing build cache") |
| 11 | Синтетична перевірка + прибирання | **асистент** | розділ 6 (B/C/D) |
| 12 | Прибрати `.env.migrate` | **власник або асистент** | після перевірок — `rm .env.migrate` |

Асистент **ніколи** не вставляє жоден connection string у чат / команди з
видимим виводом / логи / Git / звіт — лише в локальний `.env.migrate` та у
запитах до `pg` без echo.

## 6. Перевірка успіху

**НЕ надсилати контактну форму Preview.** Якщо на Preview заданий
`CONTACT_FORM_ENDPOINT`, submit форми відправить **реальний лист** через
Formspree — це поза дозволом. Запис у БД перевіряти прямо через адаптер із
синтетичними даними (нижче), і **окремо зазначити**, що повний цикл форми з
email не перевірявся.

**A. Читання (авторизована сесія, лише перегляд):**
1. `/panel/leads` → блок «Сховище заявок не налаштоване» **зник**; список
   порожній («Заявок поки немає»). (На hosted-Preview демо-банера не було.)

**B. Запис + ідемпотентність (локально, адаптер напряму, синтетичні дані):**
```bash
# .env.migrate тут = рядок leads_app (той самий, що піде у Vercel)
set -a; source .env.migrate; set +a
node --import tsx -e '
  import { getWritableLeadsStore, deriveIdempotencyKeys } from "./src/lib/leads/store";
  const s = await getWritableLeadsStore();
  const inp = { name:"ZZZ Test", phone:"+44 0000 000000", email:"zzz@example.invalid",
                service:"diagnostics", vehicle:"", message:"DELETE ME 20:24" };
  const k = await deriveIdempotencyKeys(inp);
  console.log("create#1", await s.create(inp, k));   // inserted:true
  console.log("create#2", await s.create(inp, k));   // inserted:false — той самий рядок
  const page = await s.list({ limit: 5 });
  console.log("list", page.leads.length, "total", page.total);
'
unset LEADS_DATABASE_URL
```
Очікування: `create#1 { inserted: true }`, `create#2 { inserted: false, id: <той самий> }`,
`list` містить рядок. Різні заявки (інший `message`) → різні ключі → окремі рядки.
3. Після redeploy Preview той самий рядок видно в `/panel/leads` (перегляд).

**C. Помилки не розкривають деталей:** тимчасово вказати недосяжний хост у
`.env.migrate` → `s.list()` кидає; сторінка `/panel/leads` має показати
**фіксований** текст (`leadsListErrorView`), не хост/роль. (Юніт уже покриває —
`loadError.test.ts`; жива звірка додатково.)

**D. Прибирання:** прибрати створені тестові рядки —
`UPDATE leads SET deleted_at = now() WHERE message LIKE 'DELETE ME%';`
(soft-delete) або `DELETE` міграційною роллю. Звірити, що `/panel/leads` знову
порожній.
5. Звірити: `git status` чистий, `main` @ `ce1977af`, PR #26 draft.

## 7. Витрати й ліміти (офіційно, neon.com — звірено 2026-09-10)

Джерела: <https://neon.com/faqs/free-plan-limits-and-quotas>,
<https://neon.com/pricing>, <https://neon.com/docs/introduction/plans>.
Умови станом на 2026-09-10 не змінилися відносно запису задачі 15:26.

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
| Autoscaling | до 2 CU (≈8 ГБ RAM) | тест тримати фіксовано 0.25 CU |
| Storage | **0.5 ГБ / проєкт** | рядок заявки ~1 КБ → десятки тисяч рядків вміщаються |
| Мережа (public transfer) | 5 ГБ / проєкт / місяць | мізерно |
| Instant restore | 6 годин історії (до 1 ГБ змін) + 1 ручний snapshot | достатньо для тесту |
| Моніторинг | 1 день історії | — |
| Підтримка | community | — |

Скидається щомісяця: CU-години й transfer. Постійні ліміти (не помісячні):
проєкти, гілки, storage.

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

## 9. Хто що може — межа асистента

- **Тільки власник** (асистент не має права): створення/вхід у Neon-акаунт
  (створення акаунтів, введення паролів — заборонено), додавання/зміна env у
  Vercel (значення-секрет; MCP-доступ до проєкту — 403).
- **Асистент** (у межах дозволу задачі): міграція `npm run leads:migrate` з
  `.env.migrate`, `CREATE ROLE`/`GRANT`/`ALTER ROLE` синтаксисом розділу «Два
  набори прав», синтетичні `create`/`list` через адаптер, жива звірка
  `/panel/leads` в авторизованому браузері. Секрети — лише у `.env.migrate`.
- **Поза цим етапом:** будь-що для Production (`LEADS_DATABASE_URL` у Production,
  redeploy `main`) — окремий запит (кінець файлу).

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

## A. Поточний Production (сайт на `main`)

**Звірено на `origin/main` (задача 20:24 блок 6): у `main` НЕМАЄ жодного файлу
панелі / Keystatic / leads.** `git ls-tree -r origin/main` — 0 збігів на
`panel|keystatic|leads` (164 файли всього). `main`-версія
`src/app/api/contact/route.ts`:

```
Форма (src/components/**, клієнт)
  │  POST /api/contact  (JSON)
  ▼
src/app/api/contact/route.ts  (версія main — БЕЗ кроку БД)
  ├─ origin/content-type/honeypot/валідація
  ├─ resolveAllowedEndpoint(CONTACT_FORM_ENDPOINT)  → нема → 503
  └─ fetch(endpoint)  →  Formspree  →  пошта власника (redirect:"error", 10 с)
        │
        ▼
   200 { ok:true }  /  502  /  504
```

`main` не імпортує `@/lib/leads/*`, не викликає `getWritableLeadsStore`,
`deriveIdempotencyKeys`, `resolveLeadResponse`. Немає `/panel/leads`. Немає
`keystatic.config.ts`.

Наслідок: **на Production заявка ніде не зберігається** — лише email через
Formspree. `LEADS_DATABASE_URL` на Production **не мав би ефекту** — код, який
його читає, у `main` відсутній.

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

**Ні.** Причини, з коду `main` і з моделі Vercel:

1. **Коду немає.** У `main` відсутній весь subsystem заявок-у-БД (розділ A):
   немає `src/lib/leads/*`, немає кроку БД у `/api/contact`, немає
   `/panel/leads`. Навіть якщо додати `LEADS_DATABASE_URL` у Production env —
   його нічим прочитати.
2. `LEADS_DATABASE_URL` — змінна **на середовище** (зараз буде Vercel
   Environment = Preview, Branch = `codex/admin-panel-spike`). Production-деплой
   `main` її не отримує, і навіть отримавши — див. п.1.
3. Немає іншого маршруту даних: Production `/api/contact` пише лише в email;
   Formspree не має конектора до Neon; `/panel/leads` (на Preview) читає
   **тільки** свою `LEADS_DATABASE_URL`.

Отже заявки з живого сайту в панель **не потраплять** без окремого етапу
«Б3-prod».

## Розбивка пакета Б3

| Етап | Що дає | Що потрібно |
|---|---|---|
| **Б3-preview** (цей) | тестова Neon-БД + `LEADS_DATABASE_URL` у Preview; синтетичні заявки осідають у панелі; жива перевірка адаптера/ідемпотентності/помилок | Neon-акаунт власника, `.env.migrate`, Vercel env (Preview), 1 redeploy. Асистент: міграція + роль + синтетичні перевірки |
| **Б3-prod** (окремо, поза поточним дозволом) | реальні заявки робочого сайту в панелі | **(a)** доставити код у `main`: `src/lib/leads/*`, `/panel/leads` route + його гейт, зміну `/api/contact` (крок БД), і залежності панелі, яких вимагає `keystaticEnabled`/`getStorage`. Практично — це merge PR #26 або виділення підмножини. **(b)** окрема Production Neon-БД (не тестова) + `LEADS_DATABASE_URL` у Vercel Environment = Production. **(c)** redeploy `main`. **(d)** GDPR: retention, дампи, видалення на запит (розділ 10). **(e)** рішення про регіон/провайдера prod-БД |
| Поза дозволом зараз | зміна `main`, Production env, Production deploy, DNS, тарифів; hard-delete даних; автоматичний retention | — |

**Один наступний запит власнику після Б3-preview** — див. кінець файлу.

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

## Ліміт тривалості SQL-запиту (задача 20:24 — рішення прийнято)

Адаптер має `connectionTimeoutMillis: 5000`, але не має ліміту на тривалість
запиту — здеградована БД могла б затримати `/api/contact` на весь таймаут
функції. **Рішення:** параметр рівня ролі, БЕЗ зміни коду адаптера —
`ALTER ROLE leads_app SET statement_timeout = '4000ms'` (+ `idle_in_transaction`),
виконати при створенні ролі (SQL у розділі «Два набори прав»). Діє лише для
тестової runtime-ролі; Production і міграційна роль не зачеплені. Спосіб
сумісний із Neon (vanilla Postgres на SQL-рівні) і з наявним `pg`-пулом
(параметр приходить із сесією, коду читати не треба).

---

# ЗАПИТ ВЛАСНИКУ — наступний етап після Б3-preview (Б3-prod)

**Не виконувати зараз.** Це окреме рішення; нижче — усе, щоб його ухвалити.

**Результат для бізнесу:** реальні заявки з робочого сайту `dream-car-vavd.com`
видно списком у панелі (одне місце, пагінація, без дублів), паралельно з
наявними листами.

**Область змін:**
1. **Код у `main`.** Зараз весь subsystem заявок є лише в PR #26. Варіанти:
   (a) domerge PR #26 цілком (уся панель); (b) виділити мінімальний зріз
   (`src/lib/leads/*`, `/panel/leads` + гейт, крок БД у `/api/contact`,
   `keystaticEnabled`/`getStorage` залежності) в окремий PR. Оцінити разом.
2. **Окрема Production Neon-БД** (не тестова гілка) — свій проєкт або гілка
   `main`, своя роль `leads_app`, свій `LEADS_DATABASE_URL`.
3. **Vercel:** `LEADS_DATABASE_URL` у Environment = **Production**.
4. **Redeploy `main`.**

**Перевірки перед вмиканням:** ті самі, що для Preview (розділ 6) — на
Production-БД, синтетичною заявкою, потім прибрати. Плюс: `content:guard`,
`next build`, CI на PR коду.

**Витрати:** Neon Free покриває й Production-обсяг автосалону (розділ 7) —
$0/місяць. Якщо колись обсяг зросте — Launch pay-as-you-go (~$1–5/місяць).
Vercel-тариф не потрібен (Blob — окреме питання Б2).

**Відновлення / скасування:** прибрати `LEADS_DATABASE_URL` з Production →
redeploy → сайт повертається до email-only. Дані в Neon лишаються (`pg_dump` /
Neon PITR). Відкат коду — revert PR у `main`.

**Рішення власника, яких бракує (розділ 10):** термін зберігання, розклад
дампів, місце дампів, процедура GDPR-видалення, регіон prod-БД.
