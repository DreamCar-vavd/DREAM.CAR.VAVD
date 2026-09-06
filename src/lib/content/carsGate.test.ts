import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  confirmedText,
  getLangStatus,
  getPublishBlockers,
  isPublishable,
  isRenderable,
  type CmsCar,
  type CmsCarLanguage,
  type ReviewState,
} from "./carsGate";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function lang(over: Partial<CmsCarLanguage> = {}): CmsCarLanguage {
  return {
    title: "Suzuki SX4 S-Cross",
    specLine: "1.4 Turbo • Petrol • Automatic",
    description: "",
    viewGalleryLabel: "View 10 photos",
    ...over,
  };
}

function car(over: Partial<CmsCar> = {}): CmsCar {
  return {
    id: "suzuki-sx4-s-cross",
    order: 1,
    saleStatus: "for-sale",
    year: "2020",
    price: "£9,500",
    mileageValue: 47170,
    photos: [{ image: "/x/0/image.jpg", caption: "" }],
    video: { mode: "none", src: "", posterSrc: "" },
    uk: lang(),
    en: lang(),
    ru: lang(),
    ...over,
  };
}

function reviewedAll(c: CmsCar): ReviewState {
  return {
    [c.id]: {
      uk: { hash: sha256(confirmedText(c.uk)), at: "t" },
      en: { hash: sha256(confirmedText(c.en)), at: "t" },
      ru: { hash: sha256(confirmedText(c.ru)), at: "t" },
    },
  };
}

test("a filled + reviewed car with photos is publishable", () => {
  const c = car();
  assert.equal(isPublishable(c, { review: reviewedAll(c), sha256 }), true);
});

test("sold/preparing are NOT publish blockers but ARE hidden from the site", () => {
  for (const s of ["sold", "preparing"] as const) {
    const c = car({ saleStatus: s });
    assert.equal(getPublishBlockers(c, { review: reviewedAll(car()), sha256 }).length, 0);
    assert.equal(isRenderable(c), false);
  }
  assert.equal(isRenderable(car({ saleStatus: "reserved" })), true);
  assert.equal(isRenderable(car({ saleStatus: "for-sale" })), true);
});

test("empty or whitespace-only required field blocks publish", () => {
  for (const bad of ["", "   ", "\n\t "]) {
    const c = car({ en: lang({ title: bad }) });
    const b = getPublishBlockers(c, { review: reviewedAll(car()), sha256 });
    assert.ok(b.some((f) => f.kind === "missing-field" && f.locale === "en"));
  }
});

test("a language with no review confirmation blocks publish", () => {
  const c = car();
  const b = getPublishBlockers(c, { review: { [c.id]: { uk: { hash: sha256(confirmedText(c.uk)), at: "t" }, en: { hash: sha256(confirmedText(c.en)), at: "t" } } }, sha256 });
  assert.ok(b.some((f) => f.kind === "needs-review" && f.locale === "ru"));
});

test("editing text after review makes that language need-review again", () => {
  const original = car();
  const review = reviewedAll(original);
  const edited = car({ uk: lang({ specLine: "1.4 Turbo • Бензин • ЗМІНЕНО" }) });
  assert.equal(getLangStatus(edited, "uk", { review, sha256 }), "needs-review");
  assert.ok(
    getPublishBlockers(edited, { review, sha256 }).some(
      (f) => f.kind === "needs-review" && f.locale === "uk",
    ),
  );
});

test("changing only shared price / sale status keeps every translation reviewed", () => {
  const original = car();
  const review = reviewedAll(original);
  const repriced = car({ price: "£8,900", saleStatus: "reserved" });
  assert.deepEqual(getPublishBlockers(repriced, { review, sha256 }), []);
  for (const l of ["uk", "en", "ru"] as const) {
    assert.equal(getLangStatus(repriced, l, { review, sha256 }), "reviewed");
  }
});

test("no photos blocks publish", () => {
  const c = car({ photos: [] });
  assert.ok(
    getPublishBlockers(c, { review: reviewedAll(car()), sha256 }).some((f) => f.kind === "no-photos"),
  );
});

test("video mode 'uploaded-file' blocks publish (not silently ignored)", () => {
  const c = car({ video: { mode: "uploaded-file", src: "", posterSrc: "" } });
  assert.ok(
    getPublishBlockers(c, { review: reviewedAll(car()), sha256 }).some(
      (f) => f.kind === "video-not-connected",
    ),
  );
});

test("getLangStatus: empty -> needs-review -> reviewed", () => {
  const c = car({ uk: lang({ title: "" }) });
  assert.equal(getLangStatus(c, "uk", { sha256 }), "empty");
  assert.equal(getLangStatus(car(), "uk", { sha256 }), "needs-review");
  assert.equal(getLangStatus(car(), "uk", { review: reviewedAll(car()), sha256 }), "reviewed");
});
