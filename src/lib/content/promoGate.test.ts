import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  getPromoLangStatus,
  getPromoPublishBlockers,
  isPromoRenderable,
  isSafePromoLink,
  promoConfirmedText,
  type CmsPromo,
  type CmsPromoLanguage,
  type PromoType,
} from "./promoGate";
import type { ReviewState } from "./carsGate";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function lang(over: Partial<CmsPromoLanguage> = {}): CmsPromoLanguage {
  return { title: "Знижка 10%", summary: "На детейлінг у березні", linkLabel: "", body: "", ...over };
}
function promo(over: Partial<CmsPromo> = {}): CmsPromo {
  return {
    id: "spring-detailing",
    order: 10,
    type: "promo",
    visible: true,
    image: "",
    linkUrl: "",
    date: "",
    uk: lang(),
    en: lang(),
    ru: lang(),
    ...over,
  };
}
function reviewedAll(p: CmsPromo): ReviewState {
  return {
    [p.id]: {
      uk: { hash: sha256(promoConfirmedText(p.uk)), at: "t" },
      en: { hash: sha256(promoConfirmedText(p.en)), at: "t" },
      ru: { hash: sha256(promoConfirmedText(p.ru)), at: "t" },
    },
  };
}

test("a banner / promo needs only a title in each language", () => {
  for (const type of ["banner", "promo"] as PromoType[]) {
    const p = promo({ type });
    assert.deepEqual(getPromoPublishBlockers(p, { review: reviewedAll(p), sha256 }), []);
  }
});

test("a news item additionally requires the full body in each language", () => {
  const noBody = promo({ type: "news" });
  const b = getPromoPublishBlockers(noBody, { review: reviewedAll(noBody), sha256 });
  assert.equal(b.filter((f) => f.kind === "missing-field").length, 3); // body in uk/en/ru

  const withBody = promo({
    type: "news",
    uk: lang({ body: "текст" }),
    en: lang({ body: "text" }),
    ru: lang({ body: "текст" }),
  });
  assert.deepEqual(getPromoPublishBlockers(withBody, { review: reviewedAll(withBody), sha256 }), []);
});

test("editing the news body after review re-opens only that language", () => {
  const base = promo({
    type: "news",
    uk: lang({ body: "A" }),
    en: lang({ body: "B" }),
    ru: lang({ body: "C" }),
  });
  const review = reviewedAll(base);
  const edited = { ...base, uk: lang({ body: "A2" }) };
  assert.equal(getPromoLangStatus(edited, "uk", { review, sha256 }), "needs-review");
  assert.equal(getPromoLangStatus(edited, "en", { review, sha256 }), "reviewed");
});

test("link safety: internal path / hash / https allowed; http, javascript, data, protocol-relative rejected", () => {
  for (const ok of ["", "/uk/cars-for-sale", "#services", "https://instagram.com/x"]) {
    assert.equal(isSafePromoLink(ok), true, ok);
  }
  for (const bad of ["http://x.com", "javascript:alert(1)", "data:text/html,x", "//evil.com", "ftp://x"]) {
    assert.equal(isSafePromoLink(bad), false, bad);
  }
  const p = promo({ linkUrl: "javascript:alert(1)" });
  assert.ok(
    getPromoPublishBlockers(p, { review: reviewedAll(promo()), sha256 }).some(
      (f) => "field" in f && f.field === "linkUrl",
    ),
  );
});

test("a malformed news date is a blocker; the date NEVER triggers publication (display only)", () => {
  const good = promo({ type: "news", date: "2026-03-01", uk: lang({ body: "x" }), en: lang({ body: "x" }), ru: lang({ body: "x" }) });
  assert.deepEqual(getPromoPublishBlockers(good, { review: reviewedAll(good), sha256 }), []);
  const bad = promo({ date: "March 2026" });
  assert.ok(
    getPromoPublishBlockers(bad, { review: reviewedAll(promo()), sha256 }).some(
      (f) => "field" in f && f.field === "promoDate",
    ),
  );
  // there is no scheduling API surface — `date` is a plain string field.
});

test("a bad slug or unknown type blocks publish", () => {
  assert.ok(
    getPromoPublishBlockers(promo({ id: "Spring Sale" }), { review: reviewedAll(promo()), sha256 }).some(
      (f) => "field" in f && f.field === "slug",
    ),
  );
  assert.ok(
    getPromoPublishBlockers(promo({ type: "advert" as PromoType }), {
      review: reviewedAll(promo()),
      sha256,
    }).some((f) => "field" in f && f.field === "promoType"),
  );
});

test("visible:false stays publishable but does not render on the public site", () => {
  const hidden = promo({ visible: false });
  assert.deepEqual(getPromoPublishBlockers(hidden, { review: reviewedAll(hidden), sha256 }), []);
  assert.equal(isPromoRenderable(hidden), false);
  assert.equal(isPromoRenderable(promo({ visible: true })), true);
});

test("an unfinished language blocks only its own review", () => {
  const p = promo({ ru: lang({ title: "" }) });
  const b = getPromoPublishBlockers(p, { review: reviewedAll(promo()), sha256 });
  assert.ok(b.some((f) => f.kind === "missing-field" && f.locale === "ru"));
  assert.ok(!b.some((f) => "locale" in f && f.locale === "uk"));
});
