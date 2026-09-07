import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getVideoStore,
  isValidVideoKey,
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

test("a BLOB token forces the (unimplemented) blob store, never a repo write", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_xxx";
  try {
    const store = getVideoStore();
    assert.equal(store.kind, "blob");
    await assert.rejects(
      () => store.createUpload({ filename: "a.mp4", contentType: "video/mp4", size: 10 }),
      VideoStoreNotConfiguredError,
    );
    await assert.rejects(() => store.list(), VideoStoreNotConfiguredError);
  } finally {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  }
});
