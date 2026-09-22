/**
 * Regression tests for publish-content.ts — a follow-up independent review
 * (2026-09-15) reproduced 4 scenarios (1 already fixed by that point, 3
 * real remaining defects) against real git repos. Carried over here
 * verbatim in spirit — same assertions, not weakened — as permanent
 * repository tests. See the commit this file is part of for the fixes:
 *
 *  A. "checkout-rollback" — this script never touches --repo's working
 *     tree/index while composing a commit, but used to leave the real
 *     checkout's INDEX stale relative to the NEW `base` ref it had just
 *     advanced (on an otherwise perfectly clean checkout). `git status`
 *     then showed the just-published change as a pending STAGED ROLLBACK
 *     — invisible until literally any next commit in that checkout (even
 *     an unrelated one) silently carried it along and reverted the
 *     publish. Fixed by syncing the specific touched paths into the real
 *     checkout afterward — but only the ones that were genuinely clean
 *     before the run started, preserving the isolation guarantee for real
 *     pre-existing user edits.
 *  B. "independent-main" — a content SHA could be a perfectly valid
 *     forward publish while `base` ITSELF had independently changed one
 *     of the same managed paths since the last guarded publish (e.g. a
 *     manual hotfix commit). The isolated index blindly overwrote it.
 *     Fixed by comparing each touched path's current blob on base against
 *     what it was at the last-applied SHA before applying anything — a
 *     mismatch is now a conflict (code 9), not a silent overwrite.
 *  C. "retry-push" — a push that failed (network blip, server rejection)
 *     still left a local commit + advanced local ref behind. A retry with
 *     the same content SHA read its own leftover local commit as "already
 *     applied" and reported success without ever attempting the push
 *     again, while the remote genuinely had nothing. Fixed by reading the
 *     remote's own truth first when `--remote` is given, and reconciling
 *     the local ref to it (narrowly — only when local is ahead by nothing
 *     but this script's own previously-unpushed guarded commits).
 *
 * "legitimate-restore" was already correct before this file existed (the
 * round-2 sequencing guard's own descendant check) — kept here as a
 * regression anchor so a future change can't quietly break it again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "publish-content.ts");

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==",
  "base64",
);

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
const LANG = { title: "T", specLine: "S", description: "D", viewGalleryLabel: "G" };
function confirmedText(l: typeof LANG) {
  return JSON.stringify({
    title: l.title.trim(),
    specLine: l.specLine.trim(),
    description: l.description.trim(),
    viewGalleryLabel: l.viewGalleryLabel.trim(),
  });
}
const LANG_HASH = sha256(confirmedText(LANG));
function car(photos: { image: string; caption: string }[], price = "1000") {
  return {
    id: "test-car",
    order: 1,
    saleStatus: "for-sale",
    year: "2020",
    price,
    mileageValue: 1000,
    photos,
    video: { mode: "none", src: "", posterSrc: "" },
    uk: LANG,
    en: LANG,
    ru: LANG,
  };
}
function published(photos: { image: string; caption: string }[], price = "1000") {
  return {
    publishedAt: new Date(0).toISOString(),
    cars: [car(photos, price)],
    gallery: [],
    services: [],
    contact: [],
    promos: [],
  };
}
function reviewState() {
  return {
    "car:test-car": {
      uk: { hash: LANG_HASH, at: "2026-01-01" },
      en: { hash: LANG_HASH, at: "2026-01-01" },
      ru: { hash: LANG_HASH, at: "2026-01-01" },
    },
  };
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}
function gitInit(dir: string) {
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.name", "test"], dir);
  git(["config", "user.email", "test@example.com"], dir);
}
async function writeSnapshot(
  dir: string,
  photos: { image: string; caption: string }[],
  files: Record<string, Buffer>,
  price = "1000",
) {
  const cmsDir = path.join(dir, "src/content/cms");
  await fs.mkdir(cmsDir, { recursive: true });
  await fs.writeFile(path.join(cmsDir, "published.json"), JSON.stringify(published(photos, price), null, 2));
  await fs.writeFile(path.join(cmsDir, "review-state.json"), JSON.stringify(reviewState(), null, 2));
  for (const [rel, buf] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);
  }
}
async function seedBaseRepo(): Promise<{ dir: string; seedSha: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-followup-"));
  gitInit(dir);
  await writeSnapshot(
    dir,
    [{ image: "/images/cms/cars/test-car/_pub/photoA.jpg", caption: "" }],
    { "public/images/cms/cars/test-car/_pub/photoA.jpg": TINY_JPEG },
  );
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "seed"], dir);
  const seedSha = git(["rev-parse", "HEAD"], dir);
  return { dir, seedSha };
}
async function commitOnContentBranch(dir: string, mutate: () => Promise<void> | void, message = "content edit"): Promise<string> {
  git(["checkout", "-q", "-B", "content", "main"], dir);
  await mutate();
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", message], dir);
  const sha = git(["rev-parse", "HEAD"], dir);
  git(["checkout", "-q", "main"], dir);
  return sha;
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
async function setPrice(dir: string, value: string) {
  const p = path.join(dir, "src/content/cms/published.json");
  const obj = JSON.parse(await fs.readFile(p, "utf8"));
  obj.cars[0].price = value;
  await fs.writeFile(p, JSON.stringify(obj));
}
function priceAt(dir: string, ref: string) {
  return JSON.parse(git(["show", `${ref}:src/content/cms/published.json`], dir)).cars[0].price;
}
async function twoCandidates(dir: string, secondPrice: string) {
  const first = await commitOnContentBranch(dir, () => setPrice(dir, "2000"));
  git(["checkout", "-q", "content"], dir);
  await setPrice(dir, secondPrice);
  git(["add", "-A"], dir);
  git(["commit", "-qm", "second candidate"], dir);
  const second = git(["rev-parse", "HEAD"], dir);
  git(["checkout", "-q", "main"], dir);
  return { first, second };
}

test("followup: publication must not stage an implicit rollback in the caller checkout", async () => {
  const { dir } = await seedBaseRepo();
  const candidate = await commitOnContentBranch(dir, () => setPrice(dir, "2000"));
  const before = git(["status", "--porcelain"], dir);
  assert.equal(before, "");
  const r = await runPublish(["--repo", dir, "--base", "main", "--content", candidate]);
  assert.equal(r.ok, true, r.out);
  const after = git(["status", "--porcelain"], dir);
  assert.equal(after, "", "the checkout must be clean immediately after a publish on a clean checkout, not carrying a hidden staged rollback");
  await fs.writeFile(path.join(dir, "UNRELATED.txt"), "synthetic unrelated change\n");
  git(["add", "UNRELATED.txt"], dir);
  git(["commit", "-qm", "unrelated follow-up"], dir);
  assert.equal(priceAt(dir, "main"), "2000", "an unrelated next commit must not silently revert the published content");
});

test("followup: a newer source commit may intentionally restore its original price", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const first = await commitOnContentBranch(dir, () => setPrice(dir, "2000"));
  git(["checkout", "-q", "content"], dir);
  const original = git(["show", `${seedSha}:src/content/cms/published.json`], dir);
  await fs.writeFile(path.join(dir, "src/content/cms/published.json"), original);
  git(["add", "-A"], dir);
  git(["commit", "-qm", "new publication restores original price"], dir);
  const second = git(["rev-parse", "HEAD"], dir);
  git(["checkout", "-q", "main"], dir);
  const r1 = await runPublish(["--repo", dir, "--base", "main", "--content", first]);
  assert.equal(r1.ok, true, r1.out);
  const r2 = await runPublish(["--repo", dir, "--base", "main", "--content", second]);
  assert.equal(r2.ok, true, r2.out);
  assert.equal(priceAt(dir, "main"), "1000", "a newer, forward source publication that happens to restore an old value must still apply");
});

test("followup: independently changed target content must cause a conflict", async () => {
  const { dir } = await seedBaseRepo();
  const { first, second } = await twoCandidates(dir, "3000");
  const r1 = await runPublish(["--repo", dir, "--base", "main", "--content", first]);
  assert.equal(r1.ok, true, r1.out);
  git(["restore", "--source", "main", "--staged", "--worktree", "--", "src/content/cms/published.json"], dir);
  await setPrice(dir, "9999");
  git(["add", "-A"], dir);
  git(["commit", "-qm", "independent main content correction"], dir);
  const r2 = await runPublish(["--repo", dir, "--base", "main", "--content", second]);
  assert.equal(r2.ok, false, "an independent target-side correction must block the next publish, not be silently overwritten");
  assert.equal(r2.code, 9);
  assert.equal(priceAt(dir, "main"), "9999", "the independent correction must survive");
});

test("followup: retry after a rejected push must not report remote publication complete", async () => {
  const { dir } = await seedBaseRepo();
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), "publish-followup-remote-"));
  git(["init", "-q", "--bare", "-b", "main"], remote);
  git(["remote", "add", "origin", remote], dir);
  git(["push", "-q", "origin", "main"], dir);
  const candidate = await commitOnContentBranch(dir, () => setPrice(dir, "2000"));
  const hook = path.join(remote, "hooks/pre-receive");
  await fs.writeFile(hook, "#!/bin/sh\necho 'synthetic temporary refusal' >&2\nexit 1\n", { mode: 0o755 });
  const first = await runPublish(["--repo", dir, "--base", "main", "--content", candidate, "--remote", "origin"]);
  assert.equal(first.ok, false, "test setup must refuse the first push");
  await fs.rename(hook, hook + ".disabled");
  const retry = await runPublish(["--repo", dir, "--base", "main", "--content", candidate, "--remote", "origin"]);
  const remotePrice = priceAt(remote, "main");
  assert.ok(
    !retry.ok || remotePrice === "2000",
    `retry reported success but the remote publication is still absent (retry.ok=${retry.ok}, remotePrice=${remotePrice})`,
  );
  assert.equal(retry.ok, true, retry.out);
  assert.equal(remotePrice, "2000", "the retry must actually reach the remote this time, not just report local success");
});
