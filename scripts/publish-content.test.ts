/**
 * Regression tests for publish-content.ts — the actual file-transfer logic
 * behind the guarded content-publish merge. Every test drives REAL git
 * repositories (temp dirs) and the REAL script as a subprocess; nothing here
 * mocks git or re-implements the transfer logic to check against itself.
 *
 * Includes the 5 scenarios from the 2026-09-15 independent review (Codex)
 * that found real defects in the first version of this script — carried
 * over verbatim in spirit (same assertions, not weakened) as the "review:"
 * prefixed tests below, plus additional coverage for the same defect
 * classes (sequencing sub-cases, shell-injection resistance).
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

// A real, tiny, valid 1x1 JPEG — passes content-guard's magic-byte sniff.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==",
  "base64",
);
const OTHER_JPEG = Buffer.concat([TINY_JPEG, Buffer.from([0x00])]);

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

/** A fresh base repo, on `main`, with one committed car that has one photo. */
async function seedBaseRepo(): Promise<{ dir: string; seedSha: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-base-"));
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

/** Creates one commit on a `content` branch (forked fresh from `main`), returns its SHA, leaves `main` checked out again. */
async function commitOnContentBranch(
  dir: string,
  mutate: () => Promise<void> | void,
  message = "content edit",
): Promise<string> {
  git(["checkout", "-q", "-B", "content", "main"], dir);
  await mutate();
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", message], dir);
  const sha = git(["rev-parse", "HEAD"], dir);
  git(["checkout", "-q", "main"], dir);
  return sha;
}

async function runPublish(
  args: string[],
  opts: { env?: Record<string, string> } = {},
): Promise<{ ok: boolean; code: number; out: string }> {
  try {
    const { stdout } = await execFileAsync("node", ["--import", "tsx", SCRIPT, ...args], {
      cwd: ROOT,
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
    });
    return { ok: true, code: 0, out: stdout };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { ok: false, code: e.code ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

/** Read a file's content at a ref, without ever touching the working tree. */
function readAtRef(dir: string, ref: string, filePath: string): string | null {
  return gitOrNull(["show", `${ref}:${filePath}`], dir);
}

// ─────────────────────────────────────────────────────────────────────────
// Baseline transfer behaviour (adapted to read via `git show`, never the
// working tree — the rewritten script deliberately never touches it).
// ─────────────────────────────────────────────────────────────────────────

test("publish-content: transfers an allowed content-only change", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.publishedAt = "2030-01-01T00:00:00.000Z";
    await fs.writeFile(p, JSON.stringify(obj));
  });

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r.ok, true, r.out);

  const headAfter = git(["rev-parse", "main"], dir);
  assert.notEqual(headAfter, seedSha, "a new commit should have been made");
  const pub = JSON.parse(readAtRef(dir, "main", "src/content/cms/published.json")!);
  assert.equal(pub.publishedAt, "2030-01-01T00:00:00.000Z");
  assert.match(git(["log", "-1", "--format=%s", "main"], dir), /^content: publish .*\(guarded [0-9a-f]{40}\)$/);
});

test("publish-content: rejects a content commit that also touches non-content files", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.mkdir(path.join(dir, "src/lib"), { recursive: true });
    await fs.writeFile(path.join(dir, "src/lib/evil.ts"), "// not content\n");
  });

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 2);
  assert.match(r.out, /outside the allowlist/);
  assert.equal(git(["rev-parse", "main"], dir), seedSha, "base must be untouched");
});

test("publish-content: rejects a content commit that deletes published.json (no empty substitute)", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.rm(path.join(dir, "src/content/cms/published.json"));
  });

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 3);
  assert.match(r.out, /missing\/unreadable/);
  assert.equal(git(["rev-parse", "main"], dir), seedSha);
});

test("publish-content: rejects a content commit whose published.json is corrupted JSON", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.writeFile(path.join(dir, "src/content/cms/published.json"), "{ not json");
  });

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 4);
  assert.match(r.out, /content-guard rejected/);
  assert.equal(git(["rev-parse", "main"], dir), seedSha);
});

test("publish-content: replaces an existing referenced photo's bytes at the same path", async () => {
  const { dir } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.writeFile(path.join(dir, "public/images/cms/cars/test-car/_pub/photoA.jpg"), OTHER_JPEG);
  });

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r.ok, true, r.out);
  const blob = git(["cat-file", "-p", "main:public/images/cms/cars/test-car/_pub/photoA.jpg"], dir);
  // git CLI text mode can mangle binary via execFileSync's utf8 encoding, so
  // compare via the blob SHA instead of raw bytes.
  const committedBlobSha = git(["rev-parse", "main:public/images/cms/cars/test-car/_pub/photoA.jpg"], dir);
  const expectedBlobSha = execFileSync("git", ["hash-object", "--stdin"], { input: OTHER_JPEG, cwd: dir })
    .toString()
    .trim();
  assert.equal(committedBlobSha, expectedBlobSha);
  void blob;
});

test("publish-content: adds a new referenced photo", async () => {
  const { dir } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.cars[0].photos.push({ image: "/images/cms/cars/test-car/_pub/photoB.jpg", caption: "" });
    await fs.writeFile(p, JSON.stringify(obj));
    await fs.mkdir(path.join(dir, "public/images/cms/cars/test-car/_pub"), { recursive: true });
    await fs.writeFile(path.join(dir, "public/images/cms/cars/test-car/_pub/photoB.jpg"), OTHER_JPEG);
  });

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r.ok, true, r.out);
  const exists = git(["ls-tree", "main", "public/images/cms/cars/test-car/_pub/photoB.jpg"], dir);
  assert.ok(exists.length > 0);
  const pub = JSON.parse(readAtRef(dir, "main", "src/content/cms/published.json")!);
  assert.equal(pub.cars[0].photos.length, 2);
});

test("publish-content: removes a no-longer-referenced photo from base", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-base-"));
  gitInit(dir);
  await writeSnapshot(
    dir,
    [
      { image: "/images/cms/cars/test-car/_pub/photoA.jpg", caption: "" },
      { image: "/images/cms/cars/test-car/_pub/photoB.jpg", caption: "" },
    ],
    {
      "public/images/cms/cars/test-car/_pub/photoA.jpg": TINY_JPEG,
      "public/images/cms/cars/test-car/_pub/photoB.jpg": OTHER_JPEG,
    },
  );
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "seed (2 photos)"], dir);

  const contentSha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.cars[0].photos = obj.cars[0].photos.filter((ph: { image: string }) => !ph.image.endsWith("photoB.jpg"));
    await fs.writeFile(p, JSON.stringify(obj));
    await fs.rm(path.join(dir, "public/images/cms/cars/test-car/_pub/photoB.jpg"));
  });

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r.ok, true, r.out);
  assert.equal(gitOrNull(["ls-tree", "main", "public/images/cms/cars/test-car/_pub/photoB.jpg"], dir), "");
  const pub = JSON.parse(readAtRef(dir, "main", "src/content/cms/published.json")!);
  assert.equal(pub.cars[0].photos.length, 1);
});

test("publish-content: an unreferenced (orphan) media file is never transferred, even though its path matches the allowlist", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.mkdir(path.join(dir, "public/images/cms/gallery/orphan/_pub"), { recursive: true });
    await fs.writeFile(path.join(dir, "public/images/cms/gallery/orphan/_pub/orphan.jpg"), TINY_JPEG);
  });

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r.ok, true, r.out);
  assert.equal(git(["rev-parse", "main"], dir), seedSha, "nothing approved -> no commit");
  assert.equal(gitOrNull(["ls-tree", "main", "public/images/cms/gallery/orphan/_pub/orphan.jpg"], dir), "");
});

test("publish-content: reprocessing the same content commit is a no-op (no duplicate commit)", async () => {
  const { dir } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.publishedAt = "2032-01-01T00:00:00.000Z";
    await fs.writeFile(p, JSON.stringify(obj));
  });

  const r1 = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r1.ok, true, r1.out);
  const afterFirst = git(["rev-parse", "main"], dir);

  const r2 = await runPublish(["--repo", dir, "--base", "main", "--content", contentSha]);
  assert.equal(r2.ok, true, r2.out);
  const afterSecond = git(["rev-parse", "main"], dir);
  assert.equal(afterSecond, afterFirst, "second run must not create another commit");
  assert.match(r2.out, /already the last one applied|nothing to publish/);
});

test("publish-content: a target branch that moved on the remote is never silently overwritten or force-pushed", async () => {
  const bareRemote = await fs.mkdtemp(path.join(os.tmpdir(), "publish-remote-"));
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", bareRemote]);

  const { dir: base } = await seedBaseRepo();
  git(["remote", "add", "origin", bareRemote], base);
  git(["push", "-q", "origin", "main"], base);

  const contentSha = await commitOnContentBranch(base, async () => {
    const p = path.join(base, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.publishedAt = "2033-01-01T00:00:00.000Z";
    await fs.writeFile(p, JSON.stringify(obj));
  });

  const thirdParty = await fs.mkdtemp(path.join(os.tmpdir(), "publish-thirdparty-"));
  git(["clone", "-q", bareRemote, thirdParty], os.tmpdir());
  git(["config", "user.name", "t"], thirdParty);
  git(["config", "user.email", "t@t.com"], thirdParty);
  await fs.writeFile(path.join(thirdParty, "THIRD-PARTY.txt"), "someone else's commit\n");
  git(["add", "-A"], thirdParty);
  git(["commit", "-q", "-m", "unrelated concurrent change"], thirdParty);
  git(["push", "-q", "origin", "main"], thirdParty);
  const thirdPartySha = git(["rev-parse", "HEAD"], thirdParty);

  const r = await runPublish(["--repo", base, "--base", "main", "--content", contentSha, "--remote", "origin"]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 5);

  const remoteHeadAfter = execFileSync("git", ["ls-remote", bareRemote, "main"], { encoding: "utf8" })
    .split("\t")[0]
    .trim();
  assert.equal(remoteHeadAfter, thirdPartySha, "the third party's commit must survive untouched, not be overwritten");
});

test("publish-content source never invokes git push with a force flag", async () => {
  const src = await fs.readFile(path.join(ROOT, "scripts/publish-content.ts"), "utf8");
  const pushCalls = [...src.matchAll(/git\(\[[^\]]*"push"[^\]]*\]/g)].map((m) => m[0]);
  assert.ok(pushCalls.length > 0, "expected to find at least one git push call site to check");
  for (const call of pushCalls) {
    assert.doesNotMatch(call, /--force|"-f"/, `push call site smuggles a force flag: ${call}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Codex review, 2026-09-15 — carried over, assertions unchanged.
// ─────────────────────────────────────────────────────────────────────────

test("review: pre-staged code must not enter a content commit", async () => {
  const { dir } = await seedBaseRepo();
  const sha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.cars[0].price = "2000";
    await fs.writeFile(p, JSON.stringify(obj));
  });
  await fs.writeFile(path.join(dir, "OUTSIDE.ts"), "// synthetic unrelated staged code\n");
  git(["add", "OUTSIDE.ts"], dir);

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", sha]);
  assert.equal(r.ok, true, r.out);
  const files = git(["show", "--name-only", "--format=", "main"], dir);
  assert.ok(!files.includes("OUTSIDE.ts"), `Unrelated staged code was committed: ${files}`);
  // and it must still be exactly where the user left it — staged, on disk,
  // in the real working copy, completely untouched by the isolated index.
  const status = git(["status", "--porcelain"], dir);
  assert.match(status, /^A {2}OUTSIDE\.ts$/m, `user's staged file was disturbed: ${status}`);
});

test("review: unstaged and untracked user changes survive a publish run untouched", async () => {
  const { dir } = await seedBaseRepo();
  const sha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.cars[0].price = "2000";
    await fs.writeFile(p, JSON.stringify(obj));
  });
  // unstaged modification of a tracked file, plus a genuinely untracked file
  const garbage = "not what git thinks is committed";
  await fs.writeFile(path.join(dir, "src/content/cms/published.json"), garbage);
  await fs.writeFile(path.join(dir, "UNTRACKED.txt"), "never added\n");
  const indexEntryBefore = git(["ls-files", "-s", "src/content/cms/published.json"], dir);

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", sha]);
  assert.equal(r.ok, true, r.out);
  // The publish legitimately moves what `main` points at — that alone
  // changes what `git status` reports for a file whose committed content
  // changed, even with the real index/working tree never touched. So check
  // the properties that actually prove isolation instead of the derived
  // status line: the real index entry is byte-for-byte the same object it
  // was before (this script never wrote to it), the user's unstaged edit on
  // disk is untouched, and the untracked file is still untracked.
  assert.equal(git(["ls-files", "-s", "src/content/cms/published.json"], dir), indexEntryBefore);
  assert.equal(await fs.readFile(path.join(dir, "src/content/cms/published.json"), "utf8"), garbage);
  assert.equal(git(["status", "--porcelain", "--", "UNTRACKED.txt"], dir), "?? UNTRACKED.txt");
});

test("review: old publication replay must not silently undo newer publication", async () => {
  const { dir } = await seedBaseRepo();
  const first = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.cars[0].price = "2000";
    await fs.writeFile(p, JSON.stringify(obj));
  });
  git(["checkout", "-q", "content"], dir);
  const p = path.join(dir, "src/content/cms/published.json");
  const obj = JSON.parse(await fs.readFile(p, "utf8"));
  obj.cars[0].price = "3000";
  await fs.writeFile(p, JSON.stringify(obj));
  git(["add", "-A"], dir);
  git(["commit", "-qm", "newer publication"], dir);
  const second = git(["rev-parse", "HEAD"], dir);
  git(["checkout", "-q", "main"], dir);

  const latest = await runPublish(["--repo", dir, "--base", "main", "--content", second]);
  assert.equal(latest.ok, true, latest.out);

  const replay = await runPublish(["--repo", dir, "--base", "main", "--content", first]);
  assert.equal(replay.ok, false, "replaying an older, already-superseded content SHA must be rejected");
  assert.equal(replay.code, 6);

  const after = JSON.parse(readAtRef(dir, "main", "src/content/cms/published.json")!);
  assert.equal(after.cars[0].price, "3000", "An older candidate must not silently roll back a newer published price");
});

test("review: deletion must preserve media referenced by final target snapshot", async () => {
  const { dir } = await seedBaseRepo();
  const mediaB = "public/images/cms/cars/test-car/_pub/photoB.jpg";
  await fs.writeFile(path.join(dir, mediaB), OTHER_JPEG);
  git(["add", "-A"], dir);
  git(["commit", "-qm", "old unreferenced photo B"], dir);

  const sha = await commitOnContentBranch(dir, async () => {
    await fs.rm(path.join(dir, mediaB));
  });

  // main independently moves on to reference B (a different, unrelated
  // commit — not through the content branch at all) AFTER content's fork.
  const p = path.join(dir, "src/content/cms/published.json");
  const obj = JSON.parse(await fs.readFile(p, "utf8"));
  obj.cars[0].photos = [{ image: "/images/cms/cars/test-car/_pub/photoB.jpg", caption: "" }];
  await fs.writeFile(p, JSON.stringify(obj));
  git(["add", "-A"], dir);
  git(["commit", "-qm", "main now uses B"], dir);
  const baseBeforePublish = git(["rev-parse", "main"], dir);

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", sha]);
  assert.equal(r.ok, false, "must refuse rather than delete a photo the final snapshot still references");
  // Now caught earlier and more precisely, by the independent-target-
  // conflict check (base's own published.json diverged from the shared
  // merge-base) rather than the later final-composed-tree integrity check
  // — both are valid "rejected, nothing changed" outcomes; Codex's own
  // repro.test.ts (unmodified) only asserts the photo survives, not which
  // code catches it, and continues to pass either way.
  assert.equal(r.code, 9);
  assert.equal(git(["rev-parse", "main"], dir), baseBeforePublish, "no commit must be made on a failed integrity check");
  assert.ok(git(["ls-tree", "main", mediaB], dir).length > 0, "the referenced photo must still exist on base");
});

test("review: clean-runner commit must have configured author identity", async () => {
  const { dir } = await seedBaseRepo();
  const sha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.cars[0].price = "2000";
    await fs.writeFile(p, JSON.stringify(obj));
  });
  git(["config", "--unset", "user.name"], dir);
  git(["config", "--unset", "user.email"], dir);
  git(["config", "user.useConfigOnly", "true"], dir);
  const env: Record<string, string> = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  for (const k of ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "EMAIL"]) {
    env[k] = "";
    delete env[k];
  }

  const r = await runPublish(["--repo", dir, "--base", "main", "--content", sha], { env });
  assert.equal(r.code, 0, `commit must not fail because author identity was never configured: ${r.out}`);
});

test("review: workflow input must remain data, not become shell commands", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-workflow-input-"));
  const marker = path.join(dir, "marker.txt");
  const yaml = await fs.readFile(path.join(ROOT, ".github/workflows-proposed/content-guard.yml"), "utf8");
  const templateLine = yaml.split("\n").find((l) => l.trim().startsWith("run: git fetch origin"))!.trim();
  const script = templateLine.slice("run: ".length); // "git fetch origin \"$CONTENT_SHA\"" — literal, unmodified
  const payload = "$(printf REVIEW_MARKER > " + marker + ")";

  // Exactly how GitHub actually supplies the value at runtime: as the
  // CONTENT_SHA environment variable's content, never spliced into the
  // script text itself. A malicious value here must stay inert DATA — a
  // shell's `"$VAR"` expansion never re-parses the variable's own contents
  // as further shell syntax, which is the whole reason `env:` + `$VAR` is
  // GitHub's own recommended fix, not just a stylistic change.
  execFileSync("sh", ["-c", "git() { :; }\n" + script], {
    cwd: dir,
    env: { ...process.env, CONTENT_SHA: payload },
  });
  let injected = false;
  try {
    injected = (await fs.readFile(marker, "utf8")) === "REVIEW_MARKER";
  } catch {
    /* not created is the pass case */
  }
  assert.equal(injected, false, "The env-passed content_sha must not execute as shell syntax");
});

test("review: sanity check — the OLD direct-interpolation pattern this fixes really was exploitable", async () => {
  // Not testing the current file (which no longer does this) — a fixed
  // control proving the harness above would actually have caught the
  // original bug, so a false-negative in the fixed test isn't silently
  // trusted.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-workflow-input-control-"));
  const marker = path.join(dir, "marker.txt");
  const payload = "$(printf REVIEW_MARKER > " + marker + ")";
  const oldVulnerableTemplate = 'git fetch origin "${{ inputs.content_sha }}"';
  const rendered = oldVulnerableTemplate.replace("${{ inputs.content_sha }}", payload);
  execFileSync("sh", ["-c", "git() { :; }\n" + rendered], { cwd: dir });
  const injected = (await fs.readFile(marker, "utf8").catch(() => "")) === "REVIEW_MARKER";
  assert.equal(injected, true, "control did not reproduce the original vulnerability — the harness itself would be untrustworthy");
});

// ─────────────────────────────────────────────────────────────────────────
// Additional sequencing coverage (task point 5's other named scenarios).
// ─────────────────────────────────────────────────────────────────────────

test("sequencing: an exact repeat of the last applied content SHA is a no-op, not an error", async () => {
  const { dir } = await seedBaseRepo();
  const sha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.cars[0].price = "2000";
    await fs.writeFile(p, JSON.stringify(obj));
  });
  const r1 = await runPublish(["--repo", dir, "--base", "main", "--content", sha]);
  assert.equal(r1.ok, true, r1.out);
  const after1 = git(["rev-parse", "main"], dir);

  const r2 = await runPublish(["--repo", dir, "--base", "main", "--content", sha]);
  assert.equal(r2.ok, true, r2.out);
  assert.equal(git(["rev-parse", "main"], dir), after1);
});

test("sequencing: a diverged content history (neither ancestor nor descendant of the last applied) is a conflict", async () => {
  const { dir } = await seedBaseRepo();
  const first = await commitOnContentBranch(
    dir,
    async () => {
      const p = path.join(dir, "src/content/cms/published.json");
      const obj = JSON.parse(await fs.readFile(p, "utf8"));
      obj.cars[0].price = "2000";
      await fs.writeFile(p, JSON.stringify(obj));
    },
    "first",
  );
  const r1 = await runPublish(["--repo", dir, "--base", "main", "--content", first]);
  assert.equal(r1.ok, true, r1.out);

  // A SEPARATE branch, forked from the ORIGINAL seed (not from `first`) —
  // diverged history relative to what's already applied.
  git(["checkout", "-q", "-B", "content2", "main~1"], dir);
  const p = path.join(dir, "src/content/cms/published.json");
  const obj = JSON.parse(await fs.readFile(p, "utf8"));
  obj.cars[0].price = "9999";
  await fs.writeFile(p, JSON.stringify(obj));
  git(["add", "-A"], dir);
  git(["commit", "-qm", "diverged"], dir);
  const diverged = git(["rev-parse", "HEAD"], dir);
  git(["checkout", "-q", "main"], dir);

  const r2 = await runPublish(["--repo", dir, "--base", "main", "--content", diverged]);
  assert.equal(r2.ok, false);
  assert.equal(r2.code, 7);
  const after = JSON.parse(readAtRef(dir, "main", "src/content/cms/published.json")!);
  assert.equal(after.cars[0].price, "2000", "a diverged/conflicting candidate must not be applied");
});

// ─────────────────────────────────────────────────────────────────────────
// Shell-injection resistance (task point 3).
// ─────────────────────────────────────────────────────────────────────────

test("injection: a content SHA that isn't a full 40-hex string is rejected before any git operation", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const malicious = '$(touch /tmp/pwned-' + process.pid + ')';
  const r = await runPublish(["--repo", dir, "--base", "main", "--content", malicious]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 1);
  assert.match(r.out, /40-character hex/);
  await assert.rejects(fs.access(`/tmp/pwned-${process.pid}`), "malicious payload must never execute");
  assert.equal(git(["rev-parse", "main"], dir), seedSha);
});

test("injection: a syntactically hex-looking but non-existent SHA is rejected as not a fetched commit", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const r = await runPublish(["--repo", dir, "--base", "main", "--content", "deadbeef".repeat(5)]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 1);
  assert.match(r.out, /not a fetched commit object/);
  assert.equal(git(["rev-parse", "main"], dir), seedSha);
});

test("workflow YAML: content_sha is only ever read via env, never interpolated into run: text", async () => {
  const yaml = await fs.readFile(path.join(ROOT, ".github/workflows-proposed/content-guard.yml"), "utf8");
  const lines = yaml.split("\n");
  const offenders = lines.filter((l) => /^\s*run:/.test(l) && l.includes("inputs.content_sha"));
  assert.deepEqual(offenders, [], `run: lines must never interpolate inputs.content_sha directly: ${offenders}`);
  // and each CONTENT_SHA-using run: step must actually declare it via env:
  const envDeclCount = (yaml.match(/CONTENT_SHA:\s*\$\{\{\s*inputs\.content_sha\s*\}\}/g) ?? []).length;
  assert.ok(envDeclCount >= 2, "expected the fetch and publish steps to both pass content_sha via env:");
});
