import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalFsStorage } from "./localFs";
import {
  cleanupFrozenMedia,
  freezePublishedMedia,
} from "../panelStore";

/**
 * Real-filesystem checks for the freeze / cleanup pipeline run ONLY inside a
 * throwaway temp directory with synthetic `zzz-*` slugs — never the repo's real
 * `public/images/cms/`. Teardown removes just that temp dir, and only after
 * asserting it is under the OS temp root.
 */
async function sandbox(): Promise<{
  root: string;
  storage: LocalFsStorage;
  write: (rel: string, data: string | Uint8Array) => Promise<void>;
  exists: (rel: string) => Promise<boolean>;
  cleanup: () => Promise<void>;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dcv-panel-sbx-"));
  const write = async (rel: string, data: string | Uint8Array) => {
    const p = path.join(root, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  };
  const exists = (rel: string) =>
    fs
      .stat(path.join(root, rel))
      .then(() => true)
      .catch(() => false);
  const cleanup = async () => {
    assert.ok(
      path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep),
      `refusing to rm a non-temp path: ${root}`,
    );
    await fs.rm(root, { recursive: true, force: true });
  };
  return { root, storage: new LocalFsStorage({ root }), write, exists, cleanup };
}

const jpg = (marker: string) =>
  Buffer.from([0xff, 0xd8, 0xff, ...Buffer.from(`jpg:${marker}`), 0xff, 0xd9]);

const svc = (id: string, over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id,
    order: 10,
    status: "available",
    iconSrc: "/images/services/x.png",
    priceAmount: "",
    priceCurrency: "£",
    photos: [{ image: `/images/cms/services/${id}/photos/0/image.jpg`, caption: "" }],
    uk: L,
    en: L,
    ru: L,
    ...over,
  });
const L = {
  title: "T",
  shortDescription: "S",
  longDescription: "L",
  cardDescription: "",
  bullets: [],
  modalLead: "",
  modalDescription: "",
  modalSections: [],
  priceNote: "",
  seoTitle: "",
  seoDescription: "",
};

test("sandbox: freeze then cleanup removes ONLY the specific stale _pub file", async () => {
  const sbx = await sandbox();
  try {
    // one synthetic published service with one photo
    await sbx.write("src/content/cms/services/zzz-a.json", svc("zzz-a"));
    await sbx.write("src/content/cms/cars/.keep", "");
    await sbx.write("src/content/cms/gallery/.keep", "");
    await sbx.write("src/content/cms/promos/.keep", "");
    await sbx.write("public/images/cms/services/zzz-a/photos/0/image.jpg", jpg("A"));
    await sbx.write(
      "src/content/cms/published.json",
      JSON.stringify({ publishedAt: "t", cars: [], gallery: [], services: [JSON.parse(svc("zzz-a"))] }),
    );
    await sbx.write("src/content/cms/review-state.json", "{}");

    // freeze: photo -> _pub copy, published.json repointed
    const fr = await freezePublishedMedia(sbx.storage);
    assert.equal(fr.changed, 1);
    const idx1 = await sbx.storage.mediaIndex();
    const frozen = [...idx1.keys()].find((k) => k.includes("/_pub/"));
    assert.ok(frozen, "a _pub copy exists after freeze");

    // add a stale extra _pub file (as if from an earlier photo)
    await sbx.write("public/images/cms/services/zzz-a/_pub/deadbeefdeadbeef.jpg", jpg("OLD"));
    assert.equal(await sbx.exists("public/images/cms/services/zzz-a/_pub/deadbeefdeadbeef.jpg"), true);

    // dry run -> exactly 1 candidate
    const dry = await cleanupFrozenMedia(sbx.storage, {});
    assert.equal(dry.ok, true);
    assert.equal(dry.cleanup?.count, 1);

    // confirm -> only the stale one goes; the referenced frozen copy + the
    // working photo + the card json all stay
    const done = await cleanupFrozenMedia(sbx.storage, { confirm: true, headSha: dry.cleanup!.headSha });
    assert.equal(done.ok, true);
    assert.equal(await sbx.exists("public/images/cms/services/zzz-a/_pub/deadbeefdeadbeef.jpg"), false);
    assert.equal(await sbx.exists(frozen!.replace(/^public\//, "public/")), true);
    assert.equal(await sbx.exists("public/images/cms/services/zzz-a/photos/0/image.jpg"), true);
    assert.equal(await sbx.exists("src/content/cms/services/zzz-a.json"), true);
  } finally {
    await sbx.cleanup();
  }
});

test("sandbox: deletePublishedMediaBatch refuses a path outside public/images/cms", async () => {
  const sbx = await sandbox();
  try {
    await sbx.write("src/content/cms/published.json", "safe");
    // regex-invalid (assert*MediaPath) — rejected before any fs touch
    await assert.rejects(() =>
      sbx.storage.deletePublishedMediaBatch(["src/content/cms/published.json"], null),
    );
    await assert.rejects(() =>
      sbx.storage.deletePublishedMediaBatch(
        ["public/images/cms/services/x/_pub/../../../../etc/passwd"],
        null,
      ),
    );
    // regex-valid shape but an absolute path -> containment check throws
    await assert.rejects(() =>
      sbx.storage.deletePublishedMediaBatch(
        [`${sbx.root}/public/images/cms/services/x/_pub/aaaaaaaa.jpg`],
        null,
      ),
    );
    assert.equal(await sbx.exists("src/content/cms/published.json"), true, "nothing was deleted");
  } finally {
    await sbx.cleanup();
  }
});

test("sandbox: putPublishedMedia / writeFile also refuse to escape the tree", async () => {
  const sbx = await sandbox();
  try {
    await assert.rejects(() =>
      sbx.storage.putPublishedMedia("public/images/cms/services/x/_pub/../../evil.jpg", jpg("x")),
    );
    // @ts-expect-error deliberately passing a disallowed file
    await assert.rejects(() => sbx.storage.writeFile("package.json", "{}", ""));
  } finally {
    await sbx.cleanup();
  }
});
