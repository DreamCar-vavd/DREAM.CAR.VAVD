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
