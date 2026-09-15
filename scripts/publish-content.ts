/**
 * publish-content — the actual file-transfer logic behind the guarded
 * content-publish merge (docs/PANEL-hosting-and-approvals.md §1.3).
 *
 * Pulled out of the workflow's inline `run:` blocks so it can be exercised
 * by real regression tests against real temporary git repos
 * (publish-content.test.ts), not just read by eye. The workflow
 * (.github/workflows-proposed/content-guard.yml) calls this same script.
 *
 * Usage:
 *   node --import tsx scripts/publish-content.ts \
 *     --repo <path-to-a-checkout-currently-on-the-base-branch> \
 *     --content <sha-on-the-content-branch> \
 *     [--remote <name>]   # if given, pushes (never --force) after commit
 *
 * Exit codes (distinct on purpose, so a caller/test can tell rejection
 * classes apart without parsing stderr text):
 *   0  success (a commit was made, or nothing needed publishing)
 *   2  the content commit touched files outside the allowlist
 *   3  a required file (published.json) is missing/unreadable at the
 *      content commit
 *   4  content-guard itself rejected the snapshot/media
 *   5  the base branch moved (locally or on the remote) since this run
 *      started — never silently overwritten, never force-pushed
 */
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const REPO = path.resolve(arg("repo", ".")!);
const CONTENT_SHA = arg("content");
const REMOTE = arg("remote");
const BASE_PATTERN =
  /^(src\/content\/cms\/(published|review-state)\.json|public\/images\/cms\/.+)$/;
const PUBLISHED_PATH = "src/content/cms/published.json";
const REVIEW_PATH = "src/content/cms/review-state.json";

class PublishError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

function git(args: string[], cwd = REPO): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** Non-throwing: returns null instead of failing when the ref:path doesn't exist. */
function gitShowOrNull(sha: string, filePath: string, cwd = REPO): string | null {
  try {
    return execFileSync("git", ["show", `${sha}:${filePath}`], { cwd, encoding: "utf8" });
  } catch {
    return null;
  }
}

interface ChangedFiles {
  /** Present (new or changed content) at the content commit — must be checked out. */
  upserted: string[];
  /** Absent at the content commit but present at the merge-base — must be removed. */
  removed: string[];
}

function changedFiles(base: string, content: string): ChangedFiles {
  const mergeBase = git(["merge-base", base, content]);
  const raw = git(["diff", "--name-status", "--no-renames", mergeBase, content]);
  const upserted: string[] = [];
  const removed: string[] = [];
  for (const line of raw.split("\n").filter(Boolean)) {
    const [status, ...rest] = line.split("\t");
    const file = rest.join("\t");
    if (status === "D") removed.push(file);
    else upserted.push(file);
  }
  return { upserted, removed };
}

function assertAllowlisted(changed: ChangedFiles): void {
  const bad = [...changed.upserted, ...changed.removed].filter((f) => !BASE_PATTERN.test(f));
  if (bad.length > 0) {
    throw new PublishError(
      2,
      `content branch touched files outside the allowlist:\n${bad.map((f) => `  ${f}`).join("\n")}`,
    );
  }
}

async function extractGuardInputs(
  content: string,
): Promise<{ tmpDir: string; publishedPath: string; reviewPath: string; mediaRoot: string }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-content-"));
  const published = gitShowOrNull(content, PUBLISHED_PATH);
  if (published === null) {
    throw new PublishError(
      3,
      `required file missing/unreadable at ${content}: ${PUBLISHED_PATH} — refusing to publish (never substituting empty content)`,
    );
  }
  const publishedPath = path.join(tmpDir, "published.json");
  await fs.writeFile(publishedPath, published, "utf8");

  // review-state.json is allowed to be genuinely absent (content-guard.ts's
  // own default already tolerates that) — but if it exists, use it as-is.
  const review = gitShowOrNull(content, REVIEW_PATH) ?? "{}";
  const reviewPath = path.join(tmpDir, "review.json");
  await fs.writeFile(reviewPath, review, "utf8");

  // content-guard.ts resolves a media reference "/images/cms/..." as
  // <mediaRoot>/images/cms/... (it expects --media-root to point at the
  // equivalent of the repo's `public/` dir) — `git archive` on the
  // `public/images/cms` pathspec preserves the full repo-root-relative path
  // in the resulting tar (i.e. entries start with "public/"), so it must be
  // stripped back off on extraction. Omitting --strip-components here was a
  // real bug: the workflow's original inline version had the same mismatch
  // and had never been exercised live, only unit-tested against the real
  // project's own public/ directory (where the extra "public/" prefix
  // doesn't matter, since MEDIA_ROOT defaults to it already) — found by the
  // first regression test that ran this path against a synthetic repo.
  const mediaRoot = path.join(tmpDir, "media");
  await fs.mkdir(mediaRoot, { recursive: true });
  try {
    execFileSync(
      "sh",
      ["-c", `git archive "${content}" -- public/images/cms | tar -x -C "${mediaRoot}" --strip-components=1`],
      { cwd: REPO },
    );
  } catch {
    // No media directory at all on the content commit yet — fine, mediaRoot stays empty.
  }

  return { tmpDir, publishedPath, reviewPath, mediaRoot };
}

function runContentGuard(inputs: {
  publishedPath: string;
  reviewPath: string;
  mediaRoot: string;
  manifestOut: string;
}): void {
  try {
    execFileSync(
      "node",
      [
        "--import",
        "tsx",
        "scripts/content-guard.ts",
        "--published",
        inputs.publishedPath,
        "--review",
        inputs.reviewPath,
        "--media-root",
        inputs.mediaRoot,
        "--manifest-out",
        inputs.manifestOut,
      ],
      { cwd: PROJECT_ROOT, stdio: "pipe", encoding: "utf8" },
    );
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    throw new PublishError(
      4,
      `content-guard rejected the snapshot/media:\n${e.stdout ?? ""}${e.stderr ?? ""}`,
    );
  }
}

async function main() {
  if (!CONTENT_SHA) {
    console.error("usage: publish-content.ts --repo <path> --content <sha> [--remote <name>]");
    process.exit(1);
  }

  const base = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (base === "HEAD") {
    console.error("REJECTED: repo is in detached HEAD — must be on a real branch");
    process.exit(1);
  }
  const baseShaAtStart = git(["rev-parse", "HEAD"]);

  try {
    const changed = changedFiles(base, CONTENT_SHA);

    if (changed.upserted.length === 0 && changed.removed.length === 0) {
      console.log("nothing to publish (content commit introduces no change vs base)");
      return;
    }

    assertAllowlisted(changed);

    const { publishedPath, reviewPath, mediaRoot } = await extractGuardInputs(CONTENT_SHA);
    const manifestOut = path.join(path.dirname(publishedPath), "manifest.txt");
    runContentGuard({ publishedPath, reviewPath, mediaRoot, manifestOut });
    const manifest = (await fs.readFile(manifestOut, "utf8"))
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const manifestSet = new Set(manifest);

    // Race guard #1: has the base branch moved locally since we captured it?
    if (git(["rev-parse", "HEAD"]) !== baseShaAtStart) {
      throw new PublishError(5, "base branch moved locally during processing — aborting, not overwriting");
    }

    // Apply: upsert exactly the guard-approved manifest files (never a
    // whole directory — a still-unpublished draft's photos are never
    // pulled in just because they happen to share the content commit).
    const toUpsert = changed.upserted.filter((f) => manifestSet.has(f) || f === PUBLISHED_PATH || f === REVIEW_PATH);
    const toRemove = changed.removed.filter((f) => f.startsWith("public/images/cms/"));

    // Stage exactly the files we touched — never `git add -A`, which would
    // also pick up any unrelated dirty/untracked file already sitting in
    // this working copy and smuggle it into the publish commit.
    for (const f of toUpsert) {
      git(["checkout", CONTENT_SHA, "--", f]);
      git(["add", "--", f]);
    }
    for (const f of toRemove) {
      // `git rm` already stages the deletion in one step — a separate
      // `git add` on a now-nonexistent path would fail ("pathspec did not
      // match any files").
      git(["rm", "--ignore-unmatch", "--quiet", "--", f]);
    }

    const staged = git(["diff", "--cached", "--name-only"]);
    if (!staged) {
      console.log("nothing to publish (target already matches content)");
      return;
    }

    // Race guard #2: re-confirm nothing landed on base between the checks
    // above and the commit itself.
    if (git(["rev-parse", "HEAD"]) !== baseShaAtStart) {
      git(["reset", "--hard", "HEAD"]);
      throw new PublishError(5, "base branch moved locally during processing — aborting, not overwriting");
    }

    git(["commit", "-m", `content: publish ${new Date().toISOString()} (guarded ${CONTENT_SHA})`]);
    console.log(`published:\n${staged}`);

    if (REMOTE) {
      const remoteHead = git(["ls-remote", REMOTE, base])
        .split("\t")[0]
        ?.trim();
      if (remoteHead && remoteHead !== baseShaAtStart) {
        throw new PublishError(
          5,
          `base branch moved on remote "${REMOTE}" during processing (was ${baseShaAtStart}, now ${remoteHead}) — commit kept locally, NOT pushed, NOT force-pushed`,
        );
      }
      // Plain push, never --force: if the remote moved after the check
      // above (tight race), git itself rejects a non-fast-forward push.
      git(["push", REMOTE, `HEAD:${base}`]);
    }
  } catch (err) {
    if (err instanceof PublishError) {
      console.error(`REJECTED (${err.code}): ${err.message}`);
      process.exit(err.code);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
