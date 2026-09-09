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

### 0.3. Захист `main` — перевіряти читанням, не спробою запису

**У цьому сценарії запис дозволено ЛИШЕ в `codex/admin-panel-spike`.** Спроби
зберегти щось у `main` (ні через `/panel`, ні через перемикач гілок Keystatic)
цей сценарій **не** передбачає — заборонену дію не виконуємо навіть заради
перевірки захисту.

Захист `main` підтверджується двома **читаннями**:
1. **Налаштування гілки** (0.1): `branch_protection_rules/81941201` — Require PR,
   Do not allow bypassing, force-push/deletion off; `content-guard.yml` не
   активний.
2. **Свіжий remote SHA `main` — мережею, до старту і після прибирання.**
   `git ls-remote origin refs/heads/main` → зберегти SHA на момент старту
   (станом на 2026-09-09 11:20 BST — `ce1977af140b49dce4bb79001c7eeed5e01aa2c2`;
   під час тесту взяти свіжий). Після прибирання — `git ls-remote` знову →
   **той самий SHA**. Локальний `git rev-parse origin/main` без `git fetch` /
   `ls-remote` — **кеш**, не доказ.

(Довідково, не крок сценарію: посилання редагування з `/panel` — branch-scoped
на `codex/admin-panel-spike` (звірено наживо, П32); дашборд Keystatic має
перемикач гілок, який технічно перелічує всі гілки, але користуватися ним для
запису в `main` заборонено умовами сценарію.)

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
3. Позначити нову мову/картку перевіреною, якщо додавання фото зробило потрібним.

### 3a. Чернетка vs опублікована версія — окремі контексти браузера

Потрібні **два незалежні контексти** на тому самому Preview-хості
`dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app`:

- **Контекст-редактор** — вкладка, де власник увійшов у Keystatic (є cookie
  `keystatic-gh-access-token`). Тут працює «Переглянути чернетку на сайті».
- **Контекст-глядач** — окреме вікно/профіль **без** режиму чернетки Next
  (cookie `__prerender_bypass` / `__next_preview_data` відсутні). Простіше —
  інше вікно, куди перед перевіркою зайти на
  `…/api/panel/preview?disable=1&path=/uk` (вимикає draft-mode), або приватне
  вікно.

**До публікації** `zzz-test-panel`:
- **Редактор** → `/panel` → «Переглянути чернетку на сайті» → редірект на `/uk`
  **на Preview-хості** (не `127.0.0.1`, не Production-домен) → `zzz-test-panel`
  та нове фото **видно** (у списку послуг і на `/uk/services/zzz-test-panel`).
- **Глядач** (без чернетки) → `/uk/services/zzz-test-panel` → **404**;
  у списку послуг на `/uk` матеріалу **немає**. Тобто до публікації матеріал
  живе **лише в чернетці**.
- Якщо втручається Vercel Authentication (просить вхід у Vercel у контексті-
  глядачі) — **зафіксувати це окремо** як «перевірку глядача заблоковано
  Vercel-захистом»; налаштування Deployment Protection **не змінювати**.

## 4. Тестова публікація за конкретним SHA

1. `/panel` → картка `zzz-test-panel` → «Опублікувати зміни».
2. Очікується: у гілці `codex/admin-panel-spike` оновлюється
   `src/content/cms/published.json` (ключ `services` містить `zzz-test-panel`);
   банер `/panel` показує стан збірки Preview і текст «на тестовому сайті гілки
   «codex/admin-panel-spike»» (не «в ефірі (Production)»).
3. Звірити коміт публікації:
   - `git ls-remote origin refs/heads/codex/admin-panel-spike` → новий SHA;
   - вміст `published.json` на цьому SHA — прочитати **за фактичним SHA** через
     GitHub (`https://raw.githubusercontent.com/DreamCar-vavd/DREAM.CAR.VAVD/<sha>/src/content/cms/published.json`
     або `gh api repos/DreamCar-vavd/DREAM.CAR.VAVD/contents/…?ref=<sha>`), **або**
     `git fetch origin <sha>` в **окремій перевірочній копії** й потім
     `git show <sha>:…`. `git ls-remote` дає лише SHA — коміти для `git show`
     воно **не завантажує**; на старий `origin/*` не покладатись.
   - SHA у банері `/panel` = цей новий HEAD гілки.
4. `git ls-remote origin refs/heads/main` (мережею) — **той самий SHA**, що й
   зафіксований на старті сценарію (0.3).
5. **Дочекатися Preview-збірки** цього SHA (Vercel → Deployments → Ready) — стабільний
   branch alias почне віддавати новий deployment.
6. **Контекст-глядач** (без чернетки, розд. 3a) на новому deployment:
   - `/uk/services/zzz-test-panel`, `/en/services/zzz-test-panel`,
     `/ru/services/zzz-test-panel` → **200**, показують тексти відповідної мови
     та фото;
   - `zzz-test-panel` з'явився у списку послуг на `/uk`, `/en`, `/ru`.
   - Якщо Vercel Authentication заблокувала глядача — зафіксувати окремо,
     налаштування не чіпати.

### Що робити при невизначеному результаті запису

Якщо після «Опублікувати зміни» / «Позначити перевіреним» / «Прибрати з сайту»
з'явилося **«Відповідь від GitHub не надійшла, тому невідомо, чи збережено … .
Оновіть сторінку й перевірте поточний стан, перш ніж повторювати дію.»**
(`WriteUncertainError`):
1. **Не** тиснути кнопку повторно.
2. Оновити `/panel` (F5) і подивитися стан картки; звірити гілку через
   `git ls-remote origin refs/heads/codex/admin-panel-spike` → SHA → прочитати
   `published.json` на цьому SHA через GitHub (`raw.githubusercontent.com/…/<sha>/…`)
   або `git fetch origin <sha>` в окремій копії.
3. Якщо коміт стався — дію **не** повторювати. Якщо ні — повторити з
   актуальними version-токенами (проста F5 їх оновлює).

Якщо натомість «Сховище тимчасово недоступне … зачекайте хвилину й оновіть
сторінку» (`StorageUnavailableError`) або «GitHub тимчасово обмежив частоту
запитів …» (`StorageRateLimitedError`) — запис **не** починався; безпечно
повторити пізніше.

## 5. Конфлікт двох вкладок власника — відтворюваний варіант

Мета — перевірити саме **конфлікт версій** (`ConflictError`) між двома вкладками
**того самого** власника, не заблоковану кнопку й не відмову через неперевірену
мову. Це перевірка конфлікту редагування, **не** прав різних користувачів.

Кнопка «Опублікувати зміни» неактивна, коли
`row.blockers.length > 0 || row.publishState === "in-sync"` — тобто повністю
опублікована, незмінена картка має **неактивну** кнопку. Щоб кнопка була
активною в обох вкладках, потрібна готова **неопублікована** зміна.

Послідовність:

1. **`zzz-test-panel` уже опублікований** (крок 4) — базовий стан «in-sync».
2. Внести **першу** зміну (напр. `uk.longDescription` у Keystatic → Save) і
   **підтвердити потрібну мову** (`/panel` → «Позначити перевіреним» для `uk`),
   але **ще не публікувати**. Тепер `publishState === "modified"`, `blockers`
   порожній.
3. Відкрити `/panel` у **вкладці A** і **вкладці B** (два вікна одного браузера,
   той самий акаунт власника). Обидві бачать готові неопубліковані зміни
   `zzz-test-panel` і **активну** кнопку «Опублікувати зміни». Зафіксувати
   `versions.service` / `versions.review` кожної вкладки (рівні).
4. У **вкладці A**: внести **наступну** зміну в Keystatic → Save → у `/panel`
   знову «Позначити перевіреним» для тієї мови → **«Опублікувати зміни»**.
   Публікація A проходить; робочі/review-версії зсуваються.
5. У **вкладці B** (сторінка **не** оновлювалася — тримає старі `versions`):
   натиснути «Опублікувати зміни» по `zzz-test-panel`.
6. Очікується: `publishItem` бачить `workingVersion !== expected.working` (або
   `reviewVersion !==`) → **`{ ok:false, conflict:true }`**, повідомлення про
   конфлікт + кнопка «Оновити». **Опублікована версія A лишається незмінною**
   (`published.json` містить версію A). Зафіксувати точний текст.
7. **Не** обходити неактивну кнопку через JavaScript. Якщо кнопка B була
   неактивна від початку або відмова прийшла через `blockers`/`needs-review` —
   сценарій конфлікту **не** зарахований; переналаштувати передумову (кроки 1–3)
   і повторити.
8. Якщо B тихо перезаписав версію A — **дефект**, звіт із кроками відтворення.
9. Точний текст конфлікту (`ConflictError`, звірити з UI): «Дані «контент»
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
2. **Перевірити результат, і список, і прямі адреси.** `/panel` → картка показує
   стан «не опубліковано». Прочитати `published.json` **за фактичним новим SHA
   гілки** (`git ls-remote origin refs/heads/codex/admin-panel-spike` → SHA →
   `raw.githubusercontent.com/DreamCar-vavd/DREAM.CAR.VAVD/<sha>/src/content/cms/published.json`
   або `git fetch origin <sha>` в окремій копії + `git show <sha>:…`) — ключ
   `services` **без** `zzz-test-panel`. Дочекатися нової Preview-збірки (Vercel →
   Ready), потім у **контексті-глядачі** (без чернетки, розд. 3a):
   `/uk/services/zzz-test-panel`, `/en/…`, `/ru/…` на Preview-хості → **404**
   **і** `zzz-test-panel` **зник зі списку послуг** на `/uk`, `/en`, `/ru`. Саме
   лише зникнення зі списку — **недостатньо**, перевіряти обидва. Якщо втручається
   Vercel Authentication — зафіксувати окремо, налаштування не чіпати.
3. **Видалити робочу картку.** Keystatic → Послуги → `zzz-test-panel` → Delete →
   Save. Коміт видалення `src/content/cms/services/zzz-test-panel.json` у гілку.
4. **Прибрати тестові фото — лише свої.** Видалити директорію
   `public/images/cms/services/zzz-test-panel/` (файл(и) з кроку 3 розділу «Фото»,
   точний шлях — з дифу того коміту). Спершу переконатися, що ці файли не
   згадуються більше ніде: пошук значення `images/cms/services/zzz-test-panel` у
   `src/content/cms/**` — має бути 0. Видаляти **лише** створене цим тестом
   (картку, фото, запис підтвердження мови `zzz-test-panel`). Інші піддиректорії
   `public/images/cms/services/` не чіпати (до тесту тека була порожня — звірено
   на `80f8167`). Сторонні коміти, що могли з'явитися в гілці поверх, **не**
   відкочувати й **не** ресетити.
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

## 7. Перевірка прибирання — порівняння вмісту, не історії

Чистий `git status` сам собою нічого не доводить (тестовий матеріал міг бути
**закомічений** у гілку). `git log` / `git range-diff` показують, **які коміти**
з'явились, але **не** доводять, що дані повернулись до початкового стану —
потрібне порівняння **вмісту** дозволених шляхів на старті й у кінці.

**На старті сценарію зафіксувати (мережею):**
- `git ls-remote origin refs/heads/main` → `MAIN_SHA_0`;
- `git ls-remote origin refs/heads/codex/admin-panel-spike` → `BRANCH_SHA_0`;
- вміст трьох файлів на `BRANCH_SHA_0` — прочитати через GitHub
  (`raw.githubusercontent.com/DreamCar-vavd/DREAM.CAR.VAVD/<BRANCH_SHA_0>/…`) або
  `git fetch origin <BRANCH_SHA_0>` в **окремій перевірочній копії**:
  `src/content/cms/published.json`, `src/content/cms/review-state.json`,
  перелік `src/content/cms/services/`.

**Після прибирання — знову мережею**, на новому `BRANCH_SHA_1`:

| Що | Як перевірити (на `BRANCH_SHA_1`, читання через GitHub або окрему копію з `git fetch origin <sha>`) | Очікування |
|---|---|---|
| Робочі дані CMS | перелік `src/content/cms/services/` | немає `zzz-test-panel.json`; решта файлів = стартовий перелік |
| Опублікований знімок | `published.json` → ключ `services` | немає запису `"id":"zzz-test-panel"`; решта = вміст на `BRANCH_SHA_0` |
| Стан мовних підтверджень | `review-state.json` | немає ключа `zzz-test-panel`; решта = вміст на `BRANCH_SHA_0` |
| Тестові медіафайли | `git ls-tree -r <BRANCH_SHA_1> --name-only -- public/images/cms/services/` (у копії з `git fetch`) | немає шляхів під `zzz-test-panel/` |
| `main` | `git ls-remote origin refs/heads/main` | `= MAIN_SHA_0` (не зрушив) |

Різниця дозволених шляхів між `BRANCH_SHA_0` і `BRANCH_SHA_1` має зводитись до
нуля за вмістом (з точністю до незначного переупорядкування ключів, якщо його
зробив Keystatic). Будь-яка інша відмінність у цих трьох файлах — залишок,
прибрати окремим комітом. Сторонні зміни поза шляхами `zzz-test-panel` —
**не** чіпати.

---

## 8. Статус перевірки вузького екрана (чесно, станом на П33)

| Перевірка | Статус | Підстава |
|---|---|---|
| Reflow розмітки `/panel` у контейнері шириною 375px | **перевірено** | вміст переноситься, без горизонтального скролу; у `page.tsx`/`PanelActions.tsx`/`layout.tsx` — 0 медіазапитів ширини, тож звуження контейнера дає той самий результат, що й вузький viewport розмітки панелі |
| Реальний viewport 375px (CSS-в'юпорт, а не звужений контейнер) | **не перевірено** | доступний інструмент емуляції не змінював CSS-в'юпорт (`innerWidth` лишався 1699/1400); мобільний режим окремого браузера потребував би нового входу в GitHub |
| Keystatic на вузькому екрані | **не перевірено** | UI Keystatic верстається у viewport-одиницях і на CSS-обмеження контейнера не реагує; окремо на 375px не відкривався |

Відсутність знайдених медіазапитів **не** прирівнює ці перевірки одну до одної.
Окремий стенд задля цього не піднімати.

---

## Розмежування учасників (для протоколу; без учасника — «не виконано»)

| Роль | Хто | Що доводить | Якщо немає учасника |
|---|---|---|---|
| Неавторизований відвідувач | приватне вікно **без входу** | публічні сторінки видно, `/panel` і чернетка — ні | можна перевірити зараз силами власника |
| Сторонній авторизований GitHub-акаунт | реальний **інший** обліковий запис GitHub без доступу до репозиторію | після Authorize — «repo not found»/порожньо, редагувати не може | **не запускати**; «не виконано — немає учасника». Приватне вікно це **не** замінює |
| Помічник із доступом Write | людина, якій власник дав доступ (Collaborator/App) | бачить колекції, може зберегти; після відкликання доступу втрачає чернетки | **не запускати**; «не виконано — немає учасника». Тест власника цього **не** підтверджує |

Створювати додаткові облікові записи або видавати/відкликати доступи задля тесту
— поза цим сценарієм; це окреме рішення власника.
