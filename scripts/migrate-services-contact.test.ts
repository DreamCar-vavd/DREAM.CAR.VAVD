/**
 * Migration integrity: the 5 committed service files + the contact record must
 * still match the source dictionaries verbatim (no structured block dropped,
 * no availability flipped, no price invented). Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ukDict from "../src/content/dictionaries/uk";
import enDict from "../src/content/dictionaries/en";
import ruDict from "../src/content/dictionaries/ru";
import { coerceService } from "../src/lib/content/coerce";

const ROOT = path.resolve(import.meta.dirname, "..");
const readSvc = (slug: string) =>
  coerceService(
    slug,
    JSON.parse(readFileSync(path.join(ROOT, `src/content/cms/services/${slug}.json`), "utf8")),
  );
const DICTS = { uk: ukDict, en: enDict, ru: ruDict } as const;
const SLUGS = ["car-selection", "car-service", "diagnostics", "srs-airbag", "detailing"];
const COMING_SOON = new Set(["car-service", "detailing"]);

test("all 5 services are present with their original ids and order", () => {
  const seen = SLUGS.map(readSvc);
  assert.deepEqual(seen.map((s) => s.id), SLUGS);
  assert.deepEqual(
    seen.map((s) => s.order),
    [10, 20, 30, 40, 50],
  );
});

test("availability is preserved verbatim — exactly car-service + detailing are «coming soon»", () => {
  for (const slug of SLUGS) {
    const s = readSvc(slug);
    assert.equal(
      s.status,
      COMING_SOON.has(slug) ? "coming-soon" : "available",
      `${slug} status`,
    );
  }
});

test("no invented prices — every amount empty, currency defaulted, every note empty", () => {
  for (const slug of SLUGS) {
    const s = readSvc(slug);
    assert.equal(s.priceAmount, "");
    assert.equal(s.priceCurrency, "£");
    for (const l of ["uk", "en", "ru"] as const) assert.equal(s[l].priceNote, "");
  }
});

test("every language text matches the source dictionary verbatim", () => {
  for (const slug of SLUGS) {
    const s = readSvc(slug);
    for (const l of ["uk", "en", "ru"] as const) {
      const src = (DICTS[l].services as unknown as Record<string, Record<string, unknown>>)[slug];
      assert.equal(s[l].title, src.title, `${slug}/${l} title`);
      assert.equal(s[l].shortDescription, src.shortDescription, `${slug}/${l} shortDescription`);
      assert.equal(s[l].longDescription, src.longDescription, `${slug}/${l} longDescription`);
      assert.deepEqual(s[l].bullets, src.bullets ?? [], `${slug}/${l} bullets`);
      assert.equal(s[l].cardDescription, src.cardDescription ?? "", `${slug}/${l} cardDescription`);
      assert.equal(s[l].modalLead, src.modalLead ?? "", `${slug}/${l} modalLead`);
      assert.equal(
        s[l].modalDescription,
        src.modalDescription ?? "",
        `${slug}/${l} modalDescription`,
      );
      assert.deepEqual(
        s[l].modalSections,
        (src.modalSections as unknown[]) ?? [],
        `${slug}/${l} modalSections`,
      );
    }
  }
});

test("car-service keeps all 5 structured modal blocks in every language", () => {
  const s = readSvc("car-service");
  for (const l of ["uk", "en", "ru"] as const) {
    assert.equal(s[l].modalSections.length, 5, `car-service/${l} block count`);
    assert.ok(s[l].modalSections.every((b) => b.heading && b.items.length > 0));
  }
});

test("contact record: shared facts migrated, nothing invented", () => {
  const c = JSON.parse(
    readFileSync(path.join(ROOT, "src/content/cms/contact/site.json"), "utf8"),
  );
  assert.equal(c.id, "site");
  assert.equal(c.phoneE164, "+447706054203");
  assert.equal(c.email, "dream.car.vavd@gmail.com");
  assert.equal(c.whatsappNumber, "447706054203");
  // Not invented:
  for (const f of ["telegramUrl", "instagramUrl", "facebookUrl", "youtubeUrl", "addressText", "mapsUrl", "hours"]) {
    assert.equal(c[f], "", `${f} must stay empty`);
  }
  for (const l of ["uk", "en", "ru"] as const) {
    assert.equal(c[l].heading, DICTS[l].contact.heading, `${l} heading`);
    assert.equal(c[l].subheading, DICTS[l].contact.subheading, `${l} subheading`);
  }
});
