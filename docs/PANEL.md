# Панель керування контентом DREAM.CAR.VAVD

Статус: **етап 1 — «Автомобілі»** (draft PR #26, не змерджено).
Повний аналіз, витрати й дії власника: `report/33-admin-panel-stage1.md`
(у теці результатів, поза репозиторієм).

---

## Що це

Веб-панель за адресою **`/keystatic`** на тому самому сайті. Керує вмістом
розділу «Автомобілі в продажу». Контент зберігається у цьому ж репозиторії
(`src/content/cms/cars/*.json` + фото в `public/images/cms/cars/`), тож кожна
зміна має історію Git, а `git clone` = повна резервна копія.

Рушій — [Keystatic](https://keystatic.com) (MIT, безкоштовний).

## Режими

| | Коли | Вхід | Куди пише |
|---|---|---|---|
| **local** | `next dev` на комп'ютері | немає | файли на диску |
| **github** | деплой із `KEYSTATIC_STORAGE_KIND=github` | GitHub OAuth | коміт у гілку → PR |

На деплої **без** `KEYSTATIC_STORAGE_KIND=github` маршрути `/keystatic` та
`/api/keystatic` повертають **404** (локальний режим не має авторизації —
його не можна виставляти публічно).

## Локальна перевірка (доступно вже)

```bash
npm install
npm run dev
# відкрити http://localhost:3000/keystatic
```

Інструкція з редагування — `report/33` §11.

## Увімкнення hosted-панелі (потрібні дії власника)

1. **Створити GitHub App** (Settings → Developer settings → GitHub Apps → New):
   - Homepage URL: `https://dream-car-vavd.com`
   - Callback URL: `https://dream-car-vavd.com/api/keystatic/github/oauth/callback`
   - Request user authorization (OAuth) during installation: **увімкнено**
   - Webhook: **вимкнено**
   - Permissions → Repository:
     - **Contents: Read and write**
     - **Pull requests: Read and write**
     - Metadata: Read (обов'язкове за замовчуванням)
     - решта — **No access**
   - Where can this GitHub App be installed: **Only on this account**
2. **Встановити App** лише на репозиторій `DreamCar-vavd/DREAM.CAR.VAVD`.
3. У Vercel → Project → Settings → Environment Variables (Production + Preview):
   ```
   KEYSTATIC_STORAGE_KIND = github
   KEYSTATIC_GITHUB_CLIENT_ID = <App Client ID>
   KEYSTATIC_GITHUB_CLIENT_SECRET = <згенерований секрет>
   KEYSTATIC_SECRET = <випадковий рядок 32+ символів>
   ```
4. **Помічник:** окремий GitHub-акаунт → додати як collaborator репозиторію з
   роллю **Write** (не Admin). Увімкнути 2FA обом.
5. **Branch protection** на `main`: require PR, require status checks
   `Verify (…)` та `content:check`.
6. Застосувати діф CI з `report/33` §5 (додає крок `content:check`).

Відкликати доступ помічника: прибрати з collaborators + Revoke App
authorization у його GitHub-налаштуваннях.

## Команди

| Команда | Призначення |
|---|---|
| `npm run dev` → `/keystatic` | відкрити панель локально |
| `npm run content:check` | перевірити, чи всі опубліковані авто мають повні UK/EN/RU |
| `npm run content:confirm [id]` | оновити «замок» перекладу після редагування вже перевіреного тексту |
| `npm run cars:migrate` | (одноразово) перенести наявні авто — вже виконано |

## Правило трьох мов

Авто з'являється на сайті лише коли:
- `Стан публікації` = «Опубліковано`, і
- `Статус продажу` ≠ «Продано» / «Готується`, і
- у **кожній** з UK/EN/RU заповнені «назва» + «характеристики`, і
- у **кожній** мові `Стан перевірки` = «Перевірено`, і
- текст не змінювали після перевірки (інакше — `npm run content:confirm`), і
- є хоча б одне фото.

Це перевіряє **статична збірка** — обійти прямим запитом неможливо.
`content:check` і CI — додатковий шар, що показує помилку на PR.
