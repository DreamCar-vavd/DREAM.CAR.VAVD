import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");

async function guard(publishedObj: unknown) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "guard-"));
  const pub = path.join(dir, "published.json");
  await fs.writeFile(pub, JSON.stringify(publishedObj));
  try {
    const { stdout } = await run(
      "node",
      ["--import", "tsx", "scripts/content-guard.ts", "--published", pub],
      { cwd: ROOT },
    );
    return { ok: true, out: stdout };
  } catch (err) {
    const e = err as { code: number; stderr: string; stdout: string };
    return { ok: false, out: e.stdout + e.stderr };
  }
}

const realSnapshot = JSON.parse(
  readFileSync(path.join(ROOT, "src/content/cms/published.json"), "utf8"),
) as { publishedAt: string; cars: Record<string, unknown>[]; gallery: Record<string, unknown>[] };

test("content-guard passes on the real published snapshot", async () => {
  const r = await guard(realSnapshot);
  assert.equal(r.ok, true, r.out);
  assert.match(r.out, /усі перевірені/);
});

test("content-guard rejects a path-traversal media reference", async () => {
  const bad = structuredClone(realSnapshot);
  bad.cars[0].photos = [{ image: "/images/cms/cars/../../../etc/passwd", caption: "" }];
  const r = await guard(bad);
  assert.equal(r.ok, false);
  assert.match(r.out, /підозрілий шлях/);
});

test("content-guard rejects a non-image extension", async () => {
  const bad = structuredClone(realSnapshot);
  bad.gallery[0].photos = [{ image: "/images/cms/gallery/x/run.sh", caption: "" }];
  const r = await guard(bad);
  assert.equal(r.ok, false);
  assert.match(r.out, /не відповідає дозволеному формату/);
});

test("content-guard rejects an incomplete language in a published car", async () => {
  const bad = structuredClone(realSnapshot);
  (bad.cars[0].en as { title: string }).title = "";
  const r = await guard(bad);
  assert.equal(r.ok, false);
  assert.match(r.out, /EN: не заповнено/);
});

test("content-guard rejects a media file that is not in the target tree", async () => {
  const bad = structuredClone(realSnapshot);
  (bad.cars[0].photos as { image: string }[]).push({
    image: "/images/cms/cars/ghost/photos/0/image.jpg",
    caption: "",
  } as never);
  const r = await guard(bad);
  assert.equal(r.ok, false);
  assert.match(r.out, /відсутній у цільовому середовищі/);
});
