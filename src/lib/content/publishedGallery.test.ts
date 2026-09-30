import { test, mock } from "node:test";
import assert from "node:assert/strict";

/**
 * `publishedGallery.ts` statically imports "server-only" and reads through
 * `./siteContent` and `./imageSize`, so all three are mocked BEFORE the first
 * `await import` (same pattern as siteContent.test.ts). What is under test is
 * the real `getGalleryMedia` mapping of each project's `videoUrl`.
 */
const mockExports = (exports: object): Parameters<typeof mock.module>[1] =>
  ({ exports }) as Parameters<typeof mock.module>[1];

const ID = "dQw4w9WgXcQ"; // same well-known 11-char id shape as youtube.test.ts
const WATCH = `https://www.youtube.com/watch?v=${ID}`;

const lang = {
  title: "T",
  shortDescription: "",
  longDescription: "",
  service: "",
  clientRequest: "",
  completedItems: [],
  result: "",
};
function project(id: string, kind: "album" | "showcase", videoUrl: string) {
  return {
    id,
    order: 1,
    kind,
    year: "",
    photos: [{ image: `/images/cms/gallery/${id}/photos/0/image.jpg`, caption: "" }],
    videoUrl,
    showContactCta: true,
    uk: lang,
    en: lang,
    ru: lang,
  };
}

mock.module("server-only", mockExports({}));
mock.module(
  "./siteContent",
  mockExports({
    readSiteContent: async () => ({
      gallery: [
        project("album-watch-extra-params", "album", `https://www.youtube.com/watch?list=PL123&v=${ID}&t=42s`),
        project("showcase-youtu-be", "showcase", `https://youtu.be/${ID}`),
        project("album-shorts", "album", `https://www.youtube.com/shorts/${ID}`),
        project("album-embed", "album", `https://www.youtube.com/embed/${ID}`),
        project("album-empty", "album", ""),
        project("album-http", "album", `http://www.youtube.com/watch?v=${ID}`),
        project("album-spoof", "album", `https://youtube.com.evil.example/watch?v=${ID}`),
        project("showcase-other-host", "showcase", "https://vimeo.com/12345678"),
      ],
    }),
  }),
);
mock.module("./imageSize", mockExports({ imageSize: async () => ({ width: 4, height: 3 }) }));

test("getGalleryMedia: every project (album or showcase) gets youtubeWatchUrl — the normalized watch URL for a valid link, null for empty or invalid", async () => {
  const { getGalleryMedia } = await import("./publishedGallery");
  const media = await getGalleryMedia();
  assert.deepEqual(
    Object.fromEntries(media.map((m) => [m.id, m.youtubeWatchUrl])),
    {
      "album-watch-extra-params": WATCH,
      "showcase-youtu-be": WATCH,
      "album-shorts": WATCH,
      "album-embed": WATCH,
      "album-empty": null,
      "album-http": null,
      "album-spoof": null,
      "showcase-other-host": null,
    },
  );
});

test("getGalleryMedia: the raw content URL never reaches the client-bound entries", async () => {
  const { getGalleryMedia } = await import("./publishedGallery");
  const serialized = JSON.stringify(await getGalleryMedia());
  for (const raw of ["list=PL123", "youtu.be", "/shorts/", "/embed/", "evil.example", "vimeo.com", "http://"]) {
    assert.equal(serialized.includes(raw), false, `raw fragment ${raw} leaked`);
  }
});
