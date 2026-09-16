import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * `route.ts` (via `@/lib/content/store`) statically imports `server-only`
 * and `next/headers` — neither runs under `node:test`. Mocked before the
 * first import of `./route`, same pattern as `siteContent.test.ts`, so this
 * exercises the REAL POST handler rather than a re-implemented copy of it.
 */
mock.module("server-only", { namedExports: {} });
mock.module("next/headers", { namedExports: { cookies: async () => new Map() } });

// requireSession() calls getStorage(), which — without
// NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND=github — returns a LocalFsStorage with
// no auth needed. PANEL_CONTENT_ROOT (dev/test-only, read by getStorage())
// points it at a throwaway temp dir so this never touches the real repo.
let tmpRoot: string;
let originalBlobToken: string | undefined;
let originalStorageKind: string | undefined;
let originalPanelRoot: string | undefined;

beforeEach(async () => {
  originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  originalStorageKind = process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND;
  originalPanelRoot = process.env.PANEL_CONTENT_ROOT;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND;
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "panel-video-route-test-"));
  process.env.PANEL_CONTENT_ROOT = tmpRoot;
});

afterEach(async () => {
  if (originalBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  if (originalStorageKind === undefined) delete process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND;
  else process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND = originalStorageKind;
  if (originalPanelRoot === undefined) delete process.env.PANEL_CONTENT_ROOT;
  else process.env.PANEL_CONTENT_ROOT = originalPanelRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

function blobTokenRequest(): Request {
  return new Request("http://localhost/api/panel/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "blob.generate-client-token", payload: {} }),
  });
}

test("POST blob.* without BLOB_READ_WRITE_TOKEN returns 501 notConfigured, never reaches @vercel/blob's handleUpload", async () => {
  const { POST } = await import("./route");
  const response = await POST(blobTokenRequest());
  const body = (await response.json()) as { ok: boolean; notConfigured?: boolean; message?: string };
  assert.equal(response.status, 501);
  assert.equal(body.ok, false);
  assert.equal(body.notConfigured, true);
  assert.ok(body.message && body.message.length > 0, "expected a non-empty message");
});
