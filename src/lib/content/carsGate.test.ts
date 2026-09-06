import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  confirmedText,
  getCarGateFailures,
  getPublishBlockers,
  isCarPubliclyVisible,
  type CmsCar,
  type CmsCarLanguage,
} from "./carsGate";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function lang(over: Partial<CmsCarLanguage> = {}): CmsCarLanguage {
  return {
    title: "Suzuki SX4 S-Cross",
    specLine: "1.4 Turbo • Petrol • Automatic",
    description: "",
    viewGalleryLabel: "View 10 photos",
    reviewState: "confirmed",
    ...over,
  };
}

function car(over: Partial<CmsCar> = {}): CmsCar {
  return {
    id: "suzuki-sx4-s-cross",
    order: 1,
    publishState: "published",
    saleStatus: "for-sale",
    year: "2020",
    price: "£9,500",
    mileageValue: 47170,
    photos: [{ image: "a.jpg", caption: "" }],
    video: { mode: "none", src: "", posterSrc: "" },
    uk: lang(),
    en: lang(),
    ru: lang(),
    ...over,
  };
}

/** locks matching the default car, so a "confirmed" locale is not treated as stale. */
function freshLocks(c: CmsCar) {
  return {
    [c.id]: {
      uk: sha256(confirmedText(c.uk)),
      en: sha256(confirmedText(c.en)),
      ru: sha256(confirmedText(c.ru)),
    },
  };
}

test("a fully-filled, confirmed, for-sale, published car is public", () => {
  const c = car();
  assert.equal(isCarPubliclyVisible(c, { locks: freshLocks(c), sha256 }), true);
});

test("draft is hidden, but that is not a publish blocker", () => {
  const c = car({ publishState: "draft" });
  assert.equal(isCarPubliclyVisible(c, { locks: freshLocks(c), sha256 }), false);
  assert.deepEqual(getPublishBlockers(c, { locks: freshLocks(c), sha256 }), []);
});

test("sold and preparing are hidden; reserved and for-sale are shown", () => {
  for (const status of ["sold", "preparing"] as const) {
    assert.equal(isCarPubliclyVisible(car({ saleStatus: status }), { sha256 }), false);
  }
  for (const status of ["reserved", "for-sale"] as const) {
    const c = car({ saleStatus: status });
    assert.equal(isCarPubliclyVisible(c, { locks: freshLocks(c), sha256 }), true);
  }
});

test("an empty or whitespace-only required field blocks publish", () => {
  for (const bad of ["", "   ", "\n\t "]) {
    const c = car({ en: lang({ title: bad }) });
    const blockers = getPublishBlockers(c, { locks: freshLocks(car()), sha256 });
    assert.ok(
      blockers.some((f) => f.kind === "missing-field" && f.locale === "en"),
      `title=${JSON.stringify(bad)} should block`,
    );
  }
});

test("a language left unconfirmed blocks publish", () => {
  const c = car({ ru: lang({ reviewState: "draft" }) });
  const blockers = getPublishBlockers(c, { locks: freshLocks(car()), sha256 });
  assert.ok(blockers.some((f) => f.kind === "not-confirmed" && f.locale === "ru"));
});

test("editing confirmed text without re-confirming makes it stale", () => {
  const original = car();
  const locks = freshLocks(original);
  const edited = car({ uk: lang({ specLine: "1.4 Turbo • Бензин • Автомат • ЗМІНЕНО" }) });
  const blockers = getPublishBlockers(edited, { locks, sha256 });
  assert.ok(blockers.some((f) => f.kind === "confirmation-stale" && f.locale === "uk"));
  assert.equal(isCarPubliclyVisible(edited, { locks, sha256 }), false);
});

test("changing only the shared price/status never marks a translation stale", () => {
  const original = car();
  const locks = freshLocks(original);
  const repriced = car({ price: "£8,900", saleStatus: "reserved" });
  const blockers = getPublishBlockers(repriced, { locks, sha256 });
  assert.equal(blockers.length, 0);
  assert.equal(isCarPubliclyVisible(repriced, { locks, sha256 }), true);
});

test("a car with no photos blocks publish", () => {
  const c = car({ photos: [] });
  const blockers = getPublishBlockers(c, { locks: freshLocks(car()), sha256 });
  assert.ok(blockers.some((f) => f.kind === "no-photos"));
});

test("a missing locale object is reported, not thrown", () => {
  const c = car();
  // @ts-expect-error deliberately removing a required language
  delete c.ru;
  assert.doesNotThrow(() => getCarGateFailures(c, { sha256 }));
  assert.equal(isCarPubliclyVisible(c, { sha256 }), false);
});
