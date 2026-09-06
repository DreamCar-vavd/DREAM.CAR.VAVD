import { config, fields, collection } from "@keystatic/core";

export default config({
  storage: { kind: "local" },
  ui: { brand: { name: "DREAM.CAR.VAVD" } },
  collections: {
    cars: collection({
      label: "Автомобілі",
      slugField: "id",
      path: "src/content/cms/cars/*",
      format: { data: "json" },
      schema: {
        id: fields.slug({ name: { label: "ID автомобіля" } }),
        price: fields.text({ label: "Ціна (£)" }),
        saleStatus: fields.select({
          label: "Статус продажу",
          options: [
            { label: "Готується до продажу", value: "preparing" },
            { label: "У продажі", value: "for-sale" },
            { label: "Зарезервовано", value: "reserved" },
            { label: "Продано", value: "sold" },
          ],
          defaultValue: "for-sale",
        }),
        titleUk: fields.text({ label: "Назва (UK)" }),
        titleEn: fields.text({ label: "Назва (EN)" }),
        titleRu: fields.text({ label: "Назва (RU)" }),
      },
    }),
  },
});
