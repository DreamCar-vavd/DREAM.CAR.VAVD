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
) as {
  publishedAt: string;
  cars: Record<string, unknown>[];
  gallery: Record<string, unknown>[];
  contact: Record<string, unknown>[];
};

test("content-guard rejects a second contact record", async () => {
  const bad = structuredClone(realSnapshot);
  bad.contact = [...(bad.contact ?? []), { ...(bad.contact?.[0] ?? {}), id: "site-2" }];
  const r = await guard(bad);
  assert.equal(r.ok, false);
  assert.match(r.out, /більше одного запису contact/);
});

test("content-guard rejects a contact record whose id is not 'site'", async () => {
  const bad = structuredClone(realSnapshot);
  bad.contact = [{ ...(bad.contact?.[0] ?? {}), id: "primary" }];
  const r = await guard(bad);
  assert.equal(r.ok, false);
  assert.match(r.out, /має бути «site»|contactId/);
});

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

test("content-guard rejects a real file whose bytes do not match its extension", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "guard-mb-"));
  const pub = path.join(dir, "published.json");
  const mediaRoot = path.join(dir, "public");
  const fake = path.join(mediaRoot, "images/cms/gallery/mismatch/photos/0/image.jpg");
  await fs.mkdir(path.dirname(fake), { recursive: true });
  await fs.writeFile(fake, "<!doctype html><script>alert(1)</script>".padEnd(200, " "));

  const bad = structuredClone(realSnapshot) as typeof realSnapshot & {
    services?: unknown[];
    contact?: unknown[];
  };
  bad.gallery = [
    {
      id: "mismatch",
      order: 1,
      kind: "album",
      year: "",
      photos: [{ image: "/images/cms/gallery/mismatch/photos/0/image.jpg", caption: "" }],
      videoUrl: "",
      showContactCta: false,
      uk: { title: "T", shortDescription: "", longDescription: "", service: "", clientRequest: "", completedItems: [], result: "" },
      en: { title: "T", shortDescription: "", longDescription: "", service: "", clientRequest: "", completedItems: [], result: "" },
      ru: { title: "T", shortDescription: "", longDescription: "", service: "", clientRequest: "", completedItems: [], result: "" },
    } as never,
  ];
  bad.cars = [];
  await fs.writeFile(pub, JSON.stringify(bad));

  try {
    await run(
      "node",
      ["--import", "tsx", "scripts/content-guard.ts", "--published", pub, "--media-root", mediaRoot, "--review", path.join(dir, "none.json")],
      { cwd: ROOT },
    );
    assert.fail("guard should have exited non-zero");
  } catch (err) {
    const e = err as { stdout: string; stderr: string };
    assert.match(e.stdout + e.stderr, /вміст не розпізнано|вміст — /);
  }
});
