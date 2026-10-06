import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAIN_BRANCH_REASON,
  PRODUCTION_BRANCH_REASON,
  PRODUCTION_CONTENT_BRANCH,
  resolveContentBranch,
  UNDEFINED_BRANCH_REASON,
} from "./branch";

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

test("main is never a content branch — not even when set explicitly", () => {
  for (const env of [
    { PANEL_CONTENT_BRANCH: "main" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { PANEL_CONTENT_BRANCH: " main ", VERCEL_ENV: "preview" },
  ]) {
    const r = resolveContentBranch(env);
    assert.equal(r.branch, null, JSON.stringify(env));
    assert.equal("reason" in r && r.reason, MAIN_BRANCH_REASON);
  }
});

test("Production built from main without PANEL_CONTENT_BRANCH fails safely, never main", () => {
  const r = resolveContentBranch({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" });
  assert.equal(r.branch, null);
});

test("Production accepts only panel/content", () => {
  assert.deepEqual(
    resolveContentBranch({
      VERCEL_ENV: "production",
      PANEL_CONTENT_BRANCH: "panel/content",
      VERCEL_GIT_COMMIT_REF: "main",
    }),
    { branch: PRODUCTION_CONTENT_BRANCH },
  );
  const other = resolveContentBranch({ VERCEL_ENV: "production", PANEL_CONTENT_BRANCH: "codex/x" });
  assert.equal(other.branch, null);
  assert.equal("reason" in other && other.reason, PRODUCTION_BRANCH_REASON);
});

test("Preview and local GitHub mode keep any other non-main branch", () => {
  assert.deepEqual(
    resolveContentBranch({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "codex/keystatic-entry-guard" }),
    { branch: "codex/keystatic-entry-guard" },
  );
  assert.deepEqual(resolveContentBranch({ PANEL_CONTENT_BRANCH: "panel/content" }), {
    branch: "panel/content",
  });
});

test("every reason is a Ukrainian fix-it hint without stale branch names or secrets", () => {
  for (const reason of [UNDEFINED_BRANCH_REASON, MAIN_BRANCH_REASON, PRODUCTION_BRANCH_REASON]) {
    assert.match(reason, /PANEL_CONTENT_BRANCH/);
    assert.match(reason, /гілк/);
    assert.doesNotMatch(reason, /admin-panel-spike|TOKEN|SECRET/);
  }
});
