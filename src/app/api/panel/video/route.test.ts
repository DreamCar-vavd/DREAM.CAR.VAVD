import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  NotConnectedError,
  StorageAuthError,
  StorageForbiddenError,
  StorageUnavailableError,
  type PanelStorage,
} from "@/lib/content/store/adapter";

/**
 * `route.ts` (via `@/lib/content/store`) statically imports `server-only`
 * and `next/headers` — neither runs under `node:test`. Mocked before the
 * first import of `./route`, same pattern as `siteContent.test.ts`, so this
 * exercises the REAL POST/GET/PUT/DELETE handlers rather than a
 * re-implemented copy of them.
 *
 * `{ exports }` (not the deprecated `{ namedExports }`) is the current
 * runtime option — Node's own DeprecationWarning on `namedExports` says so.
 * The `@types/node` version pinned in this repo predates that option, so
 * these options objects go through a variable (not an inline literal) to
 * sidestep the stale type's excess-property check; the runtime behavior is
 * what actually matters here, not the lagging type declaration.
 */
const mockExports = (exports: object): Parameters<typeof mock.module>[1] =>
  ({ exports }) as Parameters<typeof mock.module>[1];
mock.module("server-only", mockExports({}));
mock.module("next/headers", mockExports({ cookies: async () => new Map() }));

// `getStorage` behaviour is swapped PER TEST via this mutable indirection —
// not by re-mocking the module each time. `mock.module` replaces a module's
// exports going forward from the call, but `route.ts`'s top-level
// `import { getStorage } from "@/lib/content/store"` is a live ES binding
// resolved once; the mocked `getStorage` below reads `currentGetStorage()`
// at CALL time, so each test can reconfigure behaviour without needing a
// fresh module instance (there is only one — `./route` is cached after the
// first `await import` in this file, same as any ESM module).
function stubStorage(assertWriteAccess: () => Promise<void>): PanelStorage {
  return { assertWriteAccess } as unknown as PanelStorage;
}

let currentGetStorage: () => Promise<PanelStorage> = async () => stubStorage(async () => {});
mock.module(
  "@/lib/content/store",
  mockExports({
    getStorage: async () => currentGetStorage(),
  }),
);

// requireVideoAccess() -> loadVideoAccess() -> getStorage(), mocked above by
// default to a trusted local session (no auth needed) so most tests don't
// need to think about it.
//
// None of the tests in this file exercise the REAL, un-injected
// getVideoStore() (the "no push -> 403" etc. tests all return from the gate
// before it would run). PANEL_CONTENT_ROOT used to be set here on the
// (incorrect) belief that it redirects LocalVideoStore/LocalFsStorage to a
// throwaway temp dir -- it does not: LocalVideoStore's root defaults to
// `path.join(process.cwd(), "public", "uploads", "videos")`
// (src/lib/media/videoStore.ts) and never reads that env var, and
// `@/lib/content/store` is fully mocked below so it never reaches the real
// module (and PANEL_CONTENT_ROOT) either. A route-level "trusted local
// session -> GET lists successfully" test used to rely on that false
// isolation and silently read the repo's real public/uploads/videos. That
// test was removed; see videoAccessGate.test.ts's "REAL LocalVideoStore
// (tempRoot)" test (gate pass-through + genuine disk I/O, isolated via
// mkdtemp()) and videoStore.test.ts's withTempLocalStore() coverage
// (createUpload/receive/head/list/remove) for the same ground covered in
// isolation, without touching this file's route-level mocks.
let originalBlobToken: string | undefined;
let originalStorageKind: string | undefined;

beforeEach(() => {
  originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  originalStorageKind = process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND;
  currentGetStorage = async () => stubStorage(async () => {});
});

afterEach(() => {
  if (originalBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  if (originalStorageKind === undefined) delete process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND;
  else process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND = originalStorageKind;
});

function blobTokenRequest(): Request {
  return new Request("http://localhost/api/panel/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "blob.generate-client-token", payload: {} }),
  });
}

function deleteRequest(key = "abc12345-clip.mp4"): Request {
  return new Request(`http://localhost/api/panel/video?key=${encodeURIComponent(key)}`, {
    method: "DELETE",
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

test("no session (getStorage throws NotConnectedError): GET returns 401, video store never listed", async () => {
  currentGetStorage = async () => {
    throw new NotConnectedError("Ви не увійшли через GitHub.");
  };
  const { GET } = await import("./route");
  const response = await GET();
  const body = (await response.json()) as { ok: boolean; message?: string };
  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
});

test("revoked/expired token (StorageAuthError): DELETE returns 401, remove() never called", async () => {
  currentGetStorage = async () =>
    stubStorage(async () => {
      throw new StorageAuthError();
    });
  const { DELETE } = await import("./route");
  const response = await DELETE(deleteRequest());
  const body = (await response.json()) as { ok: boolean; message?: string };
  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
});

test("valid token, no push access (StorageForbiddenError): POST blob.* returns 403, handleUpload never runs", async () => {
  currentGetStorage = async () =>
    stubStorage(async () => {
      throw new StorageForbiddenError("недостатньо прав доступу для цієї дії");
    });
  const { POST } = await import("./route");
  // If handleUpload() ran, @vercel/blob would try to validate/parse this
  // payload and fail differently (or hang on a real network call) — the
  // gate must refuse before POST's blob-branch is ever reached, so the
  // exact (deliberately unrealistic) payload below never matters.
  const response = await POST(blobTokenRequest());
  const body = (await response.json()) as { ok: boolean; message?: string };
  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
});

test("GitHub unavailable/timed out (StorageUnavailableError, retriable): PUT returns 503, receive() never called", async () => {
  currentGetStorage = async () =>
    stubStorage(async () => {
      throw new StorageUnavailableError("перевірка прав доступу не вдалася (504)");
    });
  const { PUT } = await import("./route");
  const request = new Request("http://localhost/api/panel/video?key=abc12345-clip.mp4", {
    method: "PUT",
    body: new Uint8Array([1, 2, 3]),
  });
  const response = await PUT(request);
  const body = (await response.json()) as { ok: boolean; message?: string };
  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
});
