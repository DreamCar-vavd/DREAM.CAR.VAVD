/**
 * Б4 Block A — proves publish-content.ts is compatible with how the PANEL
 * itself actually produces commits on the content branch, not just with a
 * hand-crafted published.json.
 *
 * Traced directly against panelStore.ts / keystatic.config.ts (not
 * guessed): a real session commits to the content branch as
 *   1. Keystatic save          -> src/content/cms/cars/<slug>.json           (1 commit, Keystatic's own storage — never touched by panelStore.ts)
 *   2. "Позначити перевіреним" -> src/content/cms/review-state.json          (1 commit per confirmLocale call — confirmLocale, panelStore.ts:716-769)
 *   3. publishItem's media freeze -> public/images/cms/cars/<slug>/_pub/*.jpg (1 commit — writeFrozenMedia, panelStore.ts:839)
 *   4. publishItem's snapshot write -> src/content/cms/published.json        (1 commit — panelStore.ts:840)
 * — four/more SEPARATE commits, not one. The working-copy file from step 1
 * is NEVER written by publishItem and stays on the branch forever. This
 * means a real content branch's full history, diffed from any point before
 * step 1, contains a change to `src/content/cms/cars/<slug>.json` — a path
 * the first version of publish-content.ts's allowlist rejected outright
 * (Б4 Block A, 2026-09-15). Fixed in this same commit by widening the
 * "safe to see in the diff" allowlist to all of src/content/cms/** and
 * public/images/cms/**, while keeping the actual TRANSFER exactly as
 * narrow as before (see EDITING_SOURCE_ALLOWLIST in publish-content.ts).
 *
 * Uses the project's REAL gating functions (coerceCar, getPublishBlockers,
 * confirmedText from src/lib/content/*) to build the synthetic car and its
 * review hashes — not an approximation of that logic. The GitHub HTTP write
 * layer itself (GitHubStorage) cannot be exercised without a real remote,
 * so the commit SEQUENCE above is reproduced directly at the git level,
 * matching the exact file set and commit boundaries panelStore.ts actually
 * produces (traced, not assumed).
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
import { confirmedText, getPublishBlockers, LOCALES, type CmsCar, type ReviewState } from "../src/lib/content/carsGate";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "publish-content.ts");
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const SLUG = "zzz-block-a-car";
const BORN_AT = "test-instance-1";

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

function emptyPublished() {
  return { publishedAt: new Date(0).toISOString(), cars: [], gallery: [], services: [], contact: [], promos: [] };
}

function workingRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: SLUG,
    order: 1,
    saleStatus: "for-sale",
    year: "2021",
    price: "£1,000",
    mileageValue: 1000,
    photos: [{ image: `/images/cms/cars/${SLUG}/photos/0/image.jpg` }],
    video: { mode: "none", src: "", posterSrc: "" },
    bornAt: BORN_AT,
    uk: { title: "Заголовок", specLine: "Опис", description: "Повний опис", viewGalleryLabel: "Галерея" },
    en: { title: "Title", specLine: "Spec", description: "Description", viewGalleryLabel: "Gallery" },
    ru: { title: "Заголовок RU", specLine: "Опис RU", description: "Полное описание", viewGalleryLabel: "Галерея RU" },
    ...overrides,
  };
}

test("Block A: full panel-shaped publish cycle is compatible with publish-content.ts", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "panel-integration-"));
  gitInit(dir);
  await writeJson(dir, "src/content/cms/published.json", emptyPublished());
  await writeJson(dir, "src/content/cms/review-state.json", {});
  commitCurrent(dir, "seed (empty, matches unmerged main)");
  git(["checkout", "-q", "-b", "content", "main"], dir);

  // ── 1. Keystatic save — its own commit, working copy only ──────────────
  const raw = workingRaw();
  const car: CmsCar = coerceCar(SLUG, raw);
  await writeJson(dir, `src/content/cms/cars/${SLUG}.json`, raw);
  await fs.mkdir(path.join(dir, `public/images/cms/cars/${SLUG}/photos/0`), { recursive: true });
  await fs.writeFile(path.join(dir, `public/images/cms/cars/${SLUG}/photos/0/image.jpg`), TINY_JPEG);
  commitCurrent(dir, "keystatic: save car");

  // Real project gate: unconfirmed text must block publish.
  const blockersBefore = getPublishBlockers(car, { review: {}, sha256, reviewKey: `car:${SLUG}`, instance: BORN_AT });
  assert.ok(blockersBefore.length > 0, "expected needs-review blockers before any confirmation");

  // ── 2. Confirm each locale — one commit per confirmLocale call ─────────
  let review: ReviewState = {};
  for (const locale of LOCALES) {
    review = {
      ...review,
      [`car:${SLUG}`]: {
        ...(review[`car:${SLUG}`] ?? {}),
        instance: BORN_AT,
        [locale]: { hash: sha256(confirmedText(car[locale])), at: new Date().toISOString() },
      },
    };
    await writeJson(dir, "src/content/cms/review-state.json", review);
    commitCurrent(dir, `panel: confirm ${locale}`);
  }
  const blockersAfter = getPublishBlockers(car, { review, sha256, reviewKey: `car:${SLUG}`, instance: BORN_AT });
  assert.deepEqual(blockersAfter, [], "all three locales confirmed -> no blockers left");

  // ── 3. publishItem's two separate writes: freeze media, then snapshot ──
  const frozenPath = `public/images/cms/cars/${SLUG}/_pub/${sha256("v1").slice(0, 24)}.jpg`;
  await fs.mkdir(path.dirname(path.join(dir, frozenPath)), { recursive: true });
  await fs.writeFile(path.join(dir, frozenPath), TINY_JPEG);
  commitCurrent(dir, "panel: freeze media for publish");

  const publishedCarV1 = { ...car, photos: [{ image: `/${frozenPath.slice("public/".length)}`, caption: "" }] };
  await writeJson(dir, "src/content/cms/published.json", {
    ...emptyPublished(),
    publishedAt: new Date().toISOString(),
    cars: [publishedCarV1],
  });
  const publishSha1 = commitCurrent(dir, "panel: publish car v1");

  // ── Criterion: confirmed snapshot with a photo transfers ────────────────
  const r1 = await runPublish(["--repo", dir, "--base", "main", "--content", publishSha1]);
  assert.equal(r1.ok, true, r1.out);
  const pubOnBaseV1 = JSON.parse(git(["show", "main:src/content/cms/published.json"], dir));
  assert.equal(pubOnBaseV1.cars.length, 1);
  assert.equal(pubOnBaseV1.cars[0].id, SLUG);
  assert.ok(git(["ls-tree", "main", frozenPath], dir).length > 0, "frozen photo must be on base");
  assert.equal(
    gitOrNull(["ls-tree", "main", `src/content/cms/cars/${SLUG}.json`], dir),
    "",
    "the Keystatic working-copy file must NEVER reach base, even though its commit was in the diff",
  );

  // ── Criterion: a further draft edit does not change what's published ───
  const draftRaw = workingRaw({ price: "£9,999 DRAFT — do not publish" });
  await writeJson(dir, `src/content/cms/cars/${SLUG}.json`, draftRaw);
  const afterDraftEdit = commitCurrent(dir, "keystatic: draft edit, never published");
  const r2 = await runPublish(["--repo", dir, "--base", "main", "--content", afterDraftEdit]);
  assert.equal(r2.ok, true, r2.out);
  const pubAfterDraft = JSON.parse(git(["show", "main:src/content/cms/published.json"], dir));
  assert.deepEqual(pubAfterDraft, pubOnBaseV1, "an unpublished draft edit must never change the published snapshot");

  // ── Criterion: a real re-publish transfers only the newly agreed result ─
  const raw2 = workingRaw({ price: "£2,000", year: "2022" });
  await writeJson(dir, `src/content/cms/cars/${SLUG}.json`, raw2);
  commitCurrent(dir, "keystatic: real edit for v2");
  // text (title/specLine/description/viewGalleryLabel) is unchanged, so the
  // existing per-locale hashes are still valid — no re-confirmation needed,
  // matching the real gate (price isn't part of confirmedText()).
  const car2 = coerceCar(SLUG, raw2);
  const blockersV2 = getPublishBlockers(car2, { review, sha256, reviewKey: `car:${SLUG}`, instance: BORN_AT });
  assert.deepEqual(blockersV2, [], "a price-only change must not need re-review");
  const publishedCarV2 = { ...car2, photos: [{ image: `/${frozenPath.slice("public/".length)}`, caption: "" }] };
  await writeJson(dir, "src/content/cms/published.json", {
    ...emptyPublished(),
    publishedAt: new Date().toISOString(),
    cars: [publishedCarV2],
  });
  const publishSha2 = commitCurrent(dir, "panel: publish car v2");
  const r3 = await runPublish(["--repo", dir, "--base", "main", "--content", publishSha2]);
  assert.equal(r3.ok, true, r3.out);
  const pubOnBaseV2 = JSON.parse(git(["show", "main:src/content/cms/published.json"], dir));
  assert.equal(pubOnBaseV2.cars[0].price, "£2,000");
  assert.equal(pubOnBaseV2.cars.length, 1, "still exactly one car, not accumulated duplicates");

  // ── Criterion: reprocessing the same publish is a no-op, not a new commit
  const baseHeadAfterV2 = git(["rev-parse", "main"], dir);
  const r4 = await runPublish(["--repo", dir, "--base", "main", "--content", publishSha2]);
  assert.equal(r4.ok, true, r4.out);
  assert.equal(git(["rev-parse", "main"], dir), baseHeadAfterV2, "repeat publish must not create another commit");

  // ── Criterion: foreign code on the content branch still never passes ───
  await fs.mkdir(path.join(dir, "src/lib"), { recursive: true });
  await fs.writeFile(path.join(dir, "src/lib/block-a-foreign.ts"), "// not content\n");
  const foreignSha = commitCurrent(dir, "malicious or accidental code change");
  const r5 = await runPublish(["--repo", dir, "--base", "main", "--content", foreignSha]);
  assert.equal(r5.ok, false);
  assert.equal(r5.code, 2);
  assert.equal(git(["rev-parse", "main"], dir), baseHeadAfterV2, "base must be untouched by the rejected foreign commit");

  // ── Evidence: final base file set + a real content-guard run against it ─
  const finalFiles = git(["ls-tree", "-r", "--name-only", "main", "--", "src/content/cms", "public/images/cms"], dir);
  const evidencePublished = path.join(dir, "..", "block-a-final-published.json");
  await fs.writeFile(evidencePublished, git(["show", "main:src/content/cms/published.json"], dir));
  const evidenceReview = path.join(dir, "..", "block-a-final-review.json");
  await fs.writeFile(evidenceReview, git(["show", "main:src/content/cms/review-state.json"], dir));
  let guardStdout = "";
  try {
    const res = await execFileAsync(
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
        path.join(dir, "public"), // this synthetic repo's own public/, not the real project's
      ],
      { cwd: ROOT },
    );
    guardStdout = res.stdout;
  } catch (e) {
    guardStdout = (e as { stdout?: string; stderr?: string }).stdout + (e as { stderr?: string }).stderr!;
  }
  assert.match(guardStdout, /усі перевірені/, "the final published state on base must itself pass content-guard cleanly");
  const evidence = { finalBaseFiles: finalFiles.split("\n"), contentGuardOnFinalPublished: guardStdout };
  const evidenceDir = path.join(os.tmpdir(), "block-a-evidence");
  await fs.mkdir(evidenceDir, { recursive: true });
  const evidenceFile = path.join(evidenceDir, `${Date.now()}.json`);
  await fs.writeFile(evidenceFile, JSON.stringify(evidence, null, 2));
  console.log(`Block A evidence written to: ${evidenceFile}`);
  assert.ok(evidence.finalBaseFiles.includes("src/content/cms/published.json"));
  assert.ok(evidence.finalBaseFiles.includes("src/content/cms/review-state.json"));
  assert.ok(evidence.finalBaseFiles.some((f) => f === frozenPath));
  assert.ok(!evidence.finalBaseFiles.some((f) => f.includes(`cars/${SLUG}.json`)), "working copy must not be among the final base files");
});
