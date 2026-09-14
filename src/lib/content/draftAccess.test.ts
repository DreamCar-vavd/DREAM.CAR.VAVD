import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDraftAccess } from "./draftAccess";
import { NotConnectedError, StorageAuthError, StorageForbiddenError, StorageUnavailableError } from "./store/adapter";
import type { PanelStorage } from "./store/adapter";
import type { SiteContent } from "./siteContent";

/**
 * `resolveDraftAccess` is the pure half of the draft-preview access check —
 * see the doc comment on it and on `readSiteContent` in siteContent.ts for
 * why it is split out (next/headers can't run under node:test). The point
 * of this suite: prove a check failure ALWAYS returns the published
 * fallback (never throws past the caller into a broken page, and never
 * returns `ok: true` for a session that shouldn't see the draft) — this is
 * exactly the "stale draft-mode session outlives revoked access" bug the
 * fix targets, so every denial case must resolve to the SAME fail-closed
 * shape a fresh render would produce.
 */

const published: SiteContent = {
  cars: [],
  gallery: [],
  services: [],
  contact: [],
  promos: [],
  isDraftPreview: false,
};

function storageWith(assertWriteAccess: () => Promise<void>): PanelStorage {
  return { assertWriteAccess } as unknown as PanelStorage;
}

test("no session (getStorage throws NotConnectedError): fails closed to the published snapshot", async () => {
  const result = await resolveDraftAccess(
    {
      getStorage: async () => {
        throw new NotConnectedError("Ви не увійшли через GitHub.");
      },
    },
    published,
  );
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.content.isDraftPreview, false);
    assert.match(result.content.draftError ?? "", /Сесію завершено або відкликано/);
  }
});

test("invalid/expired/revoked token (401 -> StorageAuthError): fails closed, same message as no session", async () => {
  const result = await resolveDraftAccess(
    { getStorage: async () => storageWith(async () => { throw new StorageAuthError(); }) },
    published,
  );
  assert.equal(result.ok, false);
  assert.ok(!result.ok && /Сесію завершено або відкликано/.test(result.content.draftError ?? ""));
});

test("stale draft-mode session, access since revoked (403 -> StorageForbiddenError): fails closed, distinct message", async () => {
  // This is the exact regression the fix targets: a session that enabled
  // Draft Mode while still a Collaborator, now removed. The draft-mode
  // cookie itself never expires on its own, so only this live re-check
  // (not the cookie's mere presence) can catch it.
  const result = await resolveDraftAccess(
    {
      getStorage: async () =>
        storageWith(async () => {
          throw new StorageForbiddenError("недостатньо прав доступу");
        }),
    },
    published,
  );
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.content.isDraftPreview, false, "must fall back to the PUBLISHED content, not an empty draft");
    assert.match(result.content.draftError ?? "", /Немає прав доступу/);
  }
});

test("a check failure never returns ok:true — an error from assertWriteAccess is never treated as success", async () => {
  const result = await resolveDraftAccess(
    { getStorage: async () => storageWith(async () => { throw new StorageForbiddenError("x"); }) },
    published,
  );
  assert.notEqual(result.ok, true, "the point of 'fail closed': a thrown check error must never resolve as allowed");
});

test("GitHub error/timeout during the check (StorageUnavailableError): propagates, not swallowed as access", async () => {
  // Distinct from the auth/forbidden cases: an unreachable GitHub is not
  // "access denied" — the caller (readSiteContent) already has a broader
  // try/catch around the whole draft path for this, so this must NOT be
  // silently mapped to a draftError here (which would render a wrong,
  // specific denial message for what is really just a network blip).
  await assert.rejects(
    () =>
      resolveDraftAccess(
        {
          getStorage: async () =>
            storageWith(async () => {
              throw new StorageUnavailableError("GitHub не відповів вчасно");
            }),
        },
        published,
      ),
    StorageUnavailableError,
  );
});

test("allowed session (push:true): resolves ok with the live storage handle, not the published fallback", async () => {
  const liveStorage = storageWith(async () => {});
  const result = await resolveDraftAccess({ getStorage: async () => liveStorage }, published);
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.storage === liveStorage);
});
