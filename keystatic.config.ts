import { config, fields, collection, singleton } from "@keystatic/core";

/**
 * DREAM.CAR.VAVD — content model for the management panel.
 *
 * Keystatic edits the WORKING copy only. Nothing here reaches the public site
 * until it is published from the panel dashboard at /panel:
 *   Keystatic (edit) → /panel «Позначити перевіреним» (per language) →
 *   /panel «Опублікувати зміни» → src/content/cms/published.json → deploy.
 * The site reads published.json exclusively — see report/34.
 *
 * Storage:
 *  - `local`  — reads/writes plain files in this repo while running `next dev`.
 *               Used for local development and for the migration/spike.
 *  - `github` — the hosted mode the owner will use. Switched on once the
 *               GitHub App (or a Keystatic Cloud Free team) is created; see
 *               report/33 §4 for the exact owner steps. Nothing else in the
 *               schema changes between the two modes.
 *
 * The env var keeps a single source of truth and lets a Vercel Preview run
 * in `github` mode without touching this file.
 */
const storage =
  process.env.KEYSTATIC_STORAGE_KIND === "github"
    ? ({
        kind: "github",
        repo: {
          owner: process.env.KEYSTATIC_GITHUB_REPO_OWNER ?? "DreamCar-vavd",
          name: process.env.KEYSTATIC_GITHUB_REPO_NAME ?? "DREAM.CAR.VAVD",
        },
      } as const)
    : ({ kind: "local" } as const);

/**
 * Per-language text block for a car. One card holds all three.
 * Review confirmation is NOT a field here — editing content must never carry
 * its own "reviewed" flag. It is tracked in src/content/cms/review-state.json
 * and set from the panel dashboard (/panel), so any text edit auto-invalidates
 * the prior confirmation (hash mismatch).
 */
const galleryLanguage = (label: string) =>
  fields.object(
    {
      title: fields.text({ label: `${label} — назва роботи` }),
      shortDescription: fields.text({ label: `${label} — короткий опис`, multiline: true }),
      longDescription: fields.text({ label: `${label} — докладний опис`, multiline: true }),
      service: fields.text({ label: `${label} — вид послуги` }),
      clientRequest: fields.text({ label: `${label} — проблема / запит клієнта`, multiline: true }),
      completedItems: fields.array(fields.text({ label: "Пункт" }), {
        label: `${label} — виконані роботи`,
        itemLabel: (p) => p.value || "Пункт",
      }),
      result: fields.text({ label: `${label} — результат`, multiline: true }),
    },
    { label },
  );

const serviceSection = (label: string) =>
  fields.array(
    fields.object({
      heading: fields.text({ label: "Заголовок блоку" }),
      items: fields.array(fields.text({ label: "Пункт", multiline: true }), {
        label: "Пункти",
        itemLabel: (p) => p.value || "Пункт",
      }),
    }),
    {
      label: `${label} — структуровані блоки (модалка)`,
      itemLabel: (p) => p.fields.heading.value || "Блок",
    },
  );

const serviceLanguage = (label: string) =>
  fields.object(
    {
      title: fields.text({ label: `${label} — назва послуги` }),
      shortDescription: fields.text({ label: `${label} — короткий опис`, multiline: true }),
      longDescription: fields.text({ label: `${label} — докладний опис`, multiline: true }),
      cardDescription: fields.text({
        label: `${label} — опис на картці (необов'язково)`,
        multiline: true,
      }),
      bullets: fields.array(fields.text({ label: "Пункт" }), {
        label: `${label} — короткі пункти`,
        itemLabel: (p) => p.value || "Пункт",
      }),
      modalLead: fields.text({ label: `${label} — рядок над модалкою (необов'язково)` }),
      modalDescription: fields.text({
        label: `${label} — вступний абзац модалки (необов'язково)`,
        multiline: true,
      }),
      modalSections: serviceSection(label),
      seoTitle: fields.text({ label: `${label} — SEO title (необов'язково)` }),
      seoDescription: fields.text({
        label: `${label} — SEO description (необов'язково)`,
        multiline: true,
      }),
    },
    { label },
  );

const contactLanguage = (label: string) =>
  fields.object(
    {
      heading: fields.text({ label: `${label} — заголовок розділу` }),
      subheading: fields.text({ label: `${label} — підзаголовок`, multiline: true }),
      hoursLabel: fields.text({ label: `${label} — підпис «Графік роботи» (необов'язково)` }),
      addressLabel: fields.text({ label: `${label} — підпис «Адреса» (необов'язково)` }),
    },
    { label },
  );

const carLanguage = (label: string) =>
  fields.object(
    {
      title: fields.text({ label: `${label} — назва` }),
      specLine: fields.text({
        label: `${label} — характеристики (двигун • пальне • КПП • колір)`,
      }),
      description: fields.text({ label: `${label} — опис`, multiline: true }),
      viewGalleryLabel: fields.text({
        label: `${label} — підпис кнопки галереї`,
        description: 'Напр. «Переглянути 10 фото». Якщо порожньо — згенерується автоматично.',
      }),
    },
    { label },
  );

export default config({
  storage,
  ui: {
    brand: { name: "DREAM.CAR.VAVD — панель" },
    navigation: {
      Контент: ["cars", "galleryProjects", "services"],
      "Контакти й графік": ["siteContact"],
      Налаштування: ["siteSettings"],
    },
  },
  collections: {
    cars: collection({
      label: "Автомобілі",
      slugField: "id",
      path: "src/content/cms/cars/*",
      format: { data: "json" },
      columns: ["id", "saleStatus", "order"],
      schema: {
        id: fields.slug({
          name: {
            label: "ID автомобіля",
            description:
              "Стабільний ідентифікатор. Використовується формою зворотного зв'язку та CTA. Не змінюйте у наявних авто.",
            validation: { isRequired: true },
          },
        }),

        // ---- Спільні факти (вводяться один раз, застосовуються до всіх мов) ----
        order: fields.integer({
          label: "Порядок показу",
          description: "Менше число — вище у списку.",
          defaultValue: 100,
          validation: { isRequired: true },
        }),
        saleStatus: fields.select({
          label: "Статус продажу",
          description:
            "«Продано» і «Готується до продажу» ховають авто з сайту після публікації, але картка лишається в панелі. Зміна набуває сили після «Опублікувати зміни» в /panel.",
          options: [
            { label: "Готується до продажу", value: "preparing" },
            { label: "У продажі", value: "for-sale" },
            { label: "Зарезервовано", value: "reserved" },
            { label: "Продано", value: "sold" },
          ],
          defaultValue: "for-sale",
        }),
        year: fields.text({ label: "Рік", validation: { isRequired: true } }),
        price: fields.text({
          label: "Ціна",
          description: "Напр. «£9,500». Одна на всі мови.",
          validation: { isRequired: true },
        }),
        mileageValue: fields.integer({
          label: "Пробіг (число, миль)",
          description:
            "Тільки число, напр. 47170. Форматування («47 170 миль» / «47,170 miles») додається автоматично для кожної мови.",
          validation: { isRequired: true },
        }),

        // ---- Медіа (спільні) ----
        photos: fields.array(
          fields.object({
            image: fields.image({
              label: "Фото",
              // Keystatic stores car images per entry:
              // public/images/cms/cars/<id>/<file>. The stored value is the
              // full public path (getSrcPrefix appends the slug).
              directory: "public/images/cms/cars",
              publicPath: "/images/cms/cars",
              validation: { isRequired: true },
            }),
            caption: fields.text({ label: "Підпис / alt (необов'язково)" }),
          }),
          {
            label: "Фотографії",
            description:
              "Перше фото = головне (обкладинка). Порядок змінюється перетягуванням або стрілками ↑ ↓.",
            itemLabel: (props) => props.fields.caption.value || "Фото",
            validation: { length: { min: 1 } },
          },
        ),
        video: fields.object(
          {
            mode: fields.select({
              label: "Відео огляду",
              options: [
                { label: "Немає", value: "none" },
                { label: "Наявний локальний файл (перенесений)", value: "legacy-file" },
                { label: "Зовнішнє посилання", value: "external-link" },
                { label: "Завантажений файл — НЕ ПІДКЛЮЧЕНО", value: "uploaded-file" },
              ],
              defaultValue: "none",
            }),
            src: fields.text({
              label: "Шлях / посилання на відео",
              description:
                "Для «наявного локального файлу» — шлях у /images/…. Для «зовнішнього посилання» — повний URL. Режим «завантажений файл» поки не працює (потрібне зовнішнє сховище, report/33 §6) — не використовуйте.",
            }),
            posterSrc: fields.text({
              label: "Постер відео (шлях до фото)",
              description: "Зазвичай — головне фото авто.",
            }),
          },
          { label: "Відео" },
        ),

        // ---- Мовні тексти (одна картка, три мови) ----
        uk: carLanguage("Українська"),
        en: carLanguage("English"),
        ru: carLanguage("Русский"),
      },
    }),

    galleryProjects: collection({
      label: "Галерея (тексти)",
      slugField: "id",
      path: "src/content/cms/gallery/*",
      format: { data: "json" },
      columns: ["id", "kind", "order"],
      schema: {
        id: fields.slug({
          name: {
            label: "ID роботи",
            description:
              "Стабільний ідентифікатор. Фотографії роботи прив'язані до цього ID. Не змінюйте у наявних.",
            validation: { isRequired: true },
          },
        }),
        order: fields.integer({
          label: "Порядок показу",
          defaultValue: 100,
          validation: { isRequired: true },
        }),
        kind: fields.select({
          label: "Тип картки",
          options: [
            { label: "Альбом роботи", value: "album" },
            { label: "Загальна картка (showcase)", value: "showcase" },
          ],
          defaultValue: "album",
        }),
        year: fields.text({ label: "Рік (спільний)" }),
        photos: fields.array(
          fields.object({
            image: fields.image({
              label: "Фото",
              directory: "public/images/cms/gallery",
              publicPath: "/images/cms/gallery",
              validation: { isRequired: true },
            }),
            caption: fields.text({ label: "Підпис / alt (необов'язково)" }),
          }),
          {
            label: "Фотографії роботи",
            description:
              "Перше фото = обкладинка картки. Порядок — перетягуванням або стрілками ↑ ↓.",
            itemLabel: (props) => props.fields.caption.value || "Фото",
            validation: { length: { min: 1 } },
          },
        ),
        videoUrl: fields.url({ label: "Посилання на відео (необов'язково)" }),
        showContactCta: fields.checkbox({
          label: "Показувати кнопку «Замовити консультацію»",
          defaultValue: true,
        }),
        uk: galleryLanguage("Українська"),
        en: galleryLanguage("English"),
        ru: galleryLanguage("Русский"),
      },
    }),

    services: collection({
      label: "Послуги",
      slugField: "id",
      path: "src/content/cms/services/*",
      format: { data: "json" },
      columns: ["id", "status", "order"],
      schema: {
        id: fields.slug({
          name: {
            label: "ID / адреса послуги",
            description:
              "Використовується в адресі сторінки /services/<id> та у формі зворотного зв'язку. Лише малі латинські літери, цифри й дефіси. Не змінюйте у наявних послуг.",
            validation: { isRequired: true },
          },
        }),
        order: fields.integer({
          label: "Порядок показу",
          description: "Менше число — вище у списку.",
          defaultValue: 100,
          validation: { isRequired: true },
        }),
        status: fields.select({
          label: "Доступність",
          description:
            "«Незабаром» показує послугу з позначкою й лишає її сторінку доступною. Не змінює фактичну доступність без потреби.",
          options: [
            { label: "Доступно", value: "available" },
            { label: "Незабаром", value: "coming-soon" },
          ],
          defaultValue: "available",
        }),
        iconSrc: fields.text({
          label: "Іконка (шлях до файлу)",
          description: "Напр. /images/services/premium-3d/01-car-selection-premium-3d.png",
        }),
        price: fields.text({
          label: "Ціна (необов'язково)",
          description: 'Напр. «від £60» або «за домовленістю». Порожньо — ціна не показується.',
        }),
        photos: fields.array(
          fields.object({
            image: fields.image({
              label: "Фото",
              directory: "public/images/cms/services",
              publicPath: "/images/cms/services",
              validation: { isRequired: true },
            }),
            caption: fields.text({ label: "Підпис / alt (необов'язково)" }),
          }),
          {
            label: "Фотографії (необов'язково)",
            itemLabel: (props) => props.fields.caption.value || "Фото",
          },
        ),
        uk: serviceLanguage("Українська"),
        en: serviceLanguage("English"),
        ru: serviceLanguage("Русский"),
      },
    }),

    siteContact: collection({
      label: "Контакти й графік",
      slugField: "id",
      path: "src/content/cms/contact/*",
      format: { data: "json" },
      columns: ["id"],
      schema: {
        id: fields.slug({
          name: {
            label: "ID запису",
            description:
              "Завжди «site». Це єдиний запис контактів — не створюйте другий.",
            validation: { isRequired: true },
          },
        }),
        order: fields.integer({ label: "Порядок", defaultValue: 1 }),

        // ---- Спільні факти (вводяться один раз, застосовуються до всіх мов) ----
        phoneDisplay: fields.text({
          label: "Телефон (як показувати)",
          description: "Напр. «+44 7706 054203».",
        }),
        phoneE164: fields.text({
          label: "Телефон для посилання (E.164)",
          description: "Лише + і цифри, напр. «+447706054203». Формує посилання tel:.",
        }),
        email: fields.text({
          label: "Публічний email",
          description:
            "Показується на сайті. НЕ впливає на адресу, куди надходять заявки з форми (це технічне налаштування).",
        }),
        whatsappNumber: fields.text({
          label: "Номер WhatsApp",
          description: "Лише цифри, напр. «447706054203». Формує посилання wa.me.",
        }),
        telegramUrl: fields.text({ label: "Telegram (посилання, необов'язково)" }),
        instagramUrl: fields.text({ label: "Instagram (посилання, необов'язково)" }),
        facebookUrl: fields.text({ label: "Facebook (посилання, необов'язково)" }),
        youtubeUrl: fields.text({ label: "YouTube (посилання, необов'язково)" }),
        addressText: fields.text({
          label: "Адреса (необов'язково)",
          description: "Якщо адреси немає — залиште порожнім, блок не показуватиметься.",
          multiline: true,
        }),
        mapsUrl: fields.text({ label: "Посилання на карту (Google Maps, необов'язково)" }),
        hours: fields.text({
          label: "Графік роботи (необов'язково)",
          description: "Вільний текст, напр. «Пн–Пт 9:00–18:00». Порожньо — блок прихований.",
          multiline: true,
        }),

        uk: contactLanguage("Українська"),
        en: contactLanguage("English"),
        ru: contactLanguage("Русский"),
      },
    }),
  },
  singletons: {
    siteSettings: singleton({
      label: "Налаштування сайту",
      path: "src/content/cms/settings/site",
      format: { data: "json" },
      schema: {
        note: fields.text({
          label: "Службова примітка",
          description:
            "Розділи «Контакти», «Графік», «Банери» додаються на наступному етапі (report/33 §10). Цей сінглтон — заготовка.",
          multiline: true,
        }),
      },
    }),
  },
});
