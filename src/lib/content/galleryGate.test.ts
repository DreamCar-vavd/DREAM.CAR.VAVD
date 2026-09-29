import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describeFailure, type GateContext } from "./carsGate";
import {
  galleryConfirmedText,
  getGalleryPublishBlockers,
  type CmsGalleryLanguage,
  type CmsGalleryProject,
} from "./galleryGate";

const ID = "dQw4w9WgXcQ"; // same well-known 11-char id shape as youtube.test.ts
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function lang(title: string): CmsGalleryLanguage {
  return {
    title,
    shortDescription: "",
    longDescription: "",
    service: "",
    clientRequest: "",
    completedItems: [],
    result: "",
  };
}

function project(videoUrl: string): CmsGalleryProject {
  return {
    id: "test-project",
    order: 1,
    kind: "album",
    year: "2024",
    photos: [{ image: "/images/cms/gallery/test-project/photos/0/image.jpg", caption: "" }],
    videoUrl,
    showContactCta: true,
    uk: lang("Тест"),
    en: lang("Test"),
    ru: lang("Test RU"),
  };
}

/** Every locale confirmed-reviewed, so the ONLY possible blocker left is the video link. */
function reviewedCtx(p: CmsGalleryProject): GateContext {
  const at = "2026-09-29T00:00:00.000Z";
  return {
    review: {
      [p.id]: {
        uk: { hash: sha256(galleryConfirmedText(p.uk)), at },
        en: { hash: sha256(galleryConfirmedText(p.en)), at },
        ru: { hash: sha256(galleryConfirmedText(p.ru)), at },
      },
    },
    sha256,
  };
}

test("galleryGate: an empty (or whitespace-only) videoUrl does not block publishing", () => {
  for (const videoUrl of ["", "   "]) {
    const p = project(videoUrl);
    assert.deepEqual(getGalleryPublishBlockers(p, reviewedCtx(p)), [], JSON.stringify(videoUrl));
  }
});

test("galleryGate: a valid YouTube link in any supported format does not block publishing", () => {
  for (const videoUrl of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
  ]) {
    const p = project(videoUrl);
    assert.deepEqual(getGalleryPublishBlockers(p, reviewedCtx(p)), [], videoUrl);
  }
});

test("galleryGate: a non-empty invalid link blocks publishing with video-link-invalid and a concrete reason the panel shows", () => {
  const cases: [string, RegExp][] = [
    [`http://www.youtube.com/watch?v=${ID}`, /https/],
    ["javascript:alert(1)", /https/],
    ["https://vimeo.com/12345678", /домен/],
    [`https://youtube.com.evil.example/watch?v=${ID}`, /домен/],
    ["https://www.youtube.com/watch?v=short", /ID/],
    ["not a url at all", /URL/],
  ];
  for (const [videoUrl, reason] of cases) {
    const p = project(videoUrl);
    const failures = getGalleryPublishBlockers(p, reviewedCtx(p));
    assert.equal(failures.length, 1, `exactly one blocker expected for ${videoUrl}`);
    const [f] = failures;
    assert.equal(f.kind, "video-link-invalid", videoUrl);
    if (f.kind === "video-link-invalid") assert.match(f.reason, reason, videoUrl);
    // The panel renders blockers through describeFailure: the reason is shown verbatim.
    assert.match(describeFailure(f), /^посилання на відео некоректне — .+/, videoUrl);
  }
});
