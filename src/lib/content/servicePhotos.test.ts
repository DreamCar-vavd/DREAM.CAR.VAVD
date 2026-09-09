import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { servicePhotoAlt, usableServicePhotos } from "./servicePhotos";

describe("usableServicePhotos", () => {
  it("keeps photos with a real src and positive dimensions", () => {
    const kept = usableServicePhotos([
      { src: "/images/cms/services/x/photos/0/image.jpg", width: 1600, height: 1000, caption: "" },
    ]);
    assert.equal(kept.length, 1);
  });

  it("drops photos with an empty or whitespace src", () => {
    assert.equal(
      usableServicePhotos([
        { src: "", width: 100, height: 100, caption: "" },
        { src: "   ", width: 100, height: 100, caption: "" },
      ]).length,
      0,
    );
  });

  it("drops photos whose dimensions are missing (0) so the page stays clean", () => {
    assert.equal(
      usableServicePhotos([{ src: "/a.jpg", width: 0, height: 0, caption: "" }]).length,
      0,
    );
  });

  it("returns an empty array for no photos (page renders nothing, no empty block)", () => {
    assert.deepEqual(usableServicePhotos([]), []);
  });
});

describe("servicePhotoAlt", () => {
  it("uses the editor caption verbatim when present", () => {
    assert.equal(
      servicePhotoAlt({ caption: "Before polishing", title: "Detailing", photoWord: "Photo", index: 0 }),
      "Before polishing",
    );
  });

  it("falls back to localised title + localised photo word + human index", () => {
    assert.equal(
      servicePhotoAlt({ caption: "", title: "Детейлінг", photoWord: "Фото", index: 2 }),
      "Детейлінг — Фото 3",
    );
  });

  it("treats a whitespace-only caption as absent", () => {
    assert.equal(
      servicePhotoAlt({ caption: "   ", title: "Detailing", photoWord: "Photo", index: 0 }),
      "Detailing — Photo 1",
    );
  });
});
