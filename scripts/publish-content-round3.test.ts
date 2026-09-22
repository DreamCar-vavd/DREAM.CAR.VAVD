/**
 * Regression tests for publish-content.ts — a THIRD independent review
 * (2026-09-15) reproduced 4 scenarios against real git repos, all real
 * defects. Carried over here verbatim in spirit — same assertions, not
 * weakened — as permanent repository tests. See the commit this file is
 * part of for the fixes:
 *
 *  D. "remote-unreadable" — a retry after a failed push, against a remote
 *     that has since become entirely UNREACHABLE (not just "reachable but
 *     empty for this branch"), read its own leftover local commit as
 *     "already applied" and reported false success. Fixed:
 *     `git ls-remote` failure now throws (exit 10) instead of silently
 *     falling through to local-only sequencing.
 *  E. "existing-photo-now-published" — a media file added (unreferenced)
 *     by an earlier already-applied content commit, later referenced by a
 *     newer one WITHOUT its bytes ever changing, showed no diff against
 *     the last-applied SHA and was silently never copied to base —
 *     content-guard then correctly failed the final composed result,
 *     incorrectly blocking a legitimate publish. Fixed: the upsert set is
 *     now computed directly from content-guard's own manifest of the
 *     content commit's CURRENT references, compared against base's
 *     CURRENT blob for each — independent of diff history.
 *  F. "remove-unpublished-photo" — deleting a photo that was NEVER
 *     actually copied to base (correctly excluded from an earlier publish
 *     as unreferenced) was misreported as an "independent target
 *     conflict", because the check compared against the CONTENT branch's
 *     own historical tree (which still had the orphaned file) instead of
 *     what base itself had after the last guarded publish. Fixed: the
 *     conflict check's anchor is now the last guarded commit's OWN tree
 *     on `base`'s history (or the true merge-base for a first-ever
 *     publish) — not a commit on the content branch.
 *  G. "concurrent-local-edit" — the "sync touched paths into the real
 *     checkout" step decided what was safe to touch from a snapshot taken
 *     once near the start of the run; a user edit made LATER, during the
 *     run's own execution (modeled here via a deterministic git
 *     `pre-push` hook), was invisible to that snapshot and got silently
 *     overwritten. Fixed: each path is now checked JUST BEFORE it's
 *     touched, against `baseShaAtStart`, at that exact moment.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

const execFileAsync = promisify(execFile);
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const ROOT = path.resolve(import.meta.dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "publish-content.ts");

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==",
  "base64",
);
const OTHER_JPEG = Buffer.concat([TINY_JPEG, Buffer.from([0x00])]);

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
  const car = {
    id: "test-car",
    order: 1,
    saleStatus: "for-sale",
    year: "2020",
    price,
    mileageValue: 1000,
    photos,
    video: { mode: "none", src: "", posterSrc: "" },
    uk: { title: "T", specLine: "S", description: "D", viewGalleryLabel: "G" },
    en: { title: "T", specLine: "S", description: "D", viewGalleryLabel: "G" },
    ru: { title: "T", specLine: "S", description: "D", viewGalleryLabel: "G" },
  };
  await fs.writeFile(
    path.join(cmsDir, "published.json"),
    JSON.stringify({ publishedAt: new Date(0).toISOString(), cars: [car], gallery: [], services: [], contact: [], promos: [] }, null, 2),
  );
  const confirmedText = JSON.stringify({ title: "T", specLine: "S", description: "D", viewGalleryLabel: "G" });
  const LANG_HASH = sha256(confirmedText); // must match carsGate.ts's own confirmedText() exactly
  await fs.writeFile(
    path.join(cmsDir, "review-state.json"),
    JSON.stringify(
      { "car:test-car": { uk: { hash: LANG_HASH, at: "2026-01-01" }, en: { hash: LANG_HASH, at: "2026-01-01" }, ru: { hash: LANG_HASH, at: "2026-01-01" } } },
      null,
      2,
    ),
  );
  for (const [rel, buf] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);
  }
}
async function seedBaseRepo(): Promise<{ dir: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-round3-"));
  gitInit(dir);
  await writeSnapshot(
    dir,
    [{ image: "/images/cms/cars/test-car/_pub/photoA.jpg", caption: "" }],
    { "public/images/cms/cars/test-car/_pub/photoA.jpg": TINY_JPEG },
  );
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "seed"], dir);
  return { dir };
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
async function changePrice(dir: string, price: string) {
  const p = path.join(dir, "src/content/cms/published.json");
  const obj = JSON.parse(await fs.readFile(p, "utf8"));
  obj.cars[0].price = price;
  await fs.writeFile(p, JSON.stringify(obj));
}
/** A guarded publish already applied, plus an ORPHANED (unreferenced) photo the content branch also carries. */
async function candidateWithUnpublishedPhoto(): Promise<{ dir: string; rel: string }> {
  const { dir } = await seedBaseRepo();
  const rel = "public/images/cms/cars/test-car/_pub/photoB.jpg";
  const first = await commitOnContentBranch(dir, async () => {
    await changePrice(dir, "2000");
    await fs.writeFile(path.join(dir, rel), OTHER_JPEG);
  });
  const r = await runPublish(["--repo", dir, "--base", "main", "--content", first]);
  assert.equal(r.ok, true, r.out);
  assert.equal(git(["ls-tree", "main", "--", rel], dir), "", "orphan must not already be published");
  git(["checkout", "-q", "content"], dir);
  return { dir, rel };
}

test("round3: an unreadable remote must not be treated as confirmed publication", async () => {
  const { dir } = await seedBaseRepo();
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), "round3-unreachable-"));
  git(["init", "-q", "--bare", "-b", "main"], remote);
  git(["remote", "add", "origin", remote], dir);
  git(["push", "-q", "origin", "main"], dir);
  const sha = await commitOnContentBranch(dir, () => changePrice(dir, "2000"));
  const hook = path.join(remote, "hooks/pre-receive");
  await fs.writeFile(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const first = await runPublish(["--repo", dir, "--base", "main", "--content", sha, "--remote", "origin"]);
  assert.equal(first.ok, false, "test setup must refuse the first push");
  await fs.rename(remote, remote + "-offline");
  const retry = await runPublish(["--repo", dir, "--base", "main", "--content", sha, "--remote", "origin"]);
  assert.equal(retry.ok, false, "an unreachable remote cannot prove success or already-applied status");
  assert.equal(retry.code, 10);
  const remotePrice = JSON.parse(git(["show", "main:src/content/cms/published.json"], remote + "-offline")).cars[0].price;
  assert.equal(remotePrice, "1000", "the remote must still be at its original, unpublished state");
});

test("round3: newly referencing an existing source photo must transfer its bytes even though they never changed", async () => {
  const { dir, rel } = await candidateWithUnpublishedPhoto();
  const p = path.join(dir, "src/content/cms/published.json");
  const obj = JSON.parse(await fs.readFile(p, "utf8"));
  obj.cars[0].photos = [{ image: "/" + rel.slice("public/".length), caption: "" }];
  await fs.writeFile(p, JSON.stringify(obj));
  git(["add", "-A"], dir);
  git(["commit", "-qm", "publish existing B photo"], dir);
  const sha = git(["rev-parse", "HEAD"], dir);
  const r = await runPublish(["--repo", dir, "--base", "main", "--content", sha]);
  assert.equal(r.ok, true, "a validly referenced source photo must be included even if its bytes did not change since prior publication: " + r.out);
  assert.ok(git(["ls-tree", "main", "--", rel], dir).length > 0);
});

test("round3: deleting an unpublished draft photo must not cause a false target conflict", async () => {
  const { dir, rel } = await candidateWithUnpublishedPhoto();
  await fs.rm(path.join(dir, rel));
  await changePrice(dir, "3000");
  git(["add", "-A"], dir);
  git(["commit", "-qm", "remove orphan and update published price"], dir);
  const sha = git(["rev-parse", "HEAD"], dir);
  const r = await runPublish(["--repo", dir, "--base", "main", "--content", sha]);
  assert.equal(r.ok, true, "removing a source-only (never-published) photo cannot conflict with an independently changed target: " + r.out);
  const after = JSON.parse(git(["show", "main:src/content/cms/published.json"], dir));
  assert.equal(after.cars[0].price, "3000");
});

test("round3: a user edit made during push must survive checkout synchronization", async () => {
  const { dir } = await seedBaseRepo();
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), "round3-edit-during-push-"));
  git(["init", "-q", "--bare", "-b", "main"], remote);
  git(["remote", "add", "origin", remote], dir);
  git(["push", "-q", "origin", "main"], dir);
  const sha = await commitOnContentBranch(dir, () => changePrice(dir, "2000"));
  const p = path.join(dir, "src/content/cms/published.json");
  const marker = "LOCAL_USER_EDIT_DURING_PUBLISH";
  // Deterministically models an independent editor writing to this exact
  // file at the moment push happens — inside this script's own execution
  // window, not before it started.
  await fs.writeFile(path.join(dir, ".git/hooks/pre-push"), "#!/bin/sh\nprintf '%s' '" + marker + "' > '" + p + "'\n", { mode: 0o755 });
  const r = await runPublish(["--repo", dir, "--base", "main", "--content", sha, "--remote", "origin"]);
  assert.equal(r.ok, true, r.out);
  const preserved = (await fs.readFile(p, "utf8")) === marker;
  assert.equal(preserved, true, "checkout synchronization must not overwrite a user edit made during the run");
});
