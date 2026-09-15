/**
 * Regression tests for publish-content.ts — a FOURTH independent review
 * (2026-09-15) reproduced 2 scenarios against real git repos, both real
 * defects. Carried over here verbatim in spirit — same assertions, not
 * weakened — as permanent repository tests. See the commit this file is
 * part of, and the top-of-file notes in publish-content.ts (defects H/I),
 * for the fixes:
 *
 *  H. "staged-user-content" — the end-of-run checkout-sync step decided a
 *     touched path was safe to overwrite by checking ONLY the working tree
 *     against `baseShaAtStart`. A user can stage an intentional edit
 *     (`git add`) and then have their working file happen to read back
 *     identical to baseline again — the working-tree-only check saw
 *     "clean" and ran `git checkout <newCommit> -- f`, which overwrites the
 *     INDEX too, silently discarding the staged edit. Fixed: a path is now
 *     only "unchanged since start" when BOTH the working tree and the index
 *     (`git diff --cached <sha> -- f`) match `baseShaAtStart`.
 *  I. "branchless-remote-retry" — a retry of a first-ever publish, after an
 *     earlier attempt committed locally but then failed to push, read its
 *     own leftover local commit as "already applied" (sequencing) and
 *     reported success without ever attempting the push again — while the
 *     remote branch still didn't exist at all and had received nothing.
 *     Fixed: when sequencing verdicts "noop" and `--remote` was given, this
 *     script now independently re-reads the remote's own current branch
 *     state and requires it to exactly equal the local base ref before
 *     trusting the noop; any mismatch (missing branch, or a different
 *     commit) is a clear refusal (exit 11), never a silent false success —
 *     and never discards the local commit.
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

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}
function gitInit(dir: string) {
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.name", "test"], dir);
  git(["config", "user.email", "test@example.com"], dir);
}
async function writeSnapshot(dir: string, photos: { image: string; caption: string }[], files: Record<string, Buffer>, price = "1000") {
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
async function seedBaseRepo(): Promise<{ dir: string; seedSha: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-round4-"));
  gitInit(dir);
  await writeSnapshot(dir, [{ image: "/images/cms/cars/test-car/_pub/photoA.jpg", caption: "" }], {
    "public/images/cms/cars/test-car/_pub/photoA.jpg": TINY_JPEG,
  });
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
async function changePrice(dir: string, price: string) {
  const p = path.join(dir, "src/content/cms/published.json");
  const obj = JSON.parse(await fs.readFile(p, "utf8"));
  obj.cars[0].price = price;
  await fs.writeFile(p, JSON.stringify(obj));
}

test("round4: staged user content must survive when the working tree happens to equal baseline", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const sha = await commitOnContentBranch(dir, () => changePrice(dir, "2000"));
  const rel = "src/content/cms/published.json";
  const p = path.join(dir, rel);

  // Stage an intentional user edit (price 3333)...
  await changePrice(dir, "3333");
  git(["add", "--", rel], dir);
  const stagedBefore = git(["rev-parse", ":" + rel], dir);

  // ...then have the WORKING FILE happen to read back exactly like the
  // pre-publish baseline (e.g. the user reverted their working copy by hand
  // but forgot the already-staged version) — a working-tree-only dirtiness
  // check would misread this path as perfectly clean.
  await fs.writeFile(p, execFileSync("git", ["show", seedSha + ":" + rel], { cwd: dir }));
  assert.equal(git(["diff", seedSha, "--", rel], dir), "", "working tree must match baseline exactly");
  assert.notEqual(git(["diff", "--cached", seedSha, "--", rel], dir), "", "the index must still hold the staged edit");

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", sha]);
  assert.equal(r.ok, true, r.out);

  const stagedAfter = git(["rev-parse", ":" + rel], dir);
  assert.equal(stagedAfter, stagedBefore, "publication must not discard the user's staged content");
  const stagedPrice = JSON.parse(git(["show", ":" + rel], dir)).cars[0].price;
  assert.equal(stagedPrice, "3333", "the staged price must remain exactly what the user staged");
});

test("round4: retrying a first publish against a still-branchless remote must not claim already applied", async () => {
  const { dir } = await seedBaseRepo();
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), "round4-branchless-"));
  git(["init", "-q", "--bare", "-b", "main"], remote);
  git(["remote", "add", "origin", remote], dir);
  // Deliberately never pushed — the remote is reachable but has literally
  // zero branches for this repo, exactly like a brand-new empty remote.

  const sha = await commitOnContentBranch(dir, () => changePrice(dir, "2000"));
  const hook = path.join(remote, "hooks/pre-receive");
  await fs.writeFile(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });

  const first = await runPublish(["--repo", dir, "--base", "main", "--content", sha, "--remote", "origin"]);
  assert.equal(first.ok, false, "test setup must refuse the first push");

  await fs.writeFile(hook, "#!/bin/sh\nexit 0\n", { mode: 0o755 }); // the retry itself would now succeed if attempted
  const retry = await runPublish(["--repo", dir, "--base", "main", "--content", sha, "--remote", "origin"]);
  const remoteHead = git(["ls-remote", "origin", "refs/heads/main"], dir);

  assert.equal(remoteHead, "", "sanity: the remote genuinely still has no main branch");
  assert.equal(retry.ok, false, "cannot report success while the remote still has no target branch");
  assert.equal(retry.code, 11);

  // The local guarded commit must be preserved, not discarded, by the
  // refusal — a later corrected retry (or a manual push) must still work.
  const localPrice = JSON.parse(git(["show", "main:src/content/cms/published.json"], dir)).cars[0].price;
  assert.equal(localPrice, "2000", "the local guarded commit must still be intact");
});
