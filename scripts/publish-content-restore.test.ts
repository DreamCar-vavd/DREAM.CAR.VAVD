/**
 * Б4 Block B — restoring an earlier published version through
 * publish-content.ts itself, not a raw `git checkout <old-sha> -- ...`
 * bypass of the guard (docs/PANEL-backup-restore.md describes that manual
 * path; this proves the NEW guarded pipeline supports the same recovery
 * goal as a genuinely new, forward operation rather than a replay).
 *
 * The key design question Block B asks: restoring version A after B has
 * already been published must NOT be "re-dispatch A's original content
 * SHA" — that SHA is now an ANCESTOR of what's applied (B), and Б4's own
 * staleness guard (round 2, defect #2) correctly refuses it. A real
 * restore has to be a NEW commit, forward of B, whose content happens to
 * reproduce A. This file proves both halves: the naive replay stays
 * blocked, and the deliberate forward restore succeeds and is complete —
 * including recreating a photo that a later cleanup had actually deleted
 * from git (docs/PANEL-backup-restore.md's own documented failure mode
 * for a restore that forgets the media object, not just the JSON
 * reference).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { coerceCar } from "../src/lib/content/coerce";
import { confirmedText, getPublishBlockers, type CmsCar, type ReviewState } from "../src/lib/content/carsGate";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "publish-content.ts");
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const SLUG = "zzz-restore-car";
const BORN_AT = "restore-instance-1";

const PHOTO_A = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==",
  "base64",
);
const PHOTO_B = Buffer.concat([PHOTO_A, Buffer.from([0x00])]);

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
async function writeFile(dir: string, rel: string, buf: Buffer) {
  const p = path.join(dir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buf);
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
function emptyPublished() {
  return { publishedAt: new Date(0).toISOString(), cars: [], gallery: [], services: [], contact: [], promos: [] };
}
function carLangs(tag: string) {
  return {
    uk: { title: `Заголовок ${tag}`, specLine: `Опис ${tag}`, description: `Повний опис ${tag}`, viewGalleryLabel: "Галерея" },
    en: { title: `Title ${tag}`, specLine: `Spec ${tag}`, description: `Description ${tag}`, viewGalleryLabel: "Gallery" },
    ru: { title: `Заголовок RU ${tag}`, specLine: `Опис RU ${tag}`, description: `Полное описание RU ${tag}`, viewGalleryLabel: "Галерея RU" },
  };
}
function reviewRowFor(car: CmsCar): ReviewState[string] {
  return {
    instance: BORN_AT,
    uk: { hash: sha256(confirmedText(car.uk)), at: new Date().toISOString() },
    en: { hash: sha256(confirmedText(car.en)), at: new Date().toISOString() },
    ru: { hash: sha256(confirmedText(car.ru)), at: new Date().toISOString() },
  };
}

test("Block B: restore an earlier published version as a new forward operation, not a stale replay", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "restore-"));
  gitInit(dir);
  await writeJson(dir, "src/content/cms/published.json", emptyPublished());
  await writeJson(dir, "src/content/cms/review-state.json", {});
  commitCurrent(dir, "seed (empty, matches unmerged main)");
  git(["checkout", "-q", "-b", "content", "main"], dir);

  const PHOTO_A_PATH = `public/images/cms/cars/${SLUG}/_pub/${sha256("A").slice(0, 24)}.jpg`;
  const PHOTO_B_PATH = `public/images/cms/cars/${SLUG}/_pub/${sha256("B").slice(0, 24)}.jpg`;

  // ── Publish version A ────────────────────────────────────────────────
  const carA: CmsCar = coerceCar(SLUG, {
    id: SLUG,
    order: 1,
    saleStatus: "for-sale",
    year: "2020",
    price: "£1,000",
    mileageValue: 1000,
    photos: [{ image: `/${PHOTO_A_PATH.slice("public/".length)}` }],
    video: { mode: "none", src: "", posterSrc: "" },
    ...carLangs("A"),
  });
  const reviewA: ReviewState = { [`car:${SLUG}`]: reviewRowFor(carA) };
  const blockersA = getPublishBlockers(carA, { review: reviewA, sha256, reviewKey: `car:${SLUG}`, instance: BORN_AT });
  assert.deepEqual(blockersA, [], "version A must itself be publishable");

  await writeFile(dir, PHOTO_A_PATH, PHOTO_A);
  await writeJson(dir, "src/content/cms/review-state.json", reviewA);
  await writeJson(dir, "src/content/cms/published.json", { ...emptyPublished(), publishedAt: new Date().toISOString(), cars: [carA] });
  const contentA = commitCurrent(dir, "panel: publish version A");

  const rA = await runPublish(["--repo", dir, "--base", "main", "--content", contentA]);
  assert.equal(rA.ok, true, rA.out);
  const pubA = JSON.parse(git(["show", "main:src/content/cms/published.json"], dir));
  assert.equal(pubA.cars[0].en.title, "Title A");
  assert.ok(git(["ls-tree", "main", PHOTO_A_PATH], dir).length > 0);

  // ── An UNRELATED, independent commit lands on `main` itself in between
  // (e.g. a code PR merged directly to main) — the restore later must not
  // disturb it. Explicitly switches off the content branch to land this on
  // main, then switches back, so it never becomes part of the content
  // branch's own lineage (which would defeat the point of this check).
  git(["checkout", "-q", "main"], dir);
  await writeJson(dir, "docs/unrelated-note.json", { note: "independent change between A and B" });
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "unrelated: independent main-side change"], dir);
  const baseAfterUnrelated = git(["rev-parse", "main"], dir);
  git(["checkout", "-q", "content"], dir);

  // ── Publish version B: different text, photo A swapped for photo B ─────
  const carB: CmsCar = coerceCar(SLUG, {
    id: SLUG,
    order: 1,
    saleStatus: "for-sale",
    year: "2020",
    price: "£1,500",
    mileageValue: 1500,
    photos: [{ image: `/${PHOTO_B_PATH.slice("public/".length)}` }],
    video: { mode: "none", src: "", posterSrc: "" },
    ...carLangs("B"),
  });
  const reviewB: ReviewState = { [`car:${SLUG}`]: reviewRowFor(carB) };
  await writeFile(dir, PHOTO_B_PATH, PHOTO_B);
  await writeJson(dir, "src/content/cms/review-state.json", reviewB);
  await writeJson(dir, "src/content/cms/published.json", { ...emptyPublished(), publishedAt: new Date().toISOString(), cars: [carB] });
  const contentB = commitCurrent(dir, "panel: publish version B");
  const rB = await runPublish(["--repo", dir, "--base", "main", "--content", contentB]);
  assert.equal(rB.ok, true, rB.out);

  // A later cleanup ("Прибрати старі копії фото") actually DELETES photo A's
  // bytes from the content branch — the exact scenario
  // docs/PANEL-backup-restore.md warns a JSON-only restore would miss.
  await fs.rm(path.join(dir, PHOTO_A_PATH));
  const contentCleanup = commitCurrent(dir, "panel: cleanup old frozen photo A");
  const rCleanup = await runPublish(["--repo", dir, "--base", "main", "--content", contentCleanup]);
  assert.equal(rCleanup.ok, true, rCleanup.out);
  assert.equal(gitOrNull(["ls-tree", "main", PHOTO_A_PATH], dir), "", "photo A must be gone from base after the cleanup");
  const baseAfterCleanup = git(["rev-parse", "main"], dir);

  // ── A naive replay of A's ORIGINAL content SHA must stay blocked ───────
  const naiveReplay = await runPublish(["--repo", dir, "--base", "main", "--content", contentA]);
  assert.equal(naiveReplay.ok, false, "replaying A's original SHA after B must not silently succeed");
  assert.equal(naiveReplay.code, 6);
  assert.equal(git(["rev-parse", "main"], dir), baseAfterCleanup, "a blocked replay must not touch base at all");

  // ── The deliberate restore: a NEW commit, forward of B, reproducing A ──
  // Reuses A's own confirmed text/hashes (still valid — confirmedText() is
  // a pure function of the text, unchanged) and re-adds photo A's bytes,
  // which the cleanup had deleted.
  await writeFile(dir, PHOTO_A_PATH, PHOTO_A);
  await writeJson(dir, "src/content/cms/review-state.json", reviewA);
  await writeJson(dir, "src/content/cms/published.json", { ...emptyPublished(), publishedAt: new Date().toISOString(), cars: [carA] });
  const contentRestore = commitCurrent(dir, "panel: restore version A (new operation, forward of B)");

  const rRestore = await runPublish(["--repo", dir, "--base", "main", "--content", contentRestore]);
  assert.equal(rRestore.ok, true, rRestore.out);

  // ── Verify the restored result ──────────────────────────────────────────
  const pubRestored = JSON.parse(git(["show", "main:src/content/cms/published.json"], dir));
  assert.equal(pubRestored.cars[0].en.title, "Title A", "text must be restored to A");
  assert.equal(pubRestored.cars[0].uk.title, "Заголовок A");
  assert.equal(pubRestored.cars[0].photos[0].image, `/${PHOTO_A_PATH.slice("public/".length)}`);
  assert.ok(git(["ls-tree", "main", PHOTO_A_PATH], dir).length > 0, "photo A (deleted in the B cleanup) must exist again");
  const restoredBytesSha = git(["rev-parse", `main:${PHOTO_A_PATH}`], dir);
  const expectedBlobSha = execFileSync("git", ["hash-object", "--stdin"], { input: PHOTO_A, cwd: dir }).toString().trim();
  assert.equal(restoredBytesSha, expectedBlobSha, "restored photo must be byte-identical to the original, not a placeholder");
  const reviewOnBase = JSON.parse(git(["show", `main:src/content/cms/review-state.json`], dir));
  assert.equal(reviewOnBase[`car:${SLUG}`].en.hash, sha256(confirmedText(carA.en)), "restored review confirmation must match A's text");

  // The independent, unrelated main-side commit from earlier must survive
  // completely untouched by the restore.
  assert.equal(
    git(["show", "main:docs/unrelated-note.json"], dir),
    git(["show", `${baseAfterUnrelated}:docs/unrelated-note.json`], dir),
  );
  assert.ok(
    (() => {
      try {
        execFileSync("git", ["merge-base", "--is-ancestor", baseAfterUnrelated, "main"], { cwd: dir });
        return true;
      } catch {
        return false;
      }
    })(),
    "the restore must be a fast-forward continuation of history, not a rewrite — the unrelated commit stays an ancestor",
  );

  // (no force-push flag check here — already covered precisely by
  // publish-content.test.ts's own "never invokes git push with a force
  // flag" test, which correctly greps only real git(["push", ...]) call
  // sites, not doc-comment prose that happens to mention "--force")

  // ── Final restored state passes content-guard cleanly (evidence) ───────
  const evidencePublished = path.join(dir, "..", "block-b-restored-published.json");
  await fs.writeFile(evidencePublished, git(["show", "main:src/content/cms/published.json"], dir));
  const evidenceReview = path.join(dir, "..", "block-b-restored-review.json");
  await fs.writeFile(evidenceReview, git(["show", "main:src/content/cms/review-state.json"], dir));
  const guard = await execFileAsync(
    "node",
    [
      "--import",
      "tsx",
      "scripts/content-guard.ts",
      "--published",
      evidencePublished,
      "--review",
      evidenceReview,
      "--media-root",
      path.join(dir, "public"),
    ],
    { cwd: ROOT },
  );
  assert.match(guard.stdout, /усі перевірені/);
  const evidenceDir = path.join(os.tmpdir(), "block-b-evidence");
  await fs.mkdir(evidenceDir, { recursive: true });
  const evidenceFile = path.join(evidenceDir, `${Date.now()}.json`);
  await fs.writeFile(
    evidenceFile,
    JSON.stringify(
      {
        finalBaseFiles: git(["ls-tree", "-r", "--name-only", "main", "--", "src/content/cms", "public/images/cms"], dir).split("\n"),
        contentGuardOnRestoredPublished: guard.stdout,
        blockedReplayCode: naiveReplay.code,
        restoreCommit: contentRestore,
      },
      null,
      2,
    ),
  );
  console.log(`Block B evidence written to: ${evidenceFile}`);
});
