# Рекламні банери DREAM.CAR.VAVD

Покращена версія банера: менше блиску, один Біг-Бен + London Eye, єдиний стиль іконок,
короткі тексти послуг, заклик до дії (WhatsApp) та окремі мовні версії.

| Файл | Розмір | Де використовувати |
|---|---|---|
| `out/*-landscape-1920x1080-*.jpg` | 1920×1080 | сайт, YouTube (обкладинка відео), Facebook link-пост |
| `out/*-square-1080x1080-*.jpg` | 1080×1080 | Facebook / Instagram пост |
| `out/*-story-1080x1920-*.jpg` | 1080×1920 | Stories, Reels, WhatsApp-статус, TikTok |

Мови: `uk` — українська, `en` — англійська, `ru` — російська.

## Як змінити текст і перегенерувати

Тексти, контакти та розміри — у `source/build.mjs` (об'єкти `CONTACT`, `T`, `FORMATS`).

```bash
cd marketing/banners/source
ln -sfn "$(npm root -g)" node_modules   # або: npm i playwright
node build.mjs                          # PNG з'являться в source/out/
```

Шрифти (Playfair Display, Montserrat — ліцензія OFL) лежать у `source/fonts/`.
