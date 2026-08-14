# DREAM.CAR.VAVD

Преміальний, тримовний (uk / ru / en) сайт автомобільних послуг DREAM.CAR.VAVD. Next.js App Router, TypeScript, Tailwind CSS v4.

## Запуск

```bash
npm install
npm run dev
```

Відкрий [http://localhost:3000](http://localhost:3000) — автоматично перенаправляє на `/uk`.

Якщо `next dev`/`next build` падають через нестачу оперативної пам'яті (Turbopack requires more RAM для збірки CSS), скористайся webpack-варіантом:

```bash
npm run dev:webpack
npm run build:webpack
```

## Скрипти

| Команда | Опис |
|---|---|
| `npm run dev` | Dev-сервер (Turbopack) |
| `npm run dev:webpack` | Dev-сервер (webpack, для машин з обмеженою RAM) |
| `npm run build` | Production-збірка (Turbopack) |
| `npm run build:webpack` | Production-збірка (webpack) |
| `npm run start` | Запуск production-збірки |
| `npm run lint` | ESLint |
| `npm run test` | Тести (`node --test` через `tsx`) — перевіряють узгодженість словників локалізації |

## Зображення

Поклади реальні файли за цими шляхами (заміняють плейсхолдери):

```
public/images/dream-car-logo.png    — логотип (шапка, hero, footer)
public/images/hero-cars.png         — фото автомобілів на головному екрані
public/images/reference-banner.png  — лише референс дизайну, на сайті не показується
public/images/gallery/01.jpg … 08.jpg — фото в галереї
```

## Змінні середовища

Скопіюй `.env.example` у `.env.local` і заповни:

```
NEXT_PUBLIC_SITE_URL=              # для canonical/OG/sitemap
NEXT_PUBLIC_FORM_ENDPOINT=         # URL для відправки форми зворотного зв'язку
NEXT_PUBLIC_TELEGRAM_URL=
NEXT_PUBLIC_INSTAGRAM_URL=
NEXT_PUBLIC_FACEBOOK_URL=
NEXT_PUBLIC_YOUTUBE_URL=
NEXT_PUBLIC_BUSINESS_ADDRESS=
NEXT_PUBLIC_GOOGLE_MAPS_URL=
```

Кнопки соцмереж і форма зворотного зв'язку показуються лише якщо відповідна змінна задана.

## Структура

```
src/
  app/
    [locale]/            # uk | ru | en — layout, головна, сторінки послуг, privacy, cookies
    sitemap.ts, robots.ts
  components/             # UI-компоненти (SiteHeader, HeroSection, ServicesGrid, ContactForm, ...)
  content/
    dictionaries/         # типізовані тексти для uk/ru/en
    services.ts           # метадані послуг (slug + іконка)
    types.ts              # тип Dictionary
  lib/
    i18n/                 # список локалей, завантаження словника
    social.ts             # посилання на соцмережі/телефон/email з env
```

## Мови

Три мовні версії `/uk`, `/ru`, `/en` з перемикачем у шапці, hreflang і canonical для кожної сторінки.
