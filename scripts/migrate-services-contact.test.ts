/**
 * Structural integrity of the committed service files + the contact record.
 *
 * The one-off migration (dictionaries -> CMS) is long done and the panel is
 * now the source of truth for these texts: `getDictionary` overlays the
 * published CMS copy on top of the static dictionaries everywhere on the
 * site. So this test no longer pins any text, price, status or contact value
 * to the dictionaries — editing them in the panel must not require a code PR.
 * It only guards the shape the site relies on. Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { coerceService } from "../src/lib/content/coerce";

const ROOT = path.resolve(import.meta.dirname, "..");
const readRaw = (rel: string) => JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
const readSvc = (slug: string) => coerceService(slug, readRaw(`src/content/cms/services/${slug}.json`));
const SLUGS = ["car-selection", "car-service", "diagnostics", "srs-airbag", "detailing"];
const LOCALES = ["uk", "en", "ru"] as const;

test("all 5 services are present with their original ids and distinct numeric order", () => {
  const seen = SLUGS.map(readSvc);
  assert.deepEqual(
    seen.map((s) => s.id),
    SLUGS,
  );
  for (const slug of SLUGS) {
    assert.equal(readRaw(`src/content/cms/services/${slug}.json`).id, slug, `${slug} file id`);
  }
  const orders = seen.map((s) => s.order);
  assert.ok(orders.every((o) => Number.isFinite(o)), "every order is a number");
  assert.equal(new Set(orders).size, orders.length, "orders are distinct");
});

test("every service has a known status and a currency", () => {
  for (const slug of SLUGS) {
    const raw = readRaw(`src/content/cms/services/${slug}.json`);
    assert.ok(["available", "coming-soon"].includes(raw.status), `${slug} status ${raw.status}`);
    assert.ok(readSvc(slug).priceCurrency.trim(), `${slug} currency`);
  }
});

test("every service has a non-empty title and card text in every language", () => {
  for (const slug of SLUGS) {
    const s = readSvc(slug);
    for (const l of LOCALES) {
      assert.ok(s[l].title.trim(), `${slug}/${l} title`);
      assert.ok((s[l].cardDescription || s[l].shortDescription).trim(), `${slug}/${l} card text`);
    }
  }
});

test("structured modal blocks, when present, each have a heading and items", () => {
  for (const slug of SLUGS) {
    const s = readSvc(slug);
    for (const l of LOCALES) {
      for (const block of s[l].modalSections) {
        assert.ok(block.heading.trim(), `${slug}/${l} block heading`);
        assert.ok(block.items.length > 0, `${slug}/${l} block "${block.heading}" items`);
      }
    }
  }
});

test("contact record: id, phone, email and WhatsApp are well-formed; headings present", () => {
  const c = readRaw("src/content/cms/contact/site.json");
  assert.equal(c.id, "site");
  assert.match(c.phoneE164, /^\+\d{7,15}$/);
  assert.match(c.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.match(c.whatsappNumber, /^\d{7,15}$/);
  for (const f of ["telegramUrl", "instagramUrl", "facebookUrl", "youtubeUrl", "addressText", "mapsUrl", "hours"]) {
    assert.equal(typeof (c[f] ?? ""), "string", `${f} is text when present`);
  }
  for (const l of LOCALES) {
    assert.ok(String(c[l]?.heading ?? "").trim(), `${l} heading`);
    assert.ok(String(c[l]?.subheading ?? "").trim(), `${l} subheading`);
  }
});
