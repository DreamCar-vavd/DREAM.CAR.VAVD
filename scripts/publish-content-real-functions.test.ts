/**
 * Б4 Block A, strengthened (2026-09-15, a follow-up independent review):
 * the original Block A integration test (publish-content-panel-integration
 * .test.ts) used the project's real GATING functions (coerceCar,
 * getPublishBlockers, confirmedText) but composed the review-state.json /
 * frozen-media / published.json writes itself, by hand — it verifies a
 * MODELED sequence, not the actual output of the actions a real session
 * runs. `confirmLocale(storage, ...)` and `publishItem(storage, ...)` from
 * panelStore.ts are directly callable against a `LocalFsStorage` rooted at
 * a throwaway temp directory, with no real GitHub session — this test does
 * that: it calls the REAL panel actions and feeds THEIR actual file output
 * into publish-content.ts, closing the gap between "the gating logic
 * agrees this should work" and "the actual write path produces exactly
 * what publish-content.ts expects."
 *
 * This is still not a live UI/GitHub-session check — LocalFsStorage's own
 * doc comment calls it "local dev: single trusted operator on the
 * filesystem", and no HTTP call to GitHub happens anywhere in this file.
 * It closes the gap between panelStore.ts's real write behavior and
 * publish-content.ts's assumptions about it — not the gap between local
 * and hosted storage, which is a separate, already-documented blocker
 * (docs/PANEL-hosted-verification.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { LocalFsStorage } from "../src/lib/content/store/localFs";
import { confirmLocale, publishItem } from "../src/lib/content/panelStore";
import type { ContentLocale } from "../src/lib/content/carsGate";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "publish-content.ts");
const SLUG = "zzz-real-fn-car";
const PUBLISHED_PATH = "src/content/cms/published.json";
const REVIEW_PATH = "src/content/cms/review-state.json";
const CARS_DIR = "src/content/cms/cars";

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==",
  "base64",
);

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}
function gitOrNull(args: string[], cwd: string): string | null {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}
function gitInit(dir: string) {
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.name", "test"], dir);
  git(["config", "user.email", "test@example.com"], dir);
}
async function writeJson(dir: string, rel: string, obj: unknown) {
  const p = path.join(dir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, 2));
}
function commitCurrent(dir: string, msg: string): string {
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", msg], dir);
  return git(["rev-parse", "HEAD"], dir);
}
async function runPublish(args: string[]): Promise<{ ok: boolean; code: number; out: string }> {
  try {
    const { stdout } = await execFileAsync("node", ["--import", "tsx", SCRIPT, ...args], { cwd: ROOT });
    return { ok: true, code: 0, out: stdout };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { ok: false, code: e.code ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

test("Block A (strengthened): real confirmLocale()/publishItem() output is directly compatible with publish-content.ts", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "real-fn-"));
  gitInit(dir);
  await writeJson(dir, PUBLISHED_PATH, {
    publishedAt: new Date(0).toISOString(),
    cars: [],
    gallery: [],
    services: [],
    contact: [],
    promos: [],
  });
  await writeJson(dir, REVIEW_PATH, {});
  commitCurrent(dir, "seed (empty, matches unmerged main)");
  git(["checkout", "-q", "-b", "content", "main"], dir);

  // "Keystatic save" — panelStore.ts never writes this file itself (traced
  // in the Б4 Block A commit); it's Keystatic's own GitHub-storage write,
  // simulated here as plain fs writes, exactly like the real thing leaves
  // on disk for the panel to read next.
  const raw = {
    id: SLUG,
    order: 1,
    saleStatus: "for-sale",
    year: "2021",
    price: "£3,000",
    mileageValue: 500,
    photos: [{ image: `/images/cms/cars/${SLUG}/photos/0/image.jpg` }],
    video: { mode: "none", src: "", posterSrc: "" },
    bornAt: "real-fn-instance-1",
    uk: { title: "Реальний заголовок", specLine: "Опис", description: "Повний опис", viewGalleryLabel: "Галерея" },
    en: { title: "Real title", specLine: "Spec", description: "Description", viewGalleryLabel: "Gallery" },
    ru: { title: "Реальный заголовок", specLine: "Опис RU", description: "Полное описание", viewGalleryLabel: "Галерея RU" },
  };
  await writeJson(dir, `${CARS_DIR}/${SLUG}.json`, raw);
  await fs.mkdir(path.join(dir, `public/images/cms/cars/${SLUG}/photos/0`), { recursive: true });
  await fs.writeFile(path.join(dir, `public/images/cms/cars/${SLUG}/photos/0/image.jpg`), TINY_JPEG);
  commitCurrent(dir, "keystatic: save car");

  // ── From here on, every write is the REAL panelStore.ts action ─────────
  const storage = new LocalFsStorage({ root: dir });

  for (const locale of ["uk", "en", "ru"] as ContentLocale[]) {
    const dirRead = await storage.readDir(CARS_DIR);
    const reviewRead = await storage.readFile(REVIEW_PATH);
    const result = await confirmLocale(storage, "car", SLUG, locale, {
      working: dirRead.version,
      review: reviewRead.version,
    });
    assert.equal(result.ok, true, `real confirmLocale(${locale}) failed: ${JSON.stringify(result)}`);
    commitCurrent(dir, `panel: confirm ${locale} (real confirmLocale)`);
  }

  const dirRead2 = await storage.readDir(CARS_DIR);
  const reviewRead2 = await storage.readFile(REVIEW_PATH);
  const publishedRead2 = await storage.readFile(PUBLISHED_PATH);
  const publishResult = await publishItem(storage, "car", SLUG, {
    working: dirRead2.version,
    review: reviewRead2.version,
    published: publishedRead2.version,
  });
  assert.equal(publishResult.ok, true, `real publishItem() failed: ${JSON.stringify(publishResult)}`);
  if (!publishResult.ok) throw new Error("unreachable"); // narrow for TS below
  const publishSha = commitCurrent(dir, "panel: publish (real publishItem)");

  // ── Feed the REAL functions' actual output into publish-content.ts ─────
  const r = await runPublish(["--repo", dir, "--base", "main", "--content", publishSha]);
  assert.equal(r.ok, true, r.out);

  const pubOnBase = JSON.parse(git(["show", "main:" + PUBLISHED_PATH], dir));
  assert.equal(pubOnBase.cars.length, 1);
  assert.equal(pubOnBase.cars[0].id, SLUG);
  assert.equal(pubOnBase.cars[0].en.title, "Real title");
  // publishItem froze the working photo into a real _pub/<hash> copy —
  // confirm base actually has it (not just a JSON reference to it).
  const frozenPath = pubOnBase.cars[0].photos[0].image.replace(/^\//, "");
  assert.match(frozenPath, /_pub\//, "publishItem must have frozen the photo, not referenced the working path directly");
  assert.ok(git(["ls-tree", "main", "public/" + frozenPath], dir).length > 0, "the real frozen photo must exist on base");
  assert.equal(
    gitOrNull(["ls-tree", "main", `${CARS_DIR}/${SLUG}.json`], dir),
    "",
    "the working-copy file panelStore.ts never writes to must still never reach base",
  );

  const reviewOnBase = JSON.parse(git(["show", "main:" + REVIEW_PATH], dir));
  assert.ok(reviewOnBase[`car:${SLUG}`], "the real confirmLocale rows must have transferred");
  assert.ok(reviewOnBase[`car:${SLUG}`].uk && reviewOnBase[`car:${SLUG}`].en && reviewOnBase[`car:${SLUG}`].ru);
});
