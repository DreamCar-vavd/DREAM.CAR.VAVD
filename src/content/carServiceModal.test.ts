import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import uk from "./dictionaries/uk";
import ru from "./dictionaries/ru";
import en from "./dictionaries/en";
import { serviceSlugs } from "./services";

const locales = { uk, ru, en } as const;
const EXPECTED_ITEM_COUNTS = [4, 4, 3, 3, 5];

test("car-service exposes a non-empty modalLead in every locale", () => {
  for (const [name, dict] of Object.entries(locales)) {
    const svc = dict.services["car-service"];
    assert.ok(
      typeof svc.modalLead === "string" && svc.modalLead.length > 0,
      `${name}: car-service.modalLead is missing`,
    );
  }
});

test("car-service has 5 modalSections with 4/4/3/3/5 items in every locale", () => {
  for (const [name, dict] of Object.entries(locales)) {
    const sections = dict.services["car-service"].modalSections;
    assert.ok(sections, `${name}: car-service.modalSections is missing`);
    assert.equal(sections.length, 5, `${name}: expected exactly 5 modalSections`);
    assert.deepEqual(
      sections.map((s) => s.items.length),
      EXPECTED_ITEM_COUNTS,
      `${name}: unexpected per-section item counts`,
    );
    for (const section of sections) {
      assert.ok(section.heading.trim().length > 0, `${name}: empty section heading`);
      for (const item of section.items) {
        assert.ok(item.trim().length > 0, `${name}: empty section item`);
      }
    }
  }
});

test("modalSections item counts are identical across the three locales", () => {
  const perLocale = Object.values(locales).map((dict) =>
    (dict.services["car-service"].modalSections ?? []).map((s) => s.items.length),
  );
  assert.deepEqual(perLocale[0], perLocale[1]);
  assert.deepEqual(perLocale[0], perLocale[2]);
});

test("no service other than car-service defines modal-only fields", () => {
  for (const [name, dict] of Object.entries(locales)) {
    for (const slug of serviceSlugs) {
      if (slug === "car-service") continue;
      const svc = dict.services[slug];
      assert.equal(svc.modalLead, undefined, `${name}/${slug}: unexpected modalLead`);
      assert.equal(svc.modalSections, undefined, `${name}/${slug}: unexpected modalSections`);
    }
  }
});

test("car-service still provides the fallback longDescription + bullets", () => {
  for (const [name, dict] of Object.entries(locales)) {
    const svc = dict.services["car-service"];
    assert.ok(svc.longDescription.length > 0, `${name}: longDescription was emptied`);
    assert.ok(svc.bullets.length > 0, `${name}: bullets were emptied`);
  }
});

test("the SEO service page does not consume the modal-only fields", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pagePath = join(here, "..", "app", "[locale]", "services", "[slug]", "page.tsx");
  const source = readFileSync(pagePath, "utf8");
  assert.ok(!source.includes("modalSections"), "SEO page references modalSections");
  assert.ok(!source.includes("modalLead"), "SEO page references modalLead");
});
