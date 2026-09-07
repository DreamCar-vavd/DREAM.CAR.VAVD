import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  contactConfirmedText,
  getContactLangStatus,
  getContactPublishBlockers,
  isSafeUrl,
  isValidEmail,
  isValidPhone,
  type CmsContact,
  type CmsContactLanguage,
} from "./contactGate";
import type { ReviewState } from "./carsGate";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function lang(over: Partial<CmsContactLanguage> = {}): CmsContactLanguage {
  return {
    heading: "Контакти",
    subheading: "Зв'яжіться будь-яким зручним способом",
    hoursLabel: "",
    addressLabel: "",
    ...over,
  };
}

function contact(over: Partial<CmsContact> = {}): CmsContact {
  return {
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
    uk: lang(),
    en: lang(),
    ru: lang(),
    ...over,
  };
}

function reviewedAll(c: CmsContact): ReviewState {
  return {
    [c.id]: {
      uk: { hash: sha256(contactConfirmedText(c.uk)), at: "t" },
      en: { hash: sha256(contactConfirmedText(c.en)), at: "t" },
      ru: { hash: sha256(contactConfirmedText(c.ru)), at: "t" },
    },
  };
}

test("a contact with only the required facts + all empty optional fields publishes", () => {
  const c = contact();
  assert.deepEqual(getContactPublishBlockers(c, { review: reviewedAll(c), sha256 }), []);
});

test("shared facts are entered once; the same phone/email serves all three languages", () => {
  const c = contact();
  // No per-language phone/email fields exist on the model at all.
  assert.equal("phoneDisplay" in c.uk, false);
  assert.equal("email" in c.uk, false);
});

test("changing the public email does NOT appear in the review hash (not a translated fact)", () => {
  const before = contactConfirmedText(lang());
  // priceNote-equivalent: email is not part of the per-language confirmed text.
  assert.ok(!before.includes("email"));
  const c1 = contact();
  const c2 = contact({ email: "hello@example.com" });
  const review = reviewedAll(c1);
  for (const l of ["uk", "en", "ru"] as const) {
    assert.equal(getContactLangStatus(c2, l, { review, sha256 }), "reviewed");
  }
  assert.deepEqual(getContactPublishBlockers(c2, { review, sha256 }), []);
});

test("an unfinished language blocks only its own review", () => {
  const c = contact({ ru: lang({ heading: "" }) });
  const b = getContactPublishBlockers(c, { review: reviewedAll(contact()), sha256 });
  assert.ok(b.some((f) => f.kind === "missing-field" && f.locale === "ru"));
  assert.ok(!b.some((f) => "locale" in f && f.locale === "uk"));
});

test("phone validation: shape only, optional", () => {
  assert.equal(isValidPhone(""), true);
  assert.equal(isValidPhone("+44 7706 054203"), true);
  assert.equal(isValidPhone("07706054203"), true);
  assert.equal(isValidPhone("call us"), false);
  assert.equal(isValidPhone("+44"), false);
});

test("email validation: shape only, optional", () => {
  assert.equal(isValidEmail(""), true);
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("a@b"), false);
});

test("social / map URLs: only https + an allow-listed host is accepted", () => {
  assert.equal(isSafeUrl("telegramUrl", "https://t.me/dreamcar"), true);
  assert.equal(isSafeUrl("instagramUrl", "https://www.instagram.com/dreamcar"), true);
  assert.equal(isSafeUrl("facebookUrl", "https://facebook.com/dreamcar"), true);
  assert.equal(isSafeUrl("youtubeUrl", "https://youtu.be/abc"), true);
  assert.equal(isSafeUrl("mapsUrl", "https://maps.app.goo.gl/abc"), true);
  assert.equal(isSafeUrl("telegramUrl", ""), true); // empty optional

  // Wrong scheme
  assert.equal(isSafeUrl("telegramUrl", "http://t.me/x"), false);
  assert.equal(isSafeUrl("instagramUrl", "javascript:alert(1)"), false);
  assert.equal(isSafeUrl("mapsUrl", "data:text/html,evil"), false);
  // Wrong host (open redirect / look-alike)
  assert.equal(isSafeUrl("telegramUrl", "https://t.me.evil.com/x"), false);
  assert.equal(isSafeUrl("instagramUrl", "https://instagram.com.evil.com/x"), false);
  assert.equal(isSafeUrl("facebookUrl", "https://evil.com/facebook.com"), false);
  // Not a URL at all
  assert.equal(isSafeUrl("telegramUrl", "t.me/x"), false);
});

test("a bad social URL is a publish blocker naming that field", () => {
  const c = contact({ instagramUrl: "http://instagram.com/x", telegramUrl: "https://evil.com" });
  const b = getContactPublishBlockers(c, { review: reviewedAll(contact()), sha256 });
  assert.ok(b.some((f) => "field" in f && f.field === "instagramUrl"));
  assert.ok(b.some((f) => "field" in f && f.field === "telegramUrl"));
});

test("editing a localized label after review re-opens only that language", () => {
  const original = contact();
  const review = reviewedAll(original);
  const edited = contact({ uk: lang({ subheading: "ЗМІНЕНО" }) });
  assert.equal(getContactLangStatus(edited, "uk", { review, sha256 }), "needs-review");
  assert.equal(getContactLangStatus(edited, "en", { review, sha256 }), "reviewed");
});
