# Сценарій реального запису + тестової публікації (готовий до погодження)

**Статус: НЕ виконувати.** Виконання — лише після окремого «так» власника саме
на цей сценарій. Передумови (а) зелена Preview-збірка з github-env і
(б) пройдений вхід/читання/чернетка/вихід на Vercel Preview — **виконані**
(П31/П32, deployment `a77d3e4` / `CZREYKxhJC7ziAH93w1x45qp5pKD`).

Межі: тільки гілка `codex/admin-panel-spike`. Production, `main`, DNS, тарифи,
права доступу, workflow перенесення контенту — не чіпати.

Схему звірено з `keystatic.config.ts` (services — з рядка 336) і `serviceGate.ts`;
маршрути й патерн шляхів фото — звірено наживо на Preview `a77d3e4` (П32).

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
  `/panel` — branch-scoped, у `main` не ведуть (звірено наживо, П32). Але
  дашборд Keystatic має кнопку «Нова гілка» і власний перемикач гілок, який
  технічно перелічує всі гілки (у П32 бачив і `/branch/main`, і
  `/branch/codex%2Fadmin-panel-spike`). Очікування: спроба **зберегти** в
  захищену `main` → GitHub відхиляє прямий push (правило 0.1), Keystatic
  зазвичай пропонує створити нову гілку. **Спробу запису в `main` руками не
  перевірено** — крок для hosted-протоколу.
- **Контрольна перевірка незмінності `main` — мережею, до і після.** Перед
  сценарієм: `git ls-remote origin refs/heads/main` → зберегти SHA (станом на
  2026-09-09 11:20 BST — `ce1977af140b49dce4bb79001c7eeed5e01aa2c2`; на момент
  старту звірити свіжим `ls-remote`). Після прибирання: `git ls-remote origin
  refs/heads/main` знову → **той самий SHA**. Локальний `git rev-parse
  origin/main` без `git fetch`/`ls-remote` **не доводить** незмінності GitHub
  (це кеш).

---

## 1. Один синтетичний матеріал — точний зразок

- **Колекція:** Послуги (`services`).
- **Робочий файл:** `src/content/cms/services/zzz-test-panel.json` (гілка
  `codex/admin-panel-spike`).
- **Публічні адреси після публікації** (звірено наживо на Preview `a77d3e4`:
  `/uk/services/detailing` → 200, `/services/detailing` → **404**):
  `/uk/services/zzz-test-panel`, `/en/services/zzz-test-panel`,
  `/ru/services/zzz-test-panel` на Preview-хості
  `dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`.
  Маршрут — `/[locale]/services/[slug]`; **без-локальний `/services/<id>` не
  існує**.
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

### Які файли може змінити цей сценарій (усі — у гілці `codex/admin-panel-spike`, ніде більше)

| Файл / шлях | Коли | Дія панелі/редактора |
|---|---|---|
| `src/content/cms/services/zzz-test-panel.json` | Create, кожен Save тексту/фото, Delete | Keystatic коміт |
| `public/images/cms/services/zzz-test-panel/…` (точний підшлях — з дифу коміту) | додавання/видалення фото | Keystatic коміт |
| `src/content/cms/review-state.json` | «Позначити перевіреним» (кожна мова) | `confirmLocale` → `PUT /contents` |
| `src/content/cms/published.json` | «Опублікувати зміни», «Прибрати з сайту» | `publishItem` / `unpublishItem` → `PUT /contents` |

**Не** змінюються: жоден `.ts`/`.tsx`/`.mjs`/`.yml`/`package*.json`, жоден інший
матеріал CMS, `main`, будь-яка інша гілка. `content-guard.yml` не активний (0.1),
тож ці коміти в гілку контенту нікуди далі не переносяться.

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
2. **Шлях фото визначає Keystatic при збереженні — не вводити наперед.** Патерн
   Keystatic для масиву `image`-полів у колекції **підтверджено наживо** для
   галереї на Preview `a77d3e4` (мережеві запити редактора
   `volvo-xc60-d5`): `raw.githubusercontent.com/…/public/images/cms/gallery/volvo-xc60-d5/photos/0/image.jpg`
   — тобто `<publicPath>/<slug>/<масив-поле>/<індекс>/<ключ>.<ext>`.
   За тим самим механізмом для послуг очікується
   `public/images/cms/services/zzz-test-panel/photos/0/image.<ext>`, а в JSON
   `"photos": [{ "image": "/images/cms/services/zzz-test-panel/photos/0/image.<ext>", … }]`.
   **Фактичний шлях і розширення — прочитати з дифу коміту**, який Keystatic
   зробить при Save (GitHub → Commits гілки), і саме його вживати далі в
   кроках прибирання.
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
   публікації (`git ls-remote origin refs/heads/codex/admin-panel-spike`).
4. `git ls-remote origin refs/heads/main` (мережею) — **той самий SHA**, що й
   зафіксований на старті сценарію.

### Що робити при невизначеному результаті запису

Якщо після «Опублікувати зміни» / «Позначити перевіреним» / «Прибрати з сайту»
з'явилося **«Відповідь від GitHub не надійшла, тому невідомо, чи збережено … .
Оновіть сторінку й перевірте поточний стан, перш ніж повторювати дію.»**
(`WriteUncertainError`):
1. **Не** тиснути кнопку повторно.
2. Оновити `/panel` (F5) і подивитися стан картки; звірити гілку через
   `git ls-remote origin refs/heads/codex/admin-panel-spike` + `git show <sha>:src/content/cms/published.json`.
3. Якщо коміт стався — дію **не** повторювати. Якщо ні — повторити з
   актуальними version-токенами (проста F5 їх оновлює).

Якщо натомість «Сховище тимчасово недоступне … зачекайте хвилину й оновіть
сторінку» (`StorageUnavailableError`) або «GitHub тимчасово обмежив частоту
запитів …» (`StorageRateLimitedError`) — запис **не** починався; безпечно
повторити пізніше.

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
8. Точний текст конфлікту (`ConflictError`, звірити з UI): «Дані «контент»
   змінилися відколи ви відкрили сторінку. Можливо, хтось редагує паралельно
   або зміну вже застосовано. Оновіть сторінку.» + кнопка **«Оновити»** (у
   `PanelActions` — бурштиновий текст). Правильна дія B: натиснути «Оновити»
   (F5), побачити версію A, і **не** публікувати поверх.

## 6. Прибирання — правильний порядок

Рекомендований порядок — прибрати з публікації **до** видалення робочої картки:

1. **Прибрати з опублікованого знімка ПЕРШИМ.** `/panel` → картка
   `zzz-test-panel` (робоча ще існує) → «Прибрати з сайту» (`unpublish`).
   Очікування: `published.json` (ключ `services`) більше не містить
   `zzz-test-panel`; повідомлення «прибрано з опублікованого знімка».
2. **Перевірити результат і Preview.** `/panel` → картка показує стан «не
   опубліковано»; `git show origin/codex/admin-panel-spike:src/content/cms/published.json`
   — без `zzz-test-panel`; після нової збірки Preview
   `/uk/services/zzz-test-panel` (і `/en/…`, `/ru/…`) на Preview-хості → 404
   (або зникнення зі списку послуг).
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

**Якщо порядок порушено (картку видалили раніше за `unpublish`):** з `dfbe89c`
(П26) `/panel` **показує** такий опублікований запис окремим бурштиновим рядком
«Робочу картку видалено. Опублікована версія ще залишається на сайті.» з кнопкою
**«Прибрати з сайту»** — вона кличе той самий version-guarded `unpublishItem`.
Тобто прибрати можна прямо з інтерфейсу, без відновлення картки й без ручного
коміту в `published.json`. Це і є перевірка нової поведінки: після кроку 3
(видалення картки), якщо крок 1 пропустити, рядок-сирота має з'явитися, а його
«Прибрати з сайту» — очистити `published.json`.

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
| `main` | `git ls-remote origin refs/heads/main` (**мережею**) до старту і після прибирання | той самий SHA (на старті — свіжий `ls-remote`, не кеш `origin/main`) |

Порівняння з **початковим станом**: до сценарію зробити
`git ls-remote origin refs/heads/{main,codex/admin-panel-spike}` і зберегти
вміст трьох файлів гілки контенту (`git show <branch-sha>:src/content/cms/services/…`,
`…published.json`, `…review-state.json`); після прибирання —
`git ls-remote` знову + `git show` тих самих шляхів на новому branch-SHA →
`main` не зрушив; дані гілки контенту повернулись до початкового вмісту
(з точністю до незначного форматування, якщо Keystatic переупорядкував ключі).

---

## Розмежування учасників (для протоколу; без учасника — «не виконано»)

| Роль | Хто | Що доводить | Якщо немає учасника |
|---|---|---|---|
| Неавторизований відвідувач | приватне вікно **без входу** | публічні сторінки видно, `/panel` і чернетка — ні | можна перевірити зараз силами власника |
| Сторонній авторизований GitHub-акаунт | реальний **інший** обліковий запис GitHub без доступу до репозиторію | після Authorize — «repo not found»/порожньо, редагувати не може | **не запускати**; «не виконано — немає учасника». Приватне вікно це **не** замінює |
| Помічник із доступом Write | людина, якій власник дав доступ (Collaborator/App) | бачить колекції, може зберегти; після відкликання доступу втрачає чернетки | **не запускати**; «не виконано — немає учасника». Тест власника цього **не** підтверджує |

Створювати додаткові облікові записи або видавати/відкликати доступи задля тесту
— поза цим сценарієм; це окреме рішення власника.
