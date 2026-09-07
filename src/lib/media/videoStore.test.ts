import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  BLOB_VIDEO_PREFIX,
  blobPathnameFor,
  getVideoStore,
  isValidVideoKey,
  tokenRulesFor,
  validateSpec,
  VideoStoreNotConfiguredError,
  VIDEO_MAX_BYTES,
} from "./videoStore";

const mp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42"), Buffer.alloc(200)]);

test("validateSpec: type, size, filename safety", () => {
  assert.equal(validateSpec({ filename: "a.mp4", contentType: "video/mp4", size: 1000 }), null);
  assert.match(validateSpec({ filename: "a.mov", contentType: "video/quicktime", size: 10 })!, /непідтримуваний/);
  assert.match(validateSpec({ filename: "a.mp4", contentType: "video/mp4", size: VIDEO_MAX_BYTES + 1 })!, /завеликий/);
  assert.match(validateSpec({ filename: "../x.mp4", contentType: "video/mp4", size: 10 })!, /недопустимі символи/);
  assert.match(validateSpec({ filename: "a/b.mp4", contentType: "video/mp4", size: 10 })!, /недопустимі символи/);
  assert.match(validateSpec({ filename: "a.mp4", contentType: "video/mp4", size: 0 })!, /розмір/);
});

test("isValidVideoKey rejects traversal and junk", () => {
  assert.equal(isValidVideoKey("abc12345-my-clip.mp4"), true);
  assert.equal(isValidVideoKey("abc12345-clip.webm"), true);
  assert.equal(isValidVideoKey("../abc12345-clip.mp4"), false);
  assert.equal(isValidVideoKey("clip.mp4"), false); // no hash prefix
  assert.equal(isValidVideoKey("abc12345-clip.exe"), false);
});

test("local store: createUpload -> receive (temp+rename) -> head -> list -> remove", async () => {
  delete process.env.BLOB_READ_WRITE_TOKEN;

  const store = getVideoStore();
  assert.equal(store.kind, "local");

  const created = await store.createUpload({ filename: "Walk Around!.mp4", contentType: "video/mp4", size: 300 });
  assert.ok(isValidVideoKey(created.key));
  assert.equal(created.publicUrl, `/uploads/videos/${created.key}`);
  assert.match(created.uploadUrl, /^\/api\/panel\/video\?key=/);

  const obj = await store.receive!(created.key, mp4());
  assert.equal(obj.key, created.key);
  assert.ok(obj.size > 0);

  const disk = path.join(process.cwd(), "public/uploads/videos", created.key);
  assert.ok((await fs.stat(disk)).isFile());
  // no leftover .part file
  const siblings = await fs.readdir(path.dirname(disk));
  assert.ok(!siblings.some((n) => n.includes(".part-")));

  assert.equal((await store.head(created.key))?.key, created.key);
  assert.ok((await store.list()).some((v) => v.key === created.key));

  await store.remove(created.key);
  assert.equal(await store.head(created.key), null);
});

test("local store: receive rejects a bad key", async () => {

  delete process.env.BLOB_READ_WRITE_TOKEN;
  const store = getVideoStore();
  await assert.rejects(() => store.receive!("../evil.mp4", mp4()));
});

test("a BLOB token selects the Blob adapter; createUpload is a client-side flow, not this", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
  try {
    const store = getVideoStore();
    assert.equal(store.kind, "blob");
    // In blob mode the file goes browser -> Blob via the client SDK, so the
    // server-side createUpload is not the path.
    await assert.rejects(
      () => store.createUpload({ filename: "a.mp4", contentType: "video/mp4", size: 10 }),
      /клієнтський SDK/,
    );
  } finally {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  }
});

test("the Blob adapter raises VideoStoreNotConfiguredError once the token is gone (never a repo write)", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
  const store = getVideoStore();
  assert.equal(store.kind, "blob");
  delete process.env.BLOB_READ_WRITE_TOKEN; // token removed at runtime
  await assert.rejects(() => store.list(), VideoStoreNotConfiguredError);
  await assert.rejects(
    () => store.remove("https://x.blob.vercel-storage.com/panel/videos/a.mp4"),
    VideoStoreNotConfiguredError,
  );
});

test("blobPathnameFor: slugified, under the prefix, right extension", () => {
  assert.equal(blobPathnameFor("Walk Around!.MP4", "video/mp4"), `${BLOB_VIDEO_PREFIX}walk-around.mp4`);
  assert.equal(blobPathnameFor("огляд.webm", "video/webm"), `${BLOB_VIDEO_PREFIX}video.webm`);
});

test("tokenRulesFor: only the video prefix + mp4/webm, with the size cap", () => {
  const ok = tokenRulesFor(`${BLOB_VIDEO_PREFIX}clip.mp4`);
  assert.equal(ok.ok, true);
  assert.equal(ok.rules?.maximumSizeInBytes, VIDEO_MAX_BYTES);
  assert.deepEqual(ok.rules?.allowedContentTypes, ["video/mp4", "video/webm"]);
  assert.equal(ok.rules?.addRandomSuffix, true);

  assert.equal(tokenRulesFor("other/clip.mp4").ok, false);
  assert.equal(tokenRulesFor(`${BLOB_VIDEO_PREFIX}../escape.mp4`).ok, false);
  assert.equal(tokenRulesFor(`${BLOB_VIDEO_PREFIX}clip.mov`).ok, false);
  assert.equal(tokenRulesFor(`${BLOB_VIDEO_PREFIX}clip.exe`).ok, false);
});

test("blob remove() rejects anything that is not a full blob URL", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
  try {
    const store = getVideoStore();
    await assert.rejects(() => store.remove("just-a-key.mp4"), /повний URL/);
    await assert.rejects(() => store.remove("https://evil.com/x.mp4"), /повний URL/);
  } finally {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  }
});
