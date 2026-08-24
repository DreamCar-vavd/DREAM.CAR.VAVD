# Security backlog — DREAM.CAR.VAVD

Підготовлено 2026-08-23 як частина pre-commit correction pass. Нічого з цього
списку не впроваджено — усе потребує окремого явного дозволу власника перед
дією, а пункти 1 і 4 додатково потребують доступу до Vercel/GitHub, якого в
цієї сесії немає.

## 1. Vercel WAF rate limiting для `POST /api/contact`

**Статус: опубліковано в режимі Log — 2026-08-24.** Правило "Contact form
rate limit" активне (Firewall → Overview: "Custom Rules: 1 active"; Audit
Log: "You published version #1 with 1 change — You created and enabled
Contact form rate limit"). Поки що **лише спостереження, нічого не
блокується** — перехід на `Default (429)` очікує окремого дозволу після
аналізу логів за 3–7 днів.

- **Path** equals `/api/contact`
- **Method** equals `POST`
- Алгоритм: **Fixed Window**
- Ключ підрахунку: **IP**
- Поточна дія: **Log** (спостереження 3–7 днів, без блокування)
- Поріг: **10 запитів / 60 секунд**
- Після аналізу логів: залишити 10/60 або посилити до **5/60**
- Наступний крок (потребує окремого дозволу): бойова дія **Default (429)**
- **Не використовувати Challenge** — це JSON API, а не HTML-форма для людини;
  Challenge зламає легітимні AJAX-запити.
- На Hobby-плані Vercel доступне одне правило firewall на проєкт — врахувати
  при плануванні.
- Джерело: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Статус: **не застосовано, немає доступу до Vercel-проєкту**.

## 2. Не писати власний in-memory rate limiter

Next.js serverless-функції не гарантують один довгоживучий процес — кожен
інстанс має свою пам'ять, тому in-memory лічильник не рахує запити глобально
і дає хибне відчуття захисту. Rate limiting має жити на рівні edge/WAF (п. 1),
не в коді route-хендлера.

## 3. Моніторинг кодів відповіді без PII

Додати спостереження за частотою `403`/`413`/`429`/`502`/`504` від
`/api/contact` (наприклад, через Vercel Logs/Analytics або зовнішній
моніторинг). Принципово: **не логувати** імена, телефони, email, текст
повідомлень чи сам upstream-URL — лише код відповіді, timestamp і, за
потреби, hashed/усічену IP-адресу.

## 4. GitHub: secret scanning, Dependabot, branch protection

Репозиторій: `github.com/DreamCar-vavd/DREAM.CAR.VAVD` (підтверджено з
`git remote -v`). Перевірити в Settings → Security чи ввімкнені:
- Secret scanning (+ push protection)
- Dependabot alerts / security updates
- Branch protection на `main` (require PR review, require status checks)

**Не вмикати нічого автоматично** — у цієї сесії немає `gh`/GitHub-доступу
для перевірки поточного стану; потрібен власник з правами адміністратора
репозиторію.

## 5. Пропозиція CI (не створювати workflow без окремого погодження)

Мінімальний pipeline на кожен PR/push у `main`:
1. `npm ci` (чиста установка з lock-файлу)
2. `npx tsc --noEmit`
3. `npx eslint .`
4. `npm test`
5. `npm run build:webpack` (production-збірка)

Кожен крок — gate: перший, що впаде, зупиняє pipeline. Це формалізує саме
ту послідовність перевірок, яку зараз доводиться прогонювати вручну перед
кожним комітом.

## 6. LCP / AVIF / кешування медіа — окремо від security-комітів

LCP ≈ 3.3с на мобільній емуляції (вище "Good"-порогу 2.5с) — виміряно раніше,
код медіа не чіпався. Оптимізація (AVIF, розміри, кешування важких фото/відео)
— окрема, суто перформансна задача; свідомо не змішувати з security-фіксами
цього пакету, щоб діагностика й rollback лишались простими.

## 7. Реальне тестове повідомлення форми

Контактну форму й API повторно перевірено (72/72 тести, мокані
success/429/generic-сценарії, локальний `notConfigured` через відсутній
`CONTACT_FORM_ENDPOINT`). **Реальне повідомлення через живий Formspree-канал
не надсилалось** і не буде надіслано без окремого прямого дозволу власника.
