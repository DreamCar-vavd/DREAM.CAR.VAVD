# Сценарій реального запису + тестової публікації (на окреме погодження)

**Статус: НЕ виконувати.** Це підготовлений план для наступного етапу. Виконання —
лише після (а) зеленої Preview-збірки з github-env, (б) пройденого входу/читання/
виходу на Vercel Preview, (в) окремого «так» власника саме на цей сценарій.

Межі: тільки гілка `codex/admin-panel-spike`. Production, `main`, DNS, тарифи,
права доступу, workflow перенесення контенту — не чіпати.

Схему звірено з `keystatic.config.ts` (services — з рядка 336) і `serviceGate.ts`
станом на `80f8167`.

---

## 0. Чому цей сценарій не потрапляє в `main`

Розмежовано на три рівні.

### 0.1. Підтверджені обмеження (перевірено)

| Обмеження | Джерело (перевірено) |
|---|---|
| `/panel` та посилання редагування завжди прив'язані до гілки цього deployment | `src/lib/content/panelStore.ts` — `keystaticBase(branch)` = `/keystatic/branch/<branch>`; `editHrefFor`/`createHrefFor` вживають її. На Vercel Preview `branch` = `VERCEL_GIT_COMMIT_REF` = `codex/admin-panel-spike` |
| `/panel` не має тихого fallback на `main` | `src/lib/content/store/branch.ts` — `resolveContentBranch` повертає `{branch:null}` (→ `NotConnectedError`), якщо ні `PANEL_CONTENT_BRANCH`, ні `VERCEL_GIT_COMMIT_REF` не задані. Гілки `"main"` у коді нема |
| Запис контенту йде комітом у робочу гілку, без PR/merge/dispatch | `src/lib/content/store/github.ts` — `PUT /repos/{o}/{r}/contents/{file}` з полем `branch: this.cfg.branch`; інших ендпойнтів запису нема |
| Прямий push у `main` заборонено **всім, включно з адміністраторами** | GitHub → Settings → Branches → правило `main` (`branch_protection_rules/81941201`, звірено 2026-09-08): **Require a pull request before merging** = увімкнено; **Do not allow bypassing the above settings** = увімкнено; Allow force pushes / Allow deletions = вимкнено |
| Merge PR у `main` вимагає зеленого чеку | те саме правило: **Require status checks** → `Verify (TypeScript, ESLint, tests, build)` |
| `content-guard.yml` (авто-перенесення published-знімка в `main`) — **не активний** | лежить у `.github/workflows-proposed/content-guard.yml`; GitHub виконує лише файли з `.github/workflows/`. У `.github/workflows/` — тільки `ci.yml` |

### 0.2. Процедурні домовленості (не технічний бар'єр)

- Правило `main` **не** вимагає стороннього рев'ю (Require approvals — вимкнено).
  Тобто власник **технічно може** сам відкрити PR у `main` і сам його змержити,
  щойно `Verify` зелений. Захист від цього — домовленість «PR #26 лишається
  draft, merge не робимо», а не заборона GitHub.
- Активація `content-guard.yml` (перенести файл у `.github/workflows/` +
  налаштувати ruleset) — окреме рішення Б4, поза цим сценарієм.

### 0.3. Неперевірені можливості (перевірити під час hosted-тесту, не зараз)

- **Чи можна в самому редакторі Keystatic вибрати гілку `main`.** Посилання з
  `/panel` — branch-scoped, у `main` не ведуть. Але власний перемикач гілок
  Keystatic (github-режим) технічно перелічує всі гілки. Очікування: спроба
  зберегти в захищену `main` → GitHub відхиляє прямий push (правило 0.1), Keystatic
  за такого сценарію зазвичай пропонує створити нову гілку. **Руками не
  перевірено** — крок для hosted-протоколу.
- Перед сценарієм і після нього: `git rev-parse origin/main` — **однаковий SHA**
  (зараз `ce1977af`). Це фактична контрольна перевірка, а не припущення.

---

## 1. Один синтетичний матеріал — точний зразок

- **Колекція:** Послуги (`services`).
- **Робочий файл:** `src/content/cms/services/zzz-test-panel.json` (гілка
  `codex/admin-panel-spike`).
- **Публічна адреса після публікації:** `/services/zzz-test-panel` (Preview-хост).
- Ключі об'єкта — рівно як у наявних послугах: `id, order, status, iconSrc,
  priceAmount, priceCurrency, photos, uk, en, ru`.
- Кожен мовний блок (`uk`/`en`/`ru`) має ключі: `title, shortDescription,
  longDescription, cardDescription, bullets, modalLead, modalDescription,
  modalSections, priceNote, seoTitle, seoDescription`.

**Що робить матеріал придатним до публікації** (`serviceGate.ts`):
- `id` відповідає `^[a-z0-9]+(?:-[a-z0-9]+)*$` — `zzz-test-panel` ✔;
- `priceAmount` — порожній рядок або `^\d+(\.\d{1,2})?$` — беремо **порожній**;
- для **кожної** з uk/en/ru: `title`, `shortDescription`, `longDescription`
  непорожні **і** мова має статус `reviewed` (хеш підтвердження збігається);
- `photos` для публікації **не обов'язкові** (додаються окремо в кроці 3).

**Мінімальний придатний зразок** (лишити в документації; на сайті не створювати):

```json
{
  "id": "zzz-test-panel",
  "order": 999,
  "status": "coming-soon",
  "iconSrc": "",
  "priceAmount": "",
  "priceCurrency": "",
  "photos": [],
  "uk": {
    "title": "ZZZ Тест панелі — видалити",
    "shortDescription": "Тимчасовий матеріал для перевірки запису. DELETE ME.",
    "longDescription": "Створено під час hosted-перевірки панелі на гілці codex/admin-panel-spike. Підлягає видаленню одразу після тесту.",
    "cardDescription": "",
    "bullets": [],
    "modalLead": "",
    "modalDescription": "",
    "modalSections": [],
    "priceNote": "",
    "seoTitle": "",
    "seoDescription": ""
  },
  "en": {
    "title": "ZZZ Panel test — delete",
    "shortDescription": "Temporary item to verify writes. DELETE ME.",
    "longDescription": "Created during hosted panel verification on branch codex/admin-panel-spike. To be deleted right after the test.",
    "cardDescription": "",
    "bullets": [],
    "modalLead": "",
    "modalDescription": "",
    "modalSections": [],
    "priceNote": "",
    "seoTitle": "",
    "seoDescription": ""
  },
  "ru": {
    "title": "ZZZ Тест панели — удалить",
    "shortDescription": "Временный материал для проверки записи. DELETE ME.",
    "longDescription": "Создан во время hosted-проверки панели на ветке codex/admin-panel-spike. Подлежит удалению сразу после теста.",
    "cardDescription": "",
    "bullets": [],
    "modalLead": "",
    "modalDescription": "",
    "modalSections": [],
    "priceNote": "",
    "seoTitle": "",
    "seoDescription": ""
  }
}
```

Створювати матеріал під час тесту — тільки через Keystatic (Послуги → Create →
заповнити три мови → Save). Керований JSON вище — лише еталон для звірки коміту.

## 2. Мовні підтвердження після редагування

1. Після Save у Keystatic відкрити `/panel` → картка `zzz-test-panel`:
   **3 мови «Потребує перевірки»** (`needs-review` — хеша ще немає).
2. «Позначити перевіреним» для uk, ru, en → статус картки **«Перевірено»**;
   кнопка «Опублікувати» стає активною (`blockers` порожній).
3. У Keystatic змінити `uk.shortDescription` (додати крапку) → Save.
4. Оновити `/panel` → **тільки `uk`** знову «Потребує перевірки»; `ru`/`en`
   лишаються «Перевірено».
   Підстава: у хеш підтвердження входять `title, shortDescription,
   longDescription, cardDescription, bullets, modalLead, modalDescription,
   modalSections, priceNote, seoTitle, seoDescription` (`serviceConfirmedText`);
   зміна будь-якого з них у одній мові скидає підтвердження **саме тієї** мови.
   `priceAmount`/`priceCurrency` у хеш **не** входять — зміна суми переклад не
   скидає (окремий підпункт для перевірки: змінити `priceAmount` на `60` і
   переконатися, що статуси мов не змінилися).

## 3. Фото й актуальна чернетка

1. У Keystatic → картка `zzz-test-panel` → «Фотографії» → додати **одне**
   зображення. Завантажити JPG ~200–500 КБ.
2. Очікуваний запис у гілці `codex/admin-panel-spike`:
   - файл: `public/images/cms/services/zzz-test-panel/photos/0/image.jpg`
     (шаблон Keystatic `<publicPath>/<slug>/<array-field>/<index>/<field-key>.<ext>`,
     як у наявних `src/content/cms/gallery/*` →
     `/images/cms/gallery/showcase-01/photos/0/image.jpg`);
   - у JSON: `"photos": [{ "image": "/images/cms/services/zzz-test-panel/photos/0/image.jpg", "caption": "" }]`.
3. Позначити нову мову/картку перевіреною (якщо додавання фото зробило потрібним),
   потім опублікувати цю ревізію в кроці 4 **або** перевірити чернетку до
   публікації:
4. `/panel` → «Переглянути чернетку на сайті»:
   - відкривається **на Preview-хості**
     `dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`;
   - показує `zzz-test-panel` і нове фото, яких **немає** в опублікованій версії;
   - URL/cookie draft-preview **не** веде на `127.0.0.1` і не на Production-домен.

## 4. Тестова публікація за конкретним SHA

1. `/panel` → картка `zzz-test-panel` → «Опублікувати зміни».
2. Очікується: у гілці `codex/admin-panel-spike` оновлюється
   `src/content/cms/published.json` (ключ `services` містить `zzz-test-panel`);
   банер `/panel` показує стан збірки Preview і текст «на тестовому сайті гілки
   «codex/admin-panel-spike»» (не «в ефірі (Production)»).
3. Звірити: SHA у банері = HEAD гілки `codex/admin-panel-spike` після коміту
   публікації (GitHub → Commits).
4. `git rev-parse origin/main` — **без змін** (`ce1977af`).

## 5. Конфлікт двох сесій — відтворюваний варіант

Мета — перевірити саме **конфлікт версій** (`ConflictError`), не заблоковану
кнопку й не відмову через неперевірену мову.

1. **Передумова:** `zzz-test-panel` уже опублікований (крок 4) і всі 3 мови
   «Перевірено», тобто в обох сесіях кнопка «Опублікувати зміни» **активна**.
2. Сесія **A** і сесія **B** — два вікна одного браузера (або звичайне +
   інкогніто) під **тим самим** обліковим записом власника. Обидві відкривають
   `/panel`, бачать `zzz-test-panel` у стані «Перевірено», версії робочих карток
   однакові. Зафіксувати `versions.service` / `versions.review` кожної сесії
   (вони рівні).
3. У сесії **A**: змінити `uk.longDescription` у Keystatic → Save → у `/panel`
   знову «Позначити перевіреним» для `uk` (щоб `blockers` був порожній) →
   «Опублікувати зміни». Публікація A проходить; версії робочих карток/review
   зсуваються.
4. Сесія **B** (сторінка не оновлювалася — тримає старі `versions`): натискає
   «Опублікувати зміни» по `zzz-test-panel`.
5. Очікується: `publishItem` бачить `workingVersion !== expected.working` (або
   `reviewVersion !==`) → **`{ ok:false, conflict:true }`**, повідомлення про
   конфлікт + кнопка «Оновити»; зміни A **збережені** (published.json містить
   версію A). Зафіксувати точний текст.
6. Якщо B тихо перезаписав версію A — **дефект**, звіт із кроками відтворення.
7. Якщо кнопка B була неактивна від початку або відмова прийшла через
   `blockers`/`needs-review` — сценарій конфлікту **не** зарахований, переналаштувати
   передумову (крок 1) і повторити.

## 6. Прибирання — правильний порядок

`/panel` формує рядки лише зі списку **робочих** карток (`getPanelData` →
`working.map(...)`, `panelStore.ts:173`). Тому кнопка «Прибрати з сайту» зникає,
щойно робочу картку видалено, — навіть якщо опублікований запис ще лишився.
Отже порядок:

1. **Прибрати з опублікованого знімка ПЕРШИМ.** `/panel` → картка
   `zzz-test-panel` (робоча ще існує) → «Прибрати з сайту» (`unpublish`).
   Очікування: `published.json` (ключ `services`) більше не містить
   `zzz-test-panel`; повідомлення «прибрано з сайту. Робоча картка збережена».
2. **Перевірити результат і Preview.** `/panel` → картка показує стан «не
   опубліковано»; `git show origin/codex/admin-panel-spike:src/content/cms/published.json`
   — без `zzz-test-panel`; після нової збірки Preview `/services/zzz-test-panel`
   на Preview-хості → 404 (або зникнення зі списку послуг).
3. **Видалити робочу картку.** Keystatic → Послуги → `zzz-test-panel` → Delete →
   Save. Коміт видалення `src/content/cms/services/zzz-test-panel.json` у гілку.
4. **Прибрати тестові фото — лише свої.** Видалити директорію
   `public/images/cms/services/zzz-test-panel/` (файл(и) з кроку 3 розділу «Фото»).
   Спершу переконатися, що ці файли не згадуються більше ніде: пошук значення
   `images/cms/services/zzz-test-panel` у `src/content/cms/**` — має бути 0.
   Інші піддиректорії `public/images/cms/services/` не чіпати (до тесту вона була
   порожня — звірено на `80f8167`).
5. **Перевірити залишок у мовних підтвердженнях.** `src/content/cms/review-state.json`
   у гілці не повинен містити ключа `zzz-test-panel`. Якщо Keystatic-видалення
   картки не прибрало його автоматично — прибрати запис `zzz-test-panel` з
   `review-state.json` окремим комітом і зафіксувати це як **ваду для
   виправлення** (видалення картки має чистити її review-стан).

**Окремо зафіксувати як проблему для подальшого виправлення:** сценарій «робочу
картку видалили раніше, ніж прибрали з публікації». Поточний `/panel` не показує
рядок для опублікованого запису без робочої картки → кнопки `unpublish` в
інтерфейсі немає, хоча серверний `unpublishItem` спрацював би. Якщо під час тесту
хтось видалить картку першим, прибрати запис доведеться: (а) відновити робочу
картку з тим самим `id` → `unpublish` через `/panel`, або (б) вручну прибрати
`zzz-test-panel` з `published.json` окремим комітом у гілку. Потрібне рішення:
показувати в `/panel` «осиротілі» опубліковані записи з кнопкою прибирання.

## 7. Перевірка прибирання — конкретні місця, порівняння з початковим станом

Чистий `git status` сам собою нічого не доводить (тестовий матеріал міг бути
**закомічений** у гілку). Текст `zzz-test` законно лишиться в цій документації та
в історії Git — його наявність там **не** є залишком. Перевіряти саме:

| Що | Як перевірити | Очікування |
|---|---|---|
| Робочі дані CMS | `git show origin/codex/admin-panel-spike:src/content/cms/services/` — переліку файлів; пошук `zzz-test-panel.json` | відсутній |
| Опублікований знімок | `git show origin/codex/admin-panel-spike:src/content/cms/published.json` → ключ `services` | немає запису з `"id":"zzz-test-panel"` |
| Стан мовних підтверджень | `git show origin/codex/admin-panel-spike:src/content/cms/review-state.json` | немає ключа `zzz-test-panel` |
| Тестові медіафайли | `git ls-tree -r origin/codex/admin-panel-spike --name-only -- public/images/cms/services/` | немає шляхів під `zzz-test-panel/` |
| Гілка в цілому | `git range-diff` / `git log origin/codex/admin-panel-spike` за період тесту | лишилися тільки коміти create/confirm/publish/unpublish/delete `zzz-test-panel`, які взаємно скасовуються за вмістом (кінцевий стан даних = початковий) |
| `main` | `git rev-parse origin/main` до і після всього сценарію | однаковий SHA (`ce1977af`) |

Порівняння з **початковим станом**: до сценарію зберегти
`git rev-parse origin/codex/admin-panel-spike` та вміст трьох файлів
(`services/`, `published.json`, `review-state.json`); після прибирання —
`git show` тих самих шляхів має дати той самий вміст (з точністю до
незначного форматування, якщо Keystatic переупорядкував ключі).

---

## Розмежування учасників (для протоколу; без учасника — «не виконано»)

| Роль | Хто | Що доводить | Якщо немає учасника |
|---|---|---|---|
| Неавторизований відвідувач | приватне вікно **без входу** | публічні сторінки видно, `/panel` і чернетка — ні | можна перевірити зараз силами власника |
| Сторонній авторизований GitHub-акаунт | реальний **інший** обліковий запис GitHub без доступу до репозиторію | після Authorize — «repo not found»/порожньо, редагувати не може | **не запускати**; «не виконано — немає учасника». Приватне вікно це **не** замінює |
| Помічник із доступом Write | людина, якій власник дав доступ (Collaborator/App) | бачить колекції, може зберегти; після відкликання доступу втрачає чернетки | **не запускати**; «не виконано — немає учасника». Тест власника цього **не** підтверджує |

Створювати додаткові облікові записи або видавати/відкликати доступи задля тесту
— поза цим сценарієм; це окреме рішення власника.
