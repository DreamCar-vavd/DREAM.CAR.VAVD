import { test, mock } from "node:test";
import assert from "node:assert/strict";

/**
 * `readSiteContent` (the actual production entry point every public page
 * calls) was previously considered untestable — see the removed "sequence"
 * test this file replaces — because it statically imports `server-only` and
 * `next/headers`, neither of which run under `node:test`. Those are now
 * mocked so this suite exercises the REAL function, not a hand-reconstructed
 * copy of its control flow: a regression that moves `resolveDraftAccess`'s
 * call back outside `readSiteContent`'s try/catch, or that starts calling
 * `storage.readDir` before the access check resolves, breaks these tests —
 * the old test could not have caught either, because it never called
 * `readSiteContent` at all.
 *
 * Mocking must happen BEFORE the first import of `./siteContent`, since its
 * `import "server-only"` / `import { draftMode } from "next/headers"` are
 * static and evaluated at that point — hence the dynamic `await import`
 * inside each test rather than a top-level `import`.
 *
 * `{ exports }` (not the deprecated `{ namedExports }`) is the current
 * runtime option — Node's own DeprecationWarning on `namedExports` says so.
 * The `@types/node` version pinned in this repo predates that option, so
 * these options objects go through a typed helper (not an inline literal) to
 * sidestep the stale type's excess-property check; same pattern as
 * `src/app/api/panel/video/route.test.ts`.
 */
const mockExports = (exports: object): Parameters<typeof mock.module>[1] =>
  ({ exports }) as Parameters<typeof mock.module>[1];

mock.module("server-only", mockExports({}));

let draftEnabled = true;
mock.module(
  "next/headers",
  mockExports({ draftMode: async () => ({ isEnabled: draftEnabled }) }),
);

const publishedSnapshot = {
  cars: [],
  gallery: [],
  services: [],
  contact: [],
  promos: [],
};
mock.module(
  "./snapshot",
  mockExports({ readPublishedSnapshot: async () => publishedSnapshot }),
);

let storeMock: { restore(): void } | undefined;
function mockStore(assertWriteAccess: () => Promise<void>, readDir?: () => Promise<{ data: unknown[]; version: string }>) {
  storeMock?.restore();
  storeMock = mock.module(
    "./store",
    mockExports({
      getStorage: async () => ({
        mode: "github",
        assertWriteAccess,
        readDir: readDir ?? (async () => { throw new Error("readDir must not be called on a failed access check"); }),
      }),
    }),
  );
}

test("draft mode off: published content returned, storage never touched", async () => {
  draftEnabled = false;
  mockStore(async () => { throw new Error("must not be called when draft mode is off"); });
  const { readSiteContent } = await import("./siteContent");
  const result = await readSiteContent();
  assert.equal(result.isDraftPreview, false);
  assert.equal(result.draftError, undefined);
});

test("draft mode on, GitHub timeout during the access check: falls back to published content, working content never read", async () => {
  draftEnabled = true;
  const { StorageUnavailableError } = await import("./store/adapter");
  mockStore(async () => {
    throw new StorageUnavailableError("перевірка прав доступу не вдалася (504)");
  });
  const { readSiteContent } = await import("./siteContent");
  const result = await readSiteContent();
  assert.equal(result.isDraftPreview, false, "must fall back to the published snapshot, not an empty/broken draft");
  assert.ok(result.draftError, "banner text must be present");
  assert.doesNotMatch(
    result.draftError ?? "",
    /Немає прав|відкликано/,
    "a network blip must not be worded like a permissions/session denial",
  );
});

test("draft mode on, an error type the access check does not classify: safe generic result, no raw error text", async () => {
  draftEnabled = true;
  mockStore(async () => {
    throw new TypeError("connect ECONNREFUSED 10.0.0.1:443 password=hunter2");
  });
  const { readSiteContent } = await import("./siteContent");
  const result = await readSiteContent();
  assert.equal(result.isDraftPreview, false);
  assert.ok(result.draftError, "banner text must be present, not a thrown exception reaching the caller");
  assert.doesNotMatch(
    result.draftError ?? "",
    /ECONNREFUSED|10\.0\.0\.1|hunter2/,
    "the raw exception text must never reach the rendered page",
  );
});

test("draft mode on, allowed session: working content is actually read", async () => {
  draftEnabled = true;
  let readDirCalls = 0;
  mockStore(
    async () => {},
    async () => {
      readDirCalls++;
      return { data: [], version: "v1" };
    },
  );
  const { readSiteContent } = await import("./siteContent");
  const result = await readSiteContent();
  assert.equal(result.isDraftPreview, true);
  assert.equal(result.draftError, undefined);
  assert.equal(readDirCalls, 5, "one readDir per content directory (cars/gallery/services/contact/promos)");
});
