import { test } from "node:test";
import assert from "node:assert/strict";
import { keystaticEntryRedirect, PANEL_FALLBACK_PATH } from "./keystaticEntry";

const GITHUB = { NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND: "github" };
const PRODUCTION = {
  ...GITHUB,
  VERCEL_ENV: "production",
  PANEL_CONTENT_BRANCH: "panel/content",
  VERCEL_GIT_COMMIT_REF: "main",
};
const PREVIEW = { ...GITHUB, VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "codex/keystatic-entry-guard" };
const LOCAL_GITHUB = { ...GITHUB, PANEL_CONTENT_BRANCH: "panel/content" };
const MISCONFIGURED = { ...GITHUB, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };
const PANEL_ROOT = "/keystatic/branch/panel%2Fcontent";
const PREVIEW_ROOT = "/keystatic/branch/codex%2Fkeystatic-entry-guard";

test("local storage mode never redirects", () => {
  for (const path of ["/keystatic", "/keystatic/", "/keystatic/branch/main", "/keystatic/collection/cars"]) {
    assert.equal(keystaticEntryRedirect(path, {}), null, path);
    assert.equal(
      keystaticEntryRedirect(path, {
        NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND: "local",
        PANEL_CONTENT_BRANCH: "panel/content",
      }),
      null,
      path,
    );
  }
});

test("Production: the root and the bare branch route go to panel/content", () => {
  for (const path of ["/keystatic", "/keystatic/", "/keystatic/branch", "/keystatic/branch/"]) {
    assert.equal(keystaticEntryRedirect(path, PRODUCTION), PANEL_ROOT, path);
  }
});

test("Production: main and any other branch go to the panel/content root, dropping the rest", () => {
  for (const path of [
    "/keystatic/branch/main",
    "/keystatic/branch/main/collection/cars/item/volvo-xc60-d5",
    "/keystatic/branch/other",
    "/keystatic/branch/panel",
    "/keystatic/branch/panel%2Fother",
    "/keystatic/branch/panel/other/collection/cars",
  ]) {
    assert.equal(keystaticEntryRedirect(path, PRODUCTION), PANEL_ROOT, path);
  }
});

test("Production: panel/content passes through, with its slash encoded or split", () => {
  for (const path of [
    PANEL_ROOT,
    "/keystatic/branch/panel%2fcontent",
    "/keystatic/branch/panel%2Fcontent/collection/cars/item/volvo-xc60-d5",
    "/keystatic/branch/panel/content",
    "/keystatic/branch/panel/content/singleton/siteContact",
  ]) {
    assert.equal(keystaticEntryRedirect(path, PRODUCTION), null, path);
  }
});

test("a malformed escape does not throw and counts as a foreign branch", () => {
  assert.equal(keystaticEntryRedirect("/keystatic/branch/%E0%A4%A", PRODUCTION), PANEL_ROOT);
  assert.equal(keystaticEntryRedirect("/keystatic/branch/panel/%E0%A4%A", PRODUCTION), PANEL_ROOT);
});

test("Keystatic's own pages and unrelated paths are left alone, even when misconfigured", () => {
  for (const env of [PRODUCTION, MISCONFIGURED]) {
    for (const path of [
      "/keystatic/setup",
      "/keystatic/repo-not-found",
      "/keystatic/created-github-app",
      "/keystatic/collection/cars",
      "/keystaticx",
      "/panel",
    ]) {
      assert.equal(keystaticEntryRedirect(path, env), null, path);
    }
  }
});

test("no usable content branch sends every entry to /panel, never to main", () => {
  for (const path of ["/keystatic", "/keystatic/branch/main", PANEL_ROOT]) {
    assert.equal(keystaticEntryRedirect(path, MISCONFIGURED), PANEL_FALLBACK_PATH, path);
  }
  const wrongProductionBranch = { ...GITHUB, VERCEL_ENV: "production", PANEL_CONTENT_BRANCH: "codex/x" };
  assert.equal(keystaticEntryRedirect("/keystatic", wrongProductionBranch), PANEL_FALLBACK_PATH);
  assert.equal(keystaticEntryRedirect("/keystatic", GITHUB), PANEL_FALLBACK_PATH);
  assert.equal(
    keystaticEntryRedirect("/keystatic", { ...GITHUB, PANEL_CONTENT_BRANCH: "main" }),
    PANEL_FALLBACK_PATH,
  );
});

test("Preview keeps its own branch; local GitHub mode uses PANEL_CONTENT_BRANCH", () => {
  assert.equal(keystaticEntryRedirect("/keystatic", PREVIEW), PREVIEW_ROOT);
  assert.equal(keystaticEntryRedirect(PREVIEW_ROOT, PREVIEW), null);
  assert.equal(keystaticEntryRedirect("/keystatic/branch/codex/keystatic-entry-guard", PREVIEW), null);
  assert.equal(keystaticEntryRedirect(PANEL_ROOT, PREVIEW), PREVIEW_ROOT);
  assert.equal(keystaticEntryRedirect("/keystatic", LOCAL_GITHUB), PANEL_ROOT);
  assert.equal(keystaticEntryRedirect(PANEL_ROOT, LOCAL_GITHUB), null);
});

test("redirects never loop and never target main", () => {
  const paths = [
    "/keystatic",
    "/keystatic/",
    "/keystatic/branch",
    "/keystatic/branch/main",
    "/keystatic/branch/other",
    PANEL_ROOT,
    "/keystatic/branch/panel/content",
    "/keystatic/branch/%E0%A4%A",
  ];
  for (const env of [PRODUCTION, PREVIEW, LOCAL_GITHUB, MISCONFIGURED, GITHUB]) {
    for (const path of paths) {
      const target = keystaticEntryRedirect(path, env);
      if (target === null) continue;
      assert.doesNotMatch(target, /branch\/main(\/|$)/, `${path} → ${target}`);
      assert.equal(keystaticEntryRedirect(target, env), null, `loop: ${path} → ${target}`);
      // A server that decodes %2F before the proxy sees the split form — still no loop.
      assert.equal(
        keystaticEntryRedirect(decodeURIComponent(target), env),
        null,
        `loop (decoded): ${path} → ${target}`,
      );
    }
  }
});
