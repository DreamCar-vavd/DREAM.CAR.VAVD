import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import uk from "./dictionaries/uk";
import ru from "./dictionaries/ru";
import en from "./dictionaries/en";
import { services, serviceSlugs } from "./services";

const locales = { uk, ru, en } as const;
const here = dirname(fileURLToPath(import.meta.url));

const EXPECTED = {
  uk: {
    title: "Детейлінг і полірування",
    cardDescription:
      "Полірування. Хімчистка. Детейлінг. Захисні покриття. Усе в одному пакеті.",
    modalLead: "Відкриваємося вже зовсім скоро",
    modalDescription:
      "Комплексний догляд за кузовом і салоном: полірування, хімчистка, детейлінг та захисні покриття. Результат — бездоганний вигляд і надійний захист лакофарбового покриття.",
  },
  ru: {
    title: "Детейлинг и полировка",
    cardDescription:
      "Полировка. Химчистка. Детейлинг. Защитные покрытия. Всё в одном пакете.",
    modalLead: "Открываемся уже совсем скоро",
    modalDescription:
      "Комплексный уход за кузовом и салоном: полировка, химчистка, детейлинг и защитные покрытия. Результат — безупречный внешний вид и надёжная защита лакокрасочного покрытия.",
  },
  en: {
    title: "Detailing & Polishing",
    cardDescription:
      "Polishing. Interior deep cleaning. Detailing. Protective coatings. Everything in one package.",
    modalLead: "Opening very soon",
    modalDescription:
      "Complete care for your vehicle's exterior and interior: polishing, deep cleaning, detailing and protective coatings. The result — an immaculate appearance and reliable protection for the paintwork.",
  },
} as const;

for (const loc of ["uk", "ru", "en"] as const) {
  test(`detailing card in ${loc} shows the exact new cardDescription`, () => {
    const svc = locales[loc].services.detailing;
    assert.equal(svc.cardDescription, EXPECTED[loc].cardDescription);
  });

  test(`detailing modal in ${loc} shows the exact new modalLead and modalDescription`, () => {
    const svc = locales[loc].services.detailing;
    assert.equal(svc.modalLead, EXPECTED[loc].modalLead);
    assert.equal(svc.modalDescription, EXPECTED[loc].modalDescription);
  });
}

test("detailing modal does not surface the old longDescription or bullets", () => {
  for (const [name, dict] of Object.entries(locales)) {
    const svc = dict.services.detailing;
    // modalDescription present + no modalSections => ServiceModal renders the
    // plain-paragraph branch, so longDescription and bullets are not shown.
    assert.ok(svc.modalDescription && svc.modalDescription.length > 0, `${name}: modalDescription missing`);
    assert.equal(svc.modalSections, undefined, `${name}: detailing must not use modalSections`);
    assert.notEqual(svc.modalDescription, svc.longDescription, `${name}: modalDescription duplicates longDescription`);
  }
});

test("detailing title and icon are unchanged", () => {
  for (const loc of ["uk", "ru", "en"] as const) {
    assert.equal(locales[loc].services.detailing.title, EXPECTED[loc].title);
  }
  const meta = services.find((s) => s.slug === "detailing");
  assert.ok(meta, "detailing service meta missing");
  assert.equal(meta.iconSrc, "/images/services/premium-3d/05-detailing-polishing-premium-3d.png");
  assert.equal(meta.icon.name, "DetailingIcon");
});

test("detailing keeps its original SEO fields (shortDescription, longDescription, bullets)", () => {
  const EXPECTED_SHORT = {
    uk: "Полірування кузова та професійний догляд за автомобілем.",
    ru: "Полировка кузова и профессиональный уход за автомобилем.",
    en: "Bodywork polishing and professional car care.",
  } as const;
  for (const loc of ["uk", "ru", "en"] as const) {
    const svc = locales[loc].services.detailing;
    assert.equal(svc.shortDescription, EXPECTED_SHORT[loc]);
    assert.ok(svc.longDescription.length > 0, `${loc}: longDescription emptied`);
    assert.equal(svc.bullets.length, 4, `${loc}: detailing bullets changed`);
  }
});

test("car-service structure from PR #11 is intact (modalLead + 5 sections + 19 items)", () => {
  for (const [name, dict] of Object.entries(locales)) {
    const svc = dict.services["car-service"];
    assert.ok(svc.modalLead && svc.modalLead.length > 0, `${name}: car-service modalLead missing`);
    assert.ok(svc.modalSections, `${name}: car-service modalSections missing`);
    assert.equal(svc.modalSections.length, 5, `${name}: car-service should have 5 sections`);
    assert.equal(
      svc.modalSections.reduce((total, s) => total + s.items.length, 0),
      19,
      `${name}: car-service should have 19 items`,
    );
  }
});

test("services other than car-service and detailing use the plain fallback (no modal/card overrides)", () => {
  for (const [name, dict] of Object.entries(locales)) {
    for (const slug of serviceSlugs) {
      if (slug === "car-service" || slug === "detailing") continue;
      const svc = dict.services[slug];
      assert.equal(svc.cardDescription, undefined, `${name}/${slug}: unexpected cardDescription`);
      assert.equal(svc.modalLead, undefined, `${name}/${slug}: unexpected modalLead`);
      assert.equal(svc.modalDescription, undefined, `${name}/${slug}: unexpected modalDescription`);
      assert.equal(svc.modalSections, undefined, `${name}/${slug}: unexpected modalSections`);
    }
  }
});

test("the SEO service page still reads shortDescription/longDescription/bullets and ignores card/modal overrides", () => {
  const source = readFileSync(
    join(here, "..", "app", "[locale]", "services", "[slug]", "page.tsx"),
    "utf8",
  );
  assert.ok(source.includes("copy.shortDescription"), "SEO page no longer uses shortDescription");
  assert.ok(source.includes("copy.longDescription"), "SEO page no longer uses longDescription");
  assert.ok(source.includes("copy.bullets"), "SEO page no longer uses bullets");
  assert.ok(!source.includes("cardDescription"), "SEO page references cardDescription");
  assert.ok(!source.includes("modalDescription"), "SEO page references modalDescription");
  assert.ok(!source.includes("modalLead"), "SEO page references modalLead");
  assert.ok(!source.includes("modalSections"), "SEO page references modalSections");
});

test("ServicesGrid renders the card with cardDescription falling back to shortDescription", () => {
  const source = readFileSync(join(here, "..", "components", "ServicesGrid.tsx"), "utf8");
  assert.ok(
    source.includes("copy.cardDescription ?? copy.shortDescription"),
    "ServicesGrid card no longer prefers cardDescription",
  );
});

test("ServiceModal renders the modalDescription paragraph branch", () => {
  const source = readFileSync(join(here, "..", "components", "ServiceModal.tsx"), "utf8");
  assert.ok(source.includes("content.modalDescription"), "ServiceModal does not render modalDescription");
  // structured branch (PR #11) still present
  assert.ok(source.includes("content.modalSections"), "ServiceModal lost the modalSections branch");
  // old fallback still present
  assert.ok(source.includes("content.bullets"), "ServiceModal lost the longDescription + bullets fallback");
});
