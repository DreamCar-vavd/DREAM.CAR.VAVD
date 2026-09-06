import { config, fields, collection, singleton } from "@keystatic/core";

/**
 * DREAM.CAR.VAVD — content model for the management panel.
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

/** Per-language text block for a car. One card holds all three. */
const carLanguage = (label: string) =>
  fields.object(
    {
      title: fields.text({ label: `${label} — назва`, validation: { isRequired: false } }),
      specLine: fields.text({
        label: `${label} — характеристики (двигун • пальне • КПП • колір)`,
        validation: { isRequired: false },
      }),
      description: fields.text({
        label: `${label} — опис`,
        multiline: true,
        validation: { isRequired: false },
      }),
      viewGalleryLabel: fields.text({
        label: `${label} — підпис кнопки галереї`,
        description: 'Напр. «Переглянути 10 фото». Якщо порожньо — згенерується автоматично.',
        validation: { isRequired: false },
      }),
      /**
       * The editor sets this to "Перевірено" only after reading this
       * language. The publish gate (src/lib/content/carsGate.ts) refuses to
       * show a car publicly unless all three languages are "Перевірено" AND
       * their required fields are non-empty AND the confirmed text still
       * matches what was confirmed (translation-lock check in CI + build).
       */
      reviewState: fields.select({
        label: `${label} — стан перевірки`,
        options: [
          { label: "Чернетка (не перевірено)", value: "draft" },
          { label: "Перевірено цією мовою", value: "confirmed" },
        ],
        defaultValue: "draft",
      }),
    },
    { label },
  );

export default config({
  storage,
  ui: {
    brand: { name: "DREAM.CAR.VAVD — панель" },
    navigation: {
      Контент: ["cars"],
      Налаштування: ["siteSettings"],
    },
  },
  collections: {
    cars: collection({
      label: "Автомобілі",
      slugField: "id",
      path: "src/content/cms/cars/*",
      format: { data: "json" },
      columns: ["id", "saleStatus", "publishState"],
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
        publishState: fields.select({
          label: "Стан публікації",
          description:
            "Чернетка ніколи не потрапляє на публічний сайт і в sitemap. «Опубліковано» показує авто (якщо статус продажу це дозволяє й усі три мови перевірені).",
          options: [
            { label: "Чернетка", value: "draft" },
            { label: "Опубліковано", value: "published" },
          ],
          defaultValue: "draft",
        }),
        saleStatus: fields.select({
          label: "Статус продажу",
          description:
            "«Продано» і «Готується до продажу» ховають авто з публічного сайту, але картка лишається в панелі.",
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
