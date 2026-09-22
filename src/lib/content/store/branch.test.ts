import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveContentBranch, UNDEFINED_BRANCH_REASON } from "./branch";

test("PANEL_CONTENT_BRANCH is used when set", () => {
  assert.deepEqual(resolveContentBranch({ PANEL_CONTENT_BRANCH: "codex/admin-panel-spike" }), {
    branch: "codex/admin-panel-spike",
  });
});

test("falls back to VERCEL_GIT_COMMIT_REF (the deploy branch) when PANEL_CONTENT_BRANCH is absent", () => {
  assert.deepEqual(resolveContentBranch({ VERCEL_GIT_COMMIT_REF: "codex/admin-panel-spike" }), {
    branch: "codex/admin-panel-spike",
  });
});

test("PANEL_CONTENT_BRANCH wins over VERCEL_GIT_COMMIT_REF", () => {
  assert.deepEqual(
    resolveContentBranch({
      PANEL_CONTENT_BRANCH: "panel/content",
      VERCEL_GIT_COMMIT_REF: "some-preview",
    }),
    { branch: "panel/content" },
  );
});

test("with NEITHER variable set: NOT a silent 'main' — returns branch:null with a fix-it reason", () => {
  const r = resolveContentBranch({});
  assert.equal(r.branch, null);
  assert.equal("reason" in r && r.reason, UNDEFINED_BRANCH_REASON);
  assert.match("reason" in r ? r.reason : "", /PANEL_CONTENT_BRANCH/);
  assert.match("reason" in r ? r.reason : "", /не пише в main/);
});

test("blank / whitespace-only values are treated as unset", () => {
  assert.equal(resolveContentBranch({ PANEL_CONTENT_BRANCH: "   " }).branch, null);
  assert.equal(
    resolveContentBranch({ PANEL_CONTENT_BRANCH: "  ", VERCEL_GIT_COMMIT_REF: "real" }).branch,
    "real",
  );
});
