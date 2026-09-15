/**
 * Regression tests for publish-content.ts — the actual file-transfer logic
 * behind the guarded content-publish merge. Every test drives REAL git
 * repositories (temp dirs) and the REAL script as a subprocess; nothing here
 * mocks git or re-implements the transfer logic to check against itself.
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
const OTHER_JPEG = Buffer.concat([TINY_JPEG, Buffer.from([0x00])]); // distinct bytes, still a valid tail-padded JPEG stream for our sniff

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

function car(photos: { image: string; caption: string }[]) {
  return {
    id: "test-car",
    order: 1,
    saleStatus: "for-sale",
    year: "2020",
    price: "1000",
    mileageValue: 1000,
    photos,
    video: { mode: "none", src: "", posterSrc: "" },
    uk: LANG,
    en: LANG,
    ru: LANG,
  };
}
function published(photos: { image: string; caption: string }[]) {
  return {
    publishedAt: new Date(0).toISOString(),
    cars: [car(photos)],
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
) {
  const cmsDir = path.join(dir, "src/content/cms");
  await fs.mkdir(cmsDir, { recursive: true });
  await fs.writeFile(path.join(cmsDir, "published.json"), JSON.stringify(published(photos), null, 2));
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

function commitOnContentBranch(
  dir: string,
  mutate: () => Promise<void> | void,
  message = "content edit",
): Promise<string> {
  return (async () => {
    git(["checkout", "-q", "-b", "content", "main"], dir).toString();
    // idempotent re-checkout if branch already exists from a prior call in the same test
    await mutate();
    git(["add", "-A"], dir);
    git(["commit", "-q", "-m", message], dir);
    const sha = git(["rev-parse", "HEAD"], dir);
    git(["checkout", "-q", "main"], dir);
    return sha;
  })();
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

test("publish-content: transfers an allowed content-only change", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.publishedAt = "2030-01-01T00:00:00.000Z";
    await fs.writeFile(p, JSON.stringify(obj));
  });

  const r = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r.ok, true, r.out);

  const headAfter = git(["rev-parse", "HEAD"], dir);
  assert.notEqual(headAfter, seedSha, "a new commit should have been made");
  const pub = JSON.parse(git(["show", "HEAD:src/content/cms/published.json"], dir));
  assert.equal(pub.publishedAt, "2030-01-01T00:00:00.000Z");
  assert.match(git(["log", "-1", "--format=%s"], dir), /^content: publish /);
});

test("publish-content: rejects a content commit that also touches non-content files", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.mkdir(path.join(dir, "src/lib"), { recursive: true });
    await fs.writeFile(path.join(dir, "src/lib/evil.ts"), "// not content\n");
  });

  const r = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 2);
  assert.match(r.out, /outside the allowlist/);
  assert.equal(git(["rev-parse", "HEAD"], dir), seedSha, "base must be untouched");
});

test("publish-content: rejects a content commit that deletes published.json (no empty substitute)", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.rm(path.join(dir, "src/content/cms/published.json"));
  });

  const r = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 3);
  assert.match(r.out, /missing\/unreadable/);
  assert.equal(git(["rev-parse", "HEAD"], dir), seedSha);
});

test("publish-content: rejects a content commit whose published.json is corrupted JSON", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.writeFile(path.join(dir, "src/content/cms/published.json"), "{ not json");
  });

  const r = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 4);
  assert.match(r.out, /content-guard rejected/);
  assert.equal(git(["rev-parse", "HEAD"], dir), seedSha);
});

test("publish-content: replaces an existing referenced photo's bytes at the same path", async () => {
  const { dir } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.writeFile(path.join(dir, "public/images/cms/cars/test-car/_pub/photoA.jpg"), OTHER_JPEG);
  });

  const r = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r.ok, true, r.out);
  const bytes = await fs.readFile(path.join(dir, "public/images/cms/cars/test-car/_pub/photoA.jpg"));
  assert.ok(bytes.equals(OTHER_JPEG));
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

  const r = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r.ok, true, r.out);
  const bytes = await fs.readFile(path.join(dir, "public/images/cms/cars/test-car/_pub/photoB.jpg"));
  assert.ok(bytes.equals(OTHER_JPEG));
  const pub = JSON.parse(git(["show", "HEAD:src/content/cms/published.json"], dir));
  assert.equal(pub.cars[0].photos.length, 2);
});

test("publish-content: removes a no-longer-referenced photo from the base tree", async () => {
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

  const r = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r.ok, true, r.out);
  await assert.rejects(fs.access(path.join(dir, "public/images/cms/cars/test-car/_pub/photoB.jpg")));
  const pub = JSON.parse(git(["show", "HEAD:src/content/cms/published.json"], dir));
  assert.equal(pub.cars[0].photos.length, 1);
});

test("publish-content: an unreferenced (orphan) media file is never transferred, even though its path matches the allowlist", async () => {
  const { dir, seedSha } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    await fs.mkdir(path.join(dir, "public/images/cms/gallery/orphan/_pub"), { recursive: true });
    await fs.writeFile(path.join(dir, "public/images/cms/gallery/orphan/_pub/orphan.jpg"), TINY_JPEG);
  });

  const r = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r.ok, true, r.out);
  assert.equal(git(["rev-parse", "HEAD"], dir), seedSha, "nothing approved -> no commit");
  await assert.rejects(fs.access(path.join(dir, "public/images/cms/gallery/orphan/_pub/orphan.jpg")));
});

test("publish-content: never sweeps an unrelated dirty/untracked file into the publish commit", async () => {
  const { dir } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.publishedAt = "2031-01-01T00:00:00.000Z";
    await fs.writeFile(p, JSON.stringify(obj));
  });
  // Written AFTER the content commit (and back on `main`) — simulates an
  // accidental leftover sitting in the checkout that runs publish-content,
  // never something that went through the content branch itself.
  await fs.writeFile(path.join(dir, "LEFTOVER.txt"), "accidental local file\n");

  const r = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r.ok, true, r.out);
  const filesInCommit = git(["show", "--name-only", "--format=", "HEAD"], dir).split("\n").filter(Boolean);
  assert.ok(!filesInCommit.includes("LEFTOVER.txt"), `LEFTOVER.txt leaked into commit: ${filesInCommit}`);
  // still there on disk, untouched — we didn't delete it either, just never staged it
  await fs.access(path.join(dir, "LEFTOVER.txt"));
});

test("publish-content: reprocessing the same content commit is a no-op (no duplicate commit)", async () => {
  const { dir } = await seedBaseRepo();
  const contentSha = await commitOnContentBranch(dir, async () => {
    const p = path.join(dir, "src/content/cms/published.json");
    const obj = JSON.parse(await fs.readFile(p, "utf8"));
    obj.publishedAt = "2032-01-01T00:00:00.000Z";
    await fs.writeFile(p, JSON.stringify(obj));
  });

  const r1 = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r1.ok, true, r1.out);
  const afterFirst = git(["rev-parse", "HEAD"], dir);

  const r2 = await runPublish(["--repo", dir, "--content", contentSha]);
  assert.equal(r2.ok, true, r2.out);
  const afterSecond = git(["rev-parse", "HEAD"], dir);
  assert.equal(afterSecond, afterFirst, "second run must not create another commit");
  assert.match(r2.out, /nothing to publish/);
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

  // A third party pushes directly to the remote — base's local clone never
  // fetches it, so base still believes origin/main == its own old HEAD.
  const thirdParty = await fs.mkdtemp(path.join(os.tmpdir(), "publish-thirdparty-"));
  git(["clone", "-q", bareRemote, thirdParty], os.tmpdir());
  await fs.writeFile(path.join(thirdParty, "THIRD-PARTY.txt"), "someone else's commit\n");
  git(["add", "-A"], thirdParty);
  git(["commit", "-q", "-m", "unrelated concurrent change"], thirdParty);
  git(["push", "-q", "origin", "main"], thirdParty);
  const thirdPartySha = git(["rev-parse", "HEAD"], thirdParty);

  const r = await runPublish(["--repo", base, "--content", contentSha, "--remote", "origin"]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 5);
  assert.match(r.out, /NOT pushed, NOT force-pushed/);

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
