import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  getServiceLangStatus,
  getServicePublishBlockers,
  isServiceRenderable,
  isValidPriceAmount,
  serviceConfirmedText,
  servicePriceForLocale,
  type CmsService,
  type CmsServiceLanguage,
} from "./serviceGate";
import type { ReviewState } from "./carsGate";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function lang(over: Partial<CmsServiceLanguage> = {}): CmsServiceLanguage {
  return {
    title: "Автопідбір",
    shortDescription: "Підбір авто під ключ.",
    longDescription: "Технічна й юридична перевірка кожного варіанта.",
    cardDescription: "",
    bullets: ["Пошук", "Огляд"],
    modalLead: "",
    modalDescription: "",
    modalSections: [{ heading: "Що входить", items: ["Огляд", "Звіт"] }],
    priceNote: "",
    seoTitle: "",
    seoDescription: "",
    ...over,
  };
}

function service(over: Partial<CmsService> = {}): CmsService {
  return {
    id: "car-selection",
    order: 10,
    status: "available",
    iconSrc: "/images/services/premium-3d/01-car-selection-premium-3d.png",
    priceAmount: "",
    priceCurrency: "£",
    photos: [],
    uk: lang(),
    en: lang(),
    ru: lang(),
    ...over,
  };
}

function reviewedAll(s: CmsService): ReviewState {
  return {
    [s.id]: {
      uk: { hash: sha256(serviceConfirmedText(s.uk)), at: "t" },
      en: { hash: sha256(serviceConfirmedText(s.en)), at: "t" },
      ru: { hash: sha256(serviceConfirmedText(s.ru)), at: "t" },
    },
  };
}

test("a filled + reviewed service publishes; every published service renders", () => {
  const s = service();
  assert.deepEqual(getServicePublishBlockers(s, { review: reviewedAll(s), sha256 }), []);
  assert.equal(isServiceRenderable(), true);
});

test("structured modal sections survive the confirmed-text round trip verbatim", () => {
  const s = service({
    uk: lang({
      modalSections: [
        { heading: "ТО", items: ["Заміна масла та фільтрів", "Підготовка до MOT"] },
        { heading: "Діагностика", items: ["Зчитування помилок", "SRS AIRBAG"] },
      ],
    }),
  });
  const parsed = JSON.parse(serviceConfirmedText(s.uk));
  assert.equal(parsed.modalSections.length, 2);
  assert.deepEqual(parsed.modalSections[0].items, [
    "Заміна масла та фільтрів",
    "Підготовка до MOT",
  ]);
  // Reviewing then reordering an item re-opens that language's review.
  const review = reviewedAll(s);
  const reordered = service({
    uk: lang({
      modalSections: [
        { heading: "ТО", items: ["Підготовка до MOT", "Заміна масла та фільтрів"] },
        { heading: "Діагностика", items: ["Зчитування помилок", "SRS AIRBAG"] },
      ],
    }),
  });
  assert.equal(getServiceLangStatus(reordered, "uk", { review, sha256 }), "needs-review");
});

test("empty required text blocks publish for that language only", () => {
  const s = service({ ru: lang({ longDescription: "  " }) });
  const b = getServicePublishBlockers(s, { review: reviewedAll(service()), sha256 });
  assert.ok(b.some((f) => f.kind === "missing-field" && f.locale === "ru"));
  assert.ok(!b.some((f) => "locale" in f && f.locale === "uk"));
  assert.ok(!b.some((f) => "locale" in f && f.locale === "en"));
});

test("an unfinished language blocks only its own review, not the others", () => {
  const s = service();
  const partial: ReviewState = {
    [s.id]: {
      uk: { hash: sha256(serviceConfirmedText(s.uk)), at: "t" },
      en: { hash: sha256(serviceConfirmedText(s.en)), at: "t" },
    },
  };
  const b = getServicePublishBlockers(s, { review: partial, sha256 });
  assert.deepEqual(
    b.filter((f) => f.kind === "needs-review").map((f) => (f as { locale: string }).locale),
    ["ru"],
  );
});

test("editing structured text after review re-opens that language", () => {
  const original = service();
  const review = reviewedAll(original);
  const edited = service({ uk: lang({ longDescription: "ЗМІНЕНО" }) });
  assert.equal(getServiceLangStatus(edited, "uk", { review, sha256 }), "needs-review");
  assert.equal(getServiceLangStatus(edited, "en", { review, sha256 }), "reviewed");
});

test("changing only the shared numeric price / status keeps every translation reviewed", () => {
  const original = service();
  const review = reviewedAll(original);
  const repriced = service({ priceAmount: "60", priceCurrency: "£", status: "coming-soon" });
  assert.deepEqual(getServicePublishBlockers(repriced, { review, sha256 }), []);
  for (const l of ["uk", "en", "ru"] as const) {
    assert.equal(getServiceLangStatus(repriced, l, { review, sha256 }), "reviewed");
  }
});

test("changing a per-language price NOTE re-opens only that language's review", () => {
  const original = service();
  const review = reviewedAll(original);
  const noted = service({ uk: lang({ priceNote: "за домовленістю" }) });
  assert.equal(getServiceLangStatus(noted, "uk", { review, sha256 }), "needs-review");
  assert.equal(getServiceLangStatus(noted, "en", { review, sha256 }), "reviewed");
  assert.equal(getServiceLangStatus(noted, "ru", { review, sha256 }), "reviewed");
});

test("price display: numeric amount wins over note; falls back to the locale note; else empty", () => {
  assert.equal(servicePriceForLocale(service({ priceAmount: "60" }), "uk"), "£60");
  assert.equal(
    servicePriceForLocale(service({ priceAmount: "60", priceCurrency: "" }), "uk"),
    "60",
  );
  assert.equal(
    servicePriceForLocale(
      service({ priceAmount: "", uk: lang({ priceNote: "за домовленістю" }) }),
      "uk",
    ),
    "за домовленістю",
  );
  assert.equal(
    servicePriceForLocale(
      service({
        priceAmount: "60",
        uk: lang({ priceNote: "за домовленістю" }),
      }),
      "uk",
    ),
    "£60",
  );
  assert.equal(servicePriceForLocale(service(), "en"), "");
});

test("a non-numeric shared price amount is a publish blocker", () => {
  assert.equal(isValidPriceAmount(""), true);
  assert.equal(isValidPriceAmount("60"), true);
  assert.equal(isValidPriceAmount("60.00"), true);
  assert.equal(isValidPriceAmount("від £60"), false);
  assert.equal(isValidPriceAmount("60,00"), false);
  const s = service({ priceAmount: "від £60" });
  assert.ok(
    getServicePublishBlockers(s, { review: reviewedAll(service()), sha256 }).some(
      (f) => f.kind === "missing-field" && f.field === "priceAmount",
    ),
  );
});

test("slug must be kebab-case; a bad id blocks publish", () => {
  for (const bad of ["Car_Selection", "car selection", "car--", "CarSelection", ""]) {
    const s = service({ id: bad });
    assert.ok(
      getServicePublishBlockers(s, { review: reviewedAll(service()), sha256 }).some(
        (f) => "field" in f && f.field === "slug",
      ),
      `expected «${bad}» to be rejected`,
    );
  }
  for (const ok of ["car-selection", "srs-airbag", "diagnostics", "x1"]) {
    const s = service({ id: ok });
    const r: ReviewState = {
      [ok]: {
        uk: { hash: sha256(serviceConfirmedText(s.uk)), at: "t" },
        en: { hash: sha256(serviceConfirmedText(s.en)), at: "t" },
        ru: { hash: sha256(serviceConfirmedText(s.ru)), at: "t" },
      },
    };
    assert.ok(!getServicePublishBlockers(s, { review: r, sha256 }).some((f) => "field" in f && f.field === "slug"));
  }
});
