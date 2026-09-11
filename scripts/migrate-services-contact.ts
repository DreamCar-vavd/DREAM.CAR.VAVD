/**
 * One-off, re-runnable migration of the existing Services + site Contacts into
 * the panel content model. Run with tsx (imports the dictionaries directly so
 * the copy is byte-for-byte verbatim):
 *
 *   npx tsx scripts/migrate-services-contact.ts
 *
 * Source of truth (captured verbatim, main @ ce1977af):
 *   src/content/dictionaries/{uk,en,ru}.ts -> services.*
 *   src/content/services.ts                -> iconSrc per slug
 *   src/lib/social.ts DEFAULT_CONTACT + dictionaries.*.contact.{heading,subheading}
 *
 * What it does:
 *  1. writes src/content/cms/services/<slug>.json — the WORKING copy Keystatic edits.
 *  2. writes src/content/cms/contact/site.json — the single site-contact record.
 *  3. patches src/content/cms/published.json — adds `services` + `contact` keys
 *     (the same 5 services + contact are already live via the old static dict,
 *     so all of them go into the snapshot; nothing new is exposed).
 *  4. patches src/content/cms/review-state.json — every locale confirmed
 *     (the migrated copy is exactly what production already ships).
 *
 * NOT migrated (none exist — must not be invented, see task 21-16 §3):
 *   price, service photos, address, working hours, map link, social URLs
 *   (socials keep coming from NEXT_PUBLIC_* env until entered in the panel).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ukDict from "../src/content/dictionaries/uk";
import enDict from "../src/content/dictionaries/en";
import ruDict from "../src/content/dictionaries/ru";
import { serviceConfirmedText, type CmsService, type CmsServiceLanguage } from "../src/lib/content/serviceGate";
import { contactConfirmedText, type CmsContact } from "../src/lib/content/contactGate";
import { coerceCar, coerceGalleryProject } from "../src/lib/content/coerce";

const ROOT = path.resolve(import.meta.dirname, "..");
const SERVICES_DIR = path.join(ROOT, "src/content/cms/services");
const CONTACT_DIR = path.join(ROOT, "src/content/cms/contact");
const PUBLISHED = path.join(ROOT, "src/content/cms/published.json");
const REVIEW = path.join(ROOT, "src/content/cms/review-state.json");

const at = "2026-09-06T00:00:00.000Z";
const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** slug -> iconSrc, verbatim from src/content/services.ts, and display order. */
const ICONS: Record<string, string> = {
  "car-selection": "/images/services/premium-3d/01-car-selection-premium-3d.png",
  "car-service": "/images/services/premium-3d/02-car-service-premium-3d.png",
  diagnostics: "/images/services/premium-3d/03-computer-diagnostics-premium-3d.png",
  "srs-airbag": "/images/services/premium-3d/04-srs-airbag-premium-3d.png",
  detailing: "/images/services/premium-3d/05-detailing-polishing-premium-3d.png",
};
const ORDER = ["car-selection", "car-service", "diagnostics", "srs-airbag", "detailing"];
/** Availability copied unchanged: these two show "Незабаром" today. */
const COMING_SOON = new Set(["car-service", "detailing"]);

function serviceLang(raw: Record<string, unknown>): CmsServiceLanguage {
  const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
  return {
    title: String(raw.title ?? ""),
    shortDescription: String(raw.shortDescription ?? ""),
    longDescription: String(raw.longDescription ?? ""),
    cardDescription: String(raw.cardDescription ?? ""),
    bullets: arr(raw.bullets),
    modalLead: String(raw.modalLead ?? ""),
    modalDescription: String(raw.modalDescription ?? ""),
    modalSections: Array.isArray(raw.modalSections)
      ? (raw.modalSections as Record<string, unknown>[]).map((s) => ({
          heading: String(s.heading ?? ""),
          items: arr(s.items),
        }))
      : [],
    // No per-language price text existed pre-panel — not invented.
    priceNote: "",
    seoTitle: "",
    seoDescription: "",
  };
}

async function main() {
  await fs.mkdir(SERVICES_DIR, { recursive: true });
  await fs.mkdir(CONTACT_DIR, { recursive: true });

  const publishedServices: CmsService[] = [];
  const review: Record<string, unknown> = JSON.parse(await fs.readFile(REVIEW, "utf8"));

  for (const [i, slug] of ORDER.entries()) {
    const svc: CmsService = {
      id: slug,
      order: (i + 1) * 10,
      status: COMING_SOON.has(slug) ? "coming-soon" : "available",
      iconSrc: ICONS[slug],
      // No prices existed pre-panel — amount empty, currency defaulted to £.
      priceAmount: "",
      priceCurrency: "£",
      photos: [],
      uk: serviceLang(
        (ukDict.services as unknown as Record<string, Record<string, unknown>>)[slug],
      ),
      en: serviceLang(
        (enDict.services as unknown as Record<string, Record<string, unknown>>)[slug],
      ),
      ru: serviceLang(
        (ruDict.services as unknown as Record<string, Record<string, unknown>>)[slug],
      ),
    };
    await fs.writeFile(
      path.join(SERVICES_DIR, `${slug}.json`),
      `${JSON.stringify(svc, null, 2)}\n`,
      "utf8",
    );
    publishedServices.push(svc);
    review[slug] = {
      uk: { hash: hash(serviceConfirmedText(svc.uk)), at },
      en: { hash: hash(serviceConfirmedText(svc.en)), at },
      ru: { hash: hash(serviceConfirmedText(svc.ru)), at },
    };
    console.log(`✓ service ${slug} (${svc.status})`);
  }

  const lang = (d: { contact: { heading: string; subheading: string } }) => ({
    heading: d.contact.heading,
    subheading: d.contact.subheading,
    hoursLabel: "",
    addressLabel: "",
  });
  const contact: CmsContact = {
    id: "site",
    order: 1,
    phoneDisplay: "+44 7706 054203",
    phoneE164: "+447706054203",
    email: "dream.car.vavd@gmail.com",
    whatsappNumber: "447706054203",
    telegramUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    youtubeUrl: "",
    addressText: "",
    mapsUrl: "",
    hours: "",
    uk: lang(ukDict),
    en: lang(enDict),
    ru: lang(ruDict),
  };
  await fs.writeFile(
    path.join(CONTACT_DIR, "site.json"),
    `${JSON.stringify(contact, null, 2)}\n`,
    "utf8",
  );
  review.site = {
    uk: { hash: hash(contactConfirmedText(contact.uk)), at },
    en: { hash: hash(contactConfirmedText(contact.en)), at },
    ru: { hash: hash(contactConfirmedText(contact.ru)), at },
  };
  console.log("✓ contact site");

  const published = JSON.parse(await fs.readFile(PUBLISHED, "utf8"));
  // Keep the migrated snapshot deterministic (re-runnable): the migrated cars +
  // gallery already carry this timestamp. A real publish from /panel sets its
  // own ISO time — that is expected and not reverted by re-running the script.
  published.publishedAt = at;
  // Normalise cars + gallery through the SAME coerce the panel applies on every
  // publish (rebuildSnapshot re-coerces sibling kinds), so the migrated snapshot
  // is already in canonical form and the first real publish adds no stray diff.
  published.cars = (Array.isArray(published.cars) ? published.cars : []).map(
    (c: Record<string, unknown>) => coerceCar(String(c.id ?? ""), c),
  );
  published.gallery = (Array.isArray(published.gallery) ? published.gallery : []).map(
    (g: Record<string, unknown>) => coerceGalleryProject(String(g.id ?? ""), g),
  );
  published.services = publishedServices;
  published.contact = [contact];
  // Banners / promos / news: no real material exists — the key is present but
  // empty so the public site renders nothing (no empty section, no stub).
  if (!Array.isArray(published.promos)) published.promos = [];
  await fs.writeFile(PUBLISHED, `${JSON.stringify(published, null, 2)}\n`, "utf8");
  await fs.writeFile(REVIEW, `${JSON.stringify(review, null, 2)}\n`, "utf8");

  console.log("\nMigration complete. Review: git status && git diff");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
