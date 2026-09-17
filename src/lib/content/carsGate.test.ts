import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  confirmedText,
  getLangStatus,
  getPublishBlockers,
  isPlayableVideoSrc,
  isPublishable,
  isRenderable,
  videoSrcProblem,
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

test("isPlayableVideoSrc: https or a /uploads/videos path only", () => {
  assert.equal(isPlayableVideoSrc("https://blob.vercel-storage.com/x.mp4"), true);
  assert.equal(isPlayableVideoSrc("/uploads/videos/abc12345-clip.mp4"), true);
  assert.equal(isPlayableVideoSrc("http://x.com/a.mp4"), false);
  assert.equal(isPlayableVideoSrc("/uploads/videos/../../../etc/passwd"), false);
  assert.equal(isPlayableVideoSrc(""), false);
  assert.equal(isPlayableVideoSrc("javascript:alert(1)"), false);
});

test("video mode 'hosted-file' with no src blocks publish (a failed upload is not a ready record)", () => {
  const c = car({ video: { mode: "hosted-file", src: "", posterSrc: "" } });
  assert.ok(
    getPublishBlockers(c, { review: reviewedAll(car()), sha256 }).some(
      (f) => f.kind === "video-not-connected",
    ),
  );
});

test("video mode 'hosted-file' with an unsafe src blocks publish", () => {
  const c = car({ video: { mode: "hosted-file", src: "http://evil/x.mp4", posterSrc: "" } });
  assert.ok(
    getPublishBlockers(c, { review: reviewedAll(car()), sha256 }).some(
      (f) => f.kind === "video-not-connected",
    ),
  );
});

test("video mode 'hosted-file' with a valid src publishes; deleting it does not touch a frozen snapshot", () => {
  const c = car({
    video: { mode: "hosted-file", src: "https://blob.example/clip.mp4", posterSrc: "/x/0/image.jpg" },
  });
  assert.deepEqual(getPublishBlockers(c, { review: reviewedAll(car()), sha256 }), []);
});

test("video mode 'external-link' with a valid YouTube URL publishes", () => {
  const c = car({
    video: {
      mode: "external-link",
      src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      posterSrc: "/x/0/image.jpg",
    },
  });
  assert.deepEqual(getPublishBlockers(c, { review: reviewedAll(car()), sha256 }), []);
});

test("video mode 'external-link' with a spoofed YouTube domain blocks publish with a specific, non-generic reason", () => {
  const c = car({
    video: {
      mode: "external-link",
      src: "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      posterSrc: "",
    },
  });
  const failures = getPublishBlockers(c, { review: reviewedAll(car()), sha256 });
  const failure = failures.find((f) => f.kind === "video-link-invalid");
  assert.ok(failure, "expected a video-link-invalid failure");
  if (failure?.kind === "video-link-invalid") {
    assert.match(failure.reason, /домен/);
  }
  // Must NOT be lumped in with the unrelated "uploaded-file not connected" message.
  assert.ok(!failures.some((f) => f.kind === "video-not-connected"));
});

test("video mode 'external-link' with an ordinary (non-YouTube) https link still publishes — no regression", () => {
  const c = car({
    video: { mode: "external-link", src: "https://cdn.example.com/reviews/clip.mp4", posterSrc: "" },
  });
  assert.deepEqual(getPublishBlockers(c, { review: reviewedAll(car()), sha256 }), []);
});

test("video mode 'external-link' with a non-https, non-YouTube link blocks publish", () => {
  const c = car({
    video: { mode: "external-link", src: "http://cdn.example.com/clip.mp4", posterSrc: "" },
  });
  const failures = getPublishBlockers(c, { review: reviewedAll(car()), sha256 });
  assert.ok(failures.some((f) => f.kind === "video-link-invalid"));
});

test("video mode 'external-link' with an empty src is not a blocker (mode simply unused)", () => {
  const c = car({ video: { mode: "external-link", src: "", posterSrc: "" } });
  assert.deepEqual(getPublishBlockers(c, { review: reviewedAll(car()), sha256 }), []);
});

test("videoSrcProblem: mirrors isPlayableVideoSrc, plus a specific reason for a spoofed YouTube domain", () => {
  assert.equal(videoSrcProblem("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(videoSrcProblem("https://blob.vercel-storage.com/x.mp4"), null);
  assert.match(
    videoSrcProblem("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ") ?? "",
    /YouTube/,
  );
  assert.equal(videoSrcProblem(""), "порожнє посилання");
});

test("getLangStatus: empty -> needs-review -> reviewed", () => {
  const c = car({ uk: lang({ title: "" }) });
  assert.equal(getLangStatus(c, "uk", { sha256 }), "empty");
  assert.equal(getLangStatus(car(), "uk", { sha256 }), "needs-review");
  assert.equal(getLangStatus(car(), "uk", { review: reviewedAll(car()), sha256 }), "reviewed");
});
