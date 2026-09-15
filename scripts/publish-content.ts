/**
 * publish-content — the actual file-transfer logic behind the guarded
 * content-publish merge (docs/PANEL-hosting-and-approvals.md §1.3).
 *
 * Rewritten 2026-09-15 after an independent review (Codex) reproduced 5 real
 * defects in the first version against real git repos — see the commit this
 * file is part of for the full report. Every defect is a design property
 * fixed here, not a patched symptom:
 *
 *   1. Pre-staged/unstaged/untracked changes already in `--repo` could leak
 *      into the publish commit. FIX: this script never touches `--repo`'s
 *      own working tree or index at all. It reads commits (diff/ls-tree/
 *      cat-file — pure object-database reads) and writes new commits
 *      through an ISOLATED temporary index (GIT_INDEX_FILE) that starts
 *      empty and is seeded only from the base branch's own tree — the
 *      caller's real index/working tree is invisible to it.
 *   2. Replaying an older content commit against a base that had already
 *      moved forward (via a newer content commit) silently rolled the
 *      published price back. FIX: every base branch commit this script
 *      makes records the content SHA it applied, in the commit message; a
 *      new run reads the LAST applied SHA off the base branch's own history
 *      and requires the new content SHA to be a proper git descendant of it
 *      (an ancestor => stale, reject; neither ancestor nor descendant =>
 *      diverged, reject as a conflict; equal => already applied, no-op).
 *   3. `${{ inputs.content_sha }}` was interpolated directly into workflow
 *      `run:` shell text, and a shell string was built by hand for
 *      `git archive | tar`. FIX (workflow): the input is only ever read via
 *      `env:` + `$CONTENT_SHA`, per GitHub's own hardening guidance — see
 *      .github/workflows-proposed/content-guard.yml. FIX (here): every SHA
 *      this script accepts is validated as a full 40-hex commit object
 *      before use; `git archive`/`tar` run as argv arrays with no shell.
 *   4. Same isolation as #1.
 *   5. The old race guard only checked "has base moved since I started" —
 *      not whether the content SHA I'm applying is even sequence-valid
 *      relative to what's already published (that's #2). The mechanical
 *      "base moved" case is now closed atomically: the local ref update is
 *      a `git update-ref <base> <new> <old>` compare-and-swap (not a
 *      read-then-write with a gap), and the remote push is a plain
 *      fast-forward-only push (never `--force`/`--force-with-lease`) whose
 *      parent is exactly the base SHA this run started from, so git itself
 *      refuses it the moment the remote has moved.
 *   6. A content commit that only deletes a media file was applied without
 *      checking whether the FINAL resulting base tree still had every photo
 *      the FINAL published.json on base references — deleting a photo that
 *      base had started referencing (via a separate, unrelated commit)
 *      produced a broken result. FIX: after composing the new tree in the
 *      isolated index, this script extracts published.json + review-
 *      state.json + every media file from THAT COMPOSED TREE (not from the
 *      content commit in isolation) and re-runs content-guard against it.
 *      A failure here aborts with no commit made at all.
 *   7. `git commit-tree` needs an author/committer identity; a runner with
 *      no configured git identity previously failed outright. FIX: identity
 *      is passed explicitly via GIT_AUTHOR_NAME/EMAIL and
 *      GIT_COMMITTER_NAME/EMAIL env vars on the commit-tree call itself —
 *      never relies on global/repo git config, and works even with
 *      `user.useConfigOnly=true` set.
 *
 * Usage:
 *   node --import tsx scripts/publish-content.ts \
 *     --repo <path>        # default: cwd. Working tree/index NEVER touched.
 *     --base <branch>      # default: --repo's current branch name
 *     --content <full-40-hex-sha>
 *     [--remote <name>]    # if given, pushes (plain, never --force) after
 *
 * Exit codes:
 *   0  success — a commit was made, or nothing needed publishing (including
 *      an exact replay of the already-applied content SHA)
 *   1  usage/input error (bad args, malformed SHA, content SHA not a
 *      locally-known commit object, base branch doesn't resolve)
 *   2  the content commit touched files outside the allowlist
 *   3  a required file (published.json) is missing/unreadable at the
 *      content commit
 *   4  content-guard rejected the content commit's OWN snapshot/media
 *   5  the base branch moved (locally or on the remote) since this run
 *      started — never silently overwritten, never force-pushed
 *   6  the content SHA is older than (an ancestor of) what's already
 *      applied to base — refusing to roll a newer publish back
 *   7  the content SHA has diverged from what's already applied to base
 *      (neither an ancestor nor a descendant) — a real conflict
 *   8  the FINAL composed base tree failed content-guard (e.g. it would
 *      reference a media file this run just removed) — no commit made
 *   9  a managed path (published.json/review-state.json/a media file this
 *      run touches) has independently diverged on base since the last
 *      guarded publish — refusing to silently overwrite that change
 *
 * Three more defects fixed 2026-09-15 (a follow-up independent review):
 *  A. This script never touches --repo's real working tree/index while
 *     composing the commit (still true) — but it used to leave the real
 *     checkout's INDEX stale relative to the NEW `base` ref it had just
 *     advanced, on a checkout that was otherwise perfectly clean. Git
 *     status then showed the old content as a pending staged rollback —
 *     harmless until literally anything else committed in that checkout
 *     (e.g. `git add -A && git commit` for an unrelated reason), which
 *     would silently carry that stale rollback into ITS OWN commit and
 *     revert the just-published change. Fixed: after a successful publish,
 *     if the checkout is actually ON `base`, the specific touched paths
 *     (never a blanket add) are synced into the real working tree/index —
 *     but ONLY the ones that were clean before this run started; a path
 *     with a genuine pre-existing user edit is still left completely
 *     alone, preserving defect #1/#4's guarantee for real dirty state.
 *  B. A content SHA could be a perfectly valid forward publish while a
 *     managed path had ALSO been changed independently and directly on
 *     `base` since the last guarded publish (e.g. a manual hotfix commit)
 *     — the isolated index blindly overwrote it with the new candidate's
 *     value, silently discarding the independent change. Fixed: before
 *     applying, each touched path's blob on `base` right now is compared
 *     to what it was at the last-applied SHA; a mismatch means something
 *     else changed it independently — reject (code 9) rather than choose
 *     a side automatically.
 *  C. A push that failed (network blip, server-side rejection) still left
 *     a LOCAL commit + advanced local ref behind. A retry with the SAME
 *     content SHA read its own leftover local commit as "already applied"
 *     (sequencing) and reported success without ever attempting the push
 *     again — while the remote genuinely still had nothing. Fixed: when
 *     `--remote` is given, this script first reads the remote's OWN
 *     current truth (`git ls-remote`) and, if local is ahead of it by
 *     nothing but this script's own previously-unpushed guarded commits
 *     (identified by their own commit-message marker — never touches a
 *     divergence caused by anything/anyone else, which still hits the
 *     existing hard-refusal path), rolls the local ref back to match the
 *     remote before proceeding, so sequencing and diffing are always
 *     grounded in what's actually published, not a stale local artifact.
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
// Two DIFFERENT boundaries, deliberately kept separate (Б4 Block A,
// 2026-09-15 — the panel's real write path interleaves commits this
// script must tolerate seeing without ever transferring them):
//
//   EDITING_SOURCE_ALLOWLIST — what's safe for the content branch's history
//   to contain at all, without refusing the whole publish. A real panel
//   session commits to THIS branch on every Keystatic save (one commit per
//   working-copy file, e.g. `src/content/cms/cars/<slug>.json`) and on
//   every "Позначити перевіреним" (review-state.json) — entirely separate
//   commits from `publishItem`'s own published.json/media writes (verified
//   directly against panelStore.ts: confirmLocale/publishItem never share
//   a commit). Treating any of that as "the content branch touched a
//   disallowed file" would make a real, correctly-used branch unpublishable
//   the moment more than one edit had ever happened on it.
//
//   The actual TRANSFER stays exactly as narrow as before — see toUpsert/
//   toRemove below, which only ever consider PUBLISHED_PATH, REVIEW_PATH,
//   and content-guard's own approved media manifest. A working-copy file
//   under `src/content/cms/<other-collection>/*.json` is now ALLOWED to
//   exist in the diff (so it doesn't block the publish) but is still NEVER
//   eligible to be committed to base — it simply isn't in that filter.
//   Anything outside src/content/cms/** or public/images/cms/** entirely
//   (any `.ts`/`.js`/`.yml`/`package.json`/etc.) is unaffected: still
//   rejected outright, exactly as before.
const EDITING_SOURCE_ALLOWLIST = /^(src\/content\/cms\/.+|public\/images\/cms\/.+)$/;
const PUBLISHED_PATH = "src/content/cms/published.json";
const REVIEW_PATH = "src/content/cms/review-state.json";
const FULL_SHA_RE = /^[0-9a-f]{40}$/;
const COMMIT_IDENTITY = {
  GIT_AUTHOR_NAME: "content-guard",
  GIT_AUTHOR_EMAIL: "content-guard@users.noreply.github.com",
  GIT_COMMITTER_NAME: "content-guard",
  GIT_COMMITTER_EMAIL: "content-guard@users.noreply.github.com",
};

class PublishError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

function git(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): string {
  return execFileSync("git", args, {
    cwd: opts.cwd ?? REPO,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
    encoding: "utf8",
  }).trim();
}

function gitOrNull(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): string | null {
  try {
    return git(args, opts);
  } catch {
    return null;
  }
}

function assertFullSha(sha: string | undefined, label: string): asserts sha is string {
  if (!sha || !FULL_SHA_RE.test(sha)) {
    throw new PublishError(1, `${label} must be a full 40-character hex commit SHA, got: ${JSON.stringify(sha)}`);
  }
}

/** Confirms `sha` is a commit object this repo already has (post-fetch). */
function assertIsFetchedCommit(sha: string): void {
  const type = gitOrNull(["cat-file", "-t", sha]);
  if (type !== "commit") {
    throw new PublishError(
      1,
      `content SHA ${sha} is not a fetched commit object in this repo (git cat-file -t returned ${JSON.stringify(type)})`,
    );
  }
}

interface ChangedFiles {
  upserted: string[]; // present (new/changed) at the content commit
  removed: string[]; // absent at the content commit, present at the diff base ("from")
}

/**
 * `from` must be the LAST content SHA actually applied to `base` (Б4 Block
 * B, 2026-09-15), not `merge-base(base, content)` — a real content branch
 * accumulates many publishes over its life, and a file that was added by
 * an EARLIER already-applied publish and removed by THIS one nets to "no
 * change" when diffed against a merge-base from before either of those —
 * so the removal would silently never reach base (found by a realistic
 * multi-publish-cycle test: publish A with a photo, publish B with a
 * different photo, delete A's now-orphaned photo — that deletion diffed
 * clean against the old merge-base and the stale photo never left base).
 * `from` falls back to a real `merge-base(base, content)` only for the
 * first-ever publish to a given base (no prior applied SHA to diff since).
 */
function changedFiles(from: string, content: string): ChangedFiles {
  const raw = git(["diff", "--name-status", "--no-renames", from, content]);
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
  const bad = [...changed.upserted, ...changed.removed].filter((f) => !EDITING_SOURCE_ALLOWLIST.test(f));
  if (bad.length > 0) {
    throw new PublishError(
      2,
      `content branch touched files outside the allowlist:\n${bad.map((f) => `  ${f}`).join("\n")}`,
    );
  }
}

/**
 * The content SHA this script last successfully applied to `base`, read
 * straight from base's own commit history — never a separate state file
 * that could itself drift out of sync with what's actually on the branch.
 */
function lastAppliedContentSha(base: string): string | null {
  const line = gitOrNull(["log", base, "--fixed-strings", "--grep=(guarded ", "--format=%s", "-n", "1"]);
  if (!line) return null;
  const m = line.match(/\(guarded ([0-9a-f]{40})\)/);
  return m ? m[1] : null;
}

function isAncestor(maybeAncestor: string, of: string): boolean {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", maybeAncestor, of], { cwd: REPO });
    return true;
  } catch {
    return false;
  }
}

/**
 * A previous run of this exact script may have committed locally and then
 * failed to push (network blip, server-side rejection). Left alone, that
 * leftover local commit would make a retry's own sequencing check
 * (`lastAppliedContentSha`) see the content as "already applied" and report
 * success without ever re-attempting the push. Reconciles narrowly: only
 * when local is a pure fast-forward ahead of the remote's own truth, and
 * every commit in that gap is one of THIS script's own guarded-publish
 * commits (its distinctive `(guarded <sha>)` message marker) — never when
 * the remote has moved independently (a real divergence there is left for
 * the existing hard-refusal push-rejection path, unchanged).
 */
function reconcileWithRemoteTruth(base: string, baseRef: string, remote: string): void {
  const remoteHeadLine = gitOrNull(["ls-remote", remote, base]);
  const remoteHead = remoteHeadLine ? remoteHeadLine.split("\t")[0]?.trim() : null;
  if (!remoteHead) return; // remote has no such branch yet — nothing to reconcile against
  const localHead = git(["rev-parse", baseRef]);
  if (remoteHead === localHead) return; // already in sync
  git(["fetch", remote, remoteHead]); // ensure the object is present before any ancestry check
  if (!isAncestor(remoteHead, localHead)) return; // remote diverged/moved independently — leave for the normal path
  const onlyOurs = git(["log", `${remoteHead}..${localHead}`, "--format=%s"])
    .split("\n")
    .filter(Boolean)
    .every((subject) => /\(guarded [0-9a-f]{40}\)$/.test(subject));
  if (!onlyOurs) return; // something else also committed locally in that gap — don't discard it silently
  git(["update-ref", baseRef, remoteHead]);
}

/**
 * Enforces publish ordering against base's own history. Returns the last-
 * applied SHA (null if this is the first-ever guarded publish to `base`)
 * plus a verdict: "noop" when the requested content SHA was already the
 * last one applied (idempotent re-run — not an error), "apply" otherwise.
 * The returned `last` is also the correct diff base for `changedFiles` —
 * see its own doc comment for why this must not be `merge-base(base,
 * content)` instead.
 */
function checkSequencing(base: string, content: string): { last: string | null; verdict: "noop" | "apply" } {
  const last = lastAppliedContentSha(base);
  if (last === null) return { last, verdict: "apply" }; // first-ever guarded publish to this base
  if (last === content) return { last, verdict: "noop" };
  if (isAncestor(content, last)) {
    throw new PublishError(
      6,
      `content ${content} is older than (an ancestor of) the last applied ${last} — refusing to roll a newer publish back`,
    );
  }
  if (!isAncestor(last, content)) {
    throw new PublishError(
      7,
      `content ${content} has diverged from the last applied ${last} (neither is an ancestor of the other) — conflict, needs reconciliation, not an automatic merge`,
    );
  }
  return { last, verdict: "apply" };
}

/** mode + blob SHA for one path in a tree-ish, from `git ls-tree`. */
function lsTreeEntry(treeish: string, filePath: string): { mode: string; sha: string } | null {
  const line = gitOrNull(["ls-tree", treeish, "--", filePath]);
  if (!line) return null;
  const m = line.match(/^(\d+) blob ([0-9a-f]{40})\t/);
  return m ? { mode: m[1], sha: m[2] } : null;
}

/** The blob SHA a path resolves to in a tree-ish, or null if absent there. */
function blobAt(treeish: string, filePath: string): string | null {
  return lsTreeEntry(treeish, filePath)?.sha ?? null;
}

/** Does this tree-ish have anything at all under `dirPath`? Read-only. */
function treeHasDir(treeish: string, dirPath: string): boolean {
  return gitOrNull(["ls-tree", "-d", treeish, "--", dirPath]) !== null && !!gitOrNull(["ls-tree", treeish, dirPath]);
}

/**
 * Extracts published.json + review-state.json + the full media tree from a
 * tree-ish (a real commit OR a composed-but-uncommitted tree object — both
 * work identically for `git cat-file`/`git archive`) into a fresh temp dir,
 * for content-guard.ts to validate. A genuinely empty/absent media
 * directory is fine (nothing has ever been published yet); anything else
 * that goes wrong while a media directory DOES exist is a real failure and
 * is never treated as "no media, fine".
 */
async function extractGuardInputs(
  treeish: string,
): Promise<{ publishedPath: string; reviewPath: string; mediaRoot: string }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-content-"));

  const published = gitOrNull(["cat-file", "-p", `${treeish}:${PUBLISHED_PATH}`]);
  if (published === null) {
    throw new PublishError(
      3,
      `required file missing/unreadable at ${treeish}: ${PUBLISHED_PATH} — refusing to publish (never substituting empty content)`,
    );
  }
  const publishedPath = path.join(tmpDir, "published.json");
  await fs.writeFile(publishedPath, published, "utf8");

  // review-state.json is allowed to be genuinely absent (content-guard.ts's
  // own default already tolerates that) — but if it exists, use it as-is.
  const review = gitOrNull(["cat-file", "-p", `${treeish}:${REVIEW_PATH}`]) ?? "{}";
  const reviewPath = path.join(tmpDir, "review.json");
  await fs.writeFile(reviewPath, review, "utf8");

  const mediaRoot = path.join(tmpDir, "media");
  await fs.mkdir(mediaRoot, { recursive: true });

  if (treeHasDir(treeish, "public/images/cms")) {
    // No shell string-building: `git archive -o` writes a real file, `tar`
    // reads a real file — both invoked as argv arrays, so nothing in
    // `treeish` (already validated as a 40-hex SHA before this point) or
    // any path can be interpreted as shell syntax.
    const tarPath = path.join(tmpDir, "media.tar");
    // `-o <path>` must come BEFORE the `--` pathspec separator — after it,
    // git treats "-o" and the path as pathspecs instead of the output flag
    // (a real bug caught only by running this against a genuinely separate
    // temp directory, not the project's own `public/`).
    git(["archive", treeish, "-o", tarPath, "--", "public/images/cms"]);
    execFileSync("tar", ["-x", "-C", mediaRoot, "--strip-components=1", "-f", tarPath]);
  }
  // else: no public/images/cms directory in this tree at all yet — a real,
  // legitimate empty state, not an error we had to catch and hope was this.

  return { publishedPath, reviewPath, mediaRoot };
}

function runContentGuard(
  inputs: { publishedPath: string; reviewPath: string; mediaRoot: string },
  manifestOut: string,
  rejectionCode: number,
  contextLabel: string,
): void {
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
        manifestOut,
      ],
      { cwd: PROJECT_ROOT, stdio: "pipe", encoding: "utf8" },
    );
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    throw new PublishError(
      rejectionCode,
      `content-guard rejected ${contextLabel}:\n${e.stdout ?? ""}${e.stderr ?? ""}`,
    );
  }
}

async function readManifest(manifestOut: string): Promise<Set<string>> {
  const text = await fs.readFile(manifestOut, "utf8").catch(() => "");
  return new Set(
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
}

async function main() {
  assertFullSha(CONTENT_SHA, "--content");
  assertIsFetchedCommit(CONTENT_SHA);

  const base = arg("base") ?? git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (base === "HEAD" || !base) {
    throw new PublishError(1, "no usable base branch name — pass --base explicitly, or check out a real branch");
  }
  const baseRef = `refs/heads/${base}`;
  if (REMOTE) reconcileWithRemoteTruth(base, baseRef, REMOTE);
  const baseShaAtStart = git(["rev-parse", baseRef]);

  // Captured BEFORE anything below touches any git state, so it reflects
  // genuine pre-existing caller state — used at the very end to decide
  // which touched paths are safe to sync into the real checkout. Uses a
  // RAW (non-trimmed) call deliberately: `git()`'s own `.trim()` strips
  // the leading space `git status --porcelain` puts on an unstaged-only
  // entry (" M path") from the very first line of the whole output,
  // silently shifting that one path's slice(3) parse by one character —
  // a real bug caught only because it corrupted the FIRST status line
  // specifically, not later ones (each preceded by its own "\n").
  const checkoutBranch = gitOrNull(["symbolic-ref", "-q", "--short", "HEAD"]);
  const statusPorcelainRaw = (() => {
    try {
      return execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" });
    } catch {
      return "";
    }
  })();
  const dirtyAtStart = new Set(
    statusPorcelainRaw
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3)),
  );

  const seq = checkSequencing(base, CONTENT_SHA);
  if (seq.verdict === "noop") {
    console.log(`nothing to publish (content ${CONTENT_SHA} was already the last one applied to ${base})`);
    return;
  }
  const diffFrom = seq.last ?? git(["merge-base", base, CONTENT_SHA]);

  const changed = changedFiles(diffFrom, CONTENT_SHA);
  if (changed.upserted.length === 0 && changed.removed.length === 0) {
    console.log("nothing to publish (content commit introduces no change vs base)");
    return;
  }
  assertAllowlisted(changed);

  // Pass 1: validate the content commit's OWN snapshot in isolation, and
  // learn exactly which media files it legitimately references (the
  // manifest) — an orphan file the content branch happens to carry outside
  // any real item's reference is never eligible for upsert below.
  const contentInputs = await extractGuardInputs(CONTENT_SHA);
  const contentManifestOut = path.join(path.dirname(contentInputs.publishedPath), "manifest.txt");
  runContentGuard(contentInputs, contentManifestOut, 4, "the content commit's own snapshot/media");
  const contentManifest = await readManifest(contentManifestOut);

  const toUpsert = changed.upserted.filter(
    (f) => f === PUBLISHED_PATH || f === REVIEW_PATH || contentManifest.has(f),
  );
  const toRemove = changed.removed.filter((f) => f.startsWith("public/images/cms/"));

  // A content SHA can be a perfectly valid forward publish while `base`
  // ITSELF has independently changed one of these same managed paths since
  // the last guarded publish (e.g. a manual hotfix commit directly on
  // main). Blindly applying the new candidate would silently discard that
  // independent change. For every path this run is about to touch, its
  // current blob on base must still match what it was at `diffFrom` — a
  // mismatch means something else changed it independently in between.
  for (const f of [...toUpsert, ...toRemove]) {
    const baseNow = blobAt(baseShaAtStart, f);
    const baseAtDiffFrom = blobAt(diffFrom, f);
    if (baseNow !== baseAtDiffFrom) {
      throw new PublishError(
        9,
        `base's current "${f}" has diverged independently since the last guarded publish ` +
          `(was ${baseAtDiffFrom ?? "absent"} at ${diffFrom}, base now has ${baseNow ?? "absent"}) — ` +
          `refusing to overwrite an independent change; reconcile manually`,
      );
    }
  }

  // ── Isolated index: never the real --repo working tree or index ────────
  const indexDir = await fs.mkdtemp(path.join(os.tmpdir(), "publish-index-"));
  const GIT_INDEX_FILE = path.join(indexDir, "index");
  const idxEnv = { GIT_INDEX_FILE };
  git(["read-tree", baseShaAtStart], { env: idxEnv });
  for (const f of toUpsert) {
    const entry = lsTreeEntry(CONTENT_SHA, f);
    if (!entry) {
      // Listed as changed by the diff but unreadable via ls-tree — treat
      // exactly like any other missing-required-data case, never silently
      // skipped.
      throw new PublishError(3, `content SHA ${CONTENT_SHA} changed ${f} but it is not readable via git ls-tree`);
    }
    git(["update-index", "--add", "--cacheinfo", `${entry.mode},${entry.sha},${f}`], { env: idxEnv });
  }
  for (const f of toRemove) {
    git(["update-index", "--force-remove", "--", f], { env: idxEnv });
  }
  const newTreeSha = git(["write-tree"], { env: idxEnv });
  const baseTreeSha = git(["rev-parse", `${baseShaAtStart}^{tree}`]);
  if (newTreeSha === baseTreeSha) {
    console.log("nothing to publish (target already matches content)");
    return;
  }

  // Pass 2: the FINAL, fully-composed result — the tree this run is about
  // to commit — must itself still be internally consistent. This is what
  // catches a media file removal that base's OWN published.json (changed
  // by a different, unrelated commit since content's merge-base) still
  // references: the content commit alone looked fine in isolation, but the
  // composed result would not be.
  const finalInputs = await extractGuardInputs(newTreeSha);
  const finalManifestOut = path.join(path.dirname(finalInputs.publishedPath), "manifest.txt");
  runContentGuard(finalInputs, finalManifestOut, 8, "the final composed result (published.json + all referenced media together)");

  const commitSha = git(
    [
      "commit-tree",
      newTreeSha,
      "-p",
      baseShaAtStart,
      "-m",
      `content: publish ${new Date().toISOString()} (guarded ${CONTENT_SHA})`,
    ],
    { env: COMMIT_IDENTITY },
  );

  // Local ref update is an atomic compare-and-swap: if `base` moved since
  // baseShaAtStart was captured (by any other process touching this same
  // repo), this fails outright — no read-then-write gap to race into.
  try {
    git(["update-ref", baseRef, commitSha, baseShaAtStart]);
  } catch (err) {
    const e = err as { stderr?: string };
    throw new PublishError(5, `base branch moved locally during processing — aborting, not overwriting: ${e.stderr ?? ""}`);
  }
  console.log(`published ${commitSha} on ${base} (guarded ${CONTENT_SHA})`);

  if (REMOTE) {
    // Plain push — no force flag of any kind. Its parent is exactly
    // baseShaAtStart, so this is only a fast-forward (and therefore only
    // succeeds) if the remote is still at baseShaAtStart; otherwise git
    // itself refuses it and nothing is overwritten.
    try {
      git(["push", REMOTE, `${commitSha}:refs/heads/${base}`]);
    } catch (err) {
      const e = err as { stderr?: string };
      throw new PublishError(
        5,
        `push to "${REMOTE}" refused (base moved on the remote during processing) — commit kept locally, NOT force-pushed: ${e.stderr ?? ""}`,
      );
    }
  }

  // If this checkout is actually ON `base`, sync the specific touched paths
  // into the REAL working tree/index too — otherwise the index still holds
  // the pre-publish blob while HEAD (a symref to base) now resolves to the
  // new commit, which `git status` shows as a pending staged rollback of
  // exactly what was just published. Left alone, the next unrelated commit
  // anyone makes in this checkout (`git add -A && git commit`, e.g.) would
  // silently carry that stale rollback along and revert the publish. Only
  // paths that were genuinely clean before this run started are touched —
  // a path with a real pre-existing user edit is left exactly as it was,
  // same guarantee as the isolated-index design already gives it.
  if (checkoutBranch === base) {
    // Best-effort hygiene, not the operation's own success/failure: the
    // actual publish (commit + ref update + optional push) already fully
    // succeeded above. `-f` on the removal is safe specifically because
    // dirtyAtStart already proved this exact path had no real pending
    // change of the caller's own — without it, plain `git rm` refuses
    // ("has changes staged in the index"), because HEAD (a symref to
    // `base`) has already moved past this path's removal while the real
    // index still holds its pre-publish entry — the same underlying
    // ref/checkout-desync artifact this whole sync step exists to clear.
    try {
      for (const f of toUpsert) {
        if (dirtyAtStart.has(f)) continue;
        git(["checkout", commitSha, "--", f]);
      }
      for (const f of toRemove) {
        if (dirtyAtStart.has(f)) continue;
        git(["rm", "--ignore-unmatch", "--quiet", "-f", "--", f]);
      }
    } catch (err) {
      const e = err as { message?: string };
      console.error(`WARNING: publish succeeded, but syncing the local checkout afterward failed: ${e.message ?? err}`);
    }
  }
}

main().catch((err) => {
  if (err instanceof PublishError) {
    console.error(`REJECTED (${err.code}): ${err.message}`);
    process.exit(err.code);
  }
  console.error(err);
  process.exit(1);
});
