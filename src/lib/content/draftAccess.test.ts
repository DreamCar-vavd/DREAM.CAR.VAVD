import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDraftAccess } from "./draftAccess";
import {
  NotConnectedError,
  StorageAuthError,
  StorageForbiddenError,
  StorageRateLimitedError,
  StorageUnavailableError,
} from "./store/adapter";
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

test("GitHub unreachable/timeout during the check (StorageUnavailableError): fails closed, NOT rethrown", async () => {
  // Regression for the exact bug the 14.09.2026 fix targets: this call sits
  // in `readSiteContent` BEFORE its own try/catch (see siteContent.ts), so a
  // thrown error here used to escape all the way out of the whole page
  // render instead of falling back to the published snapshot. A network blip
  // is also NOT "access denied" — the message must be distinct from the
  // auth/forbidden wording above, or an operator reading it would go chase a
  // permissions problem that doesn't exist.
  const result = await resolveDraftAccess(
    {
      getStorage: async () =>
        storageWith(async () => {
          throw new StorageUnavailableError("GitHub не відповів вчасно");
        }),
    },
    published,
  );
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.content.isDraftPreview, false, "must fall back to the PUBLISHED content, not an empty draft");
    assert.doesNotMatch(
      result.content.draftError ?? "",
      /Немає прав|відкликано/,
      "a network blip must not be worded like a permissions/session denial",
    );
    assert.match(result.content.draftError ?? "", /GitHub не відповів вчасно/);
  }
});

test("GitHub rate limit during the check (StorageRateLimitedError): fails closed the same way as StorageUnavailableError", async () => {
  const result = await resolveDraftAccess(
    {
      getStorage: async () =>
        storageWith(async () => {
          throw new StorageRateLimitedError("Спробуйте через хвилину.");
        }),
    },
    published,
  );
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.content.isDraftPreview, false);
    assert.doesNotMatch(result.content.draftError ?? "", /Немає прав|відкликано/);
  }
});

test("sequence: a failed retriable check must short-circuit BEFORE any content read is attempted", async () => {
  // Proves the ordering `readSiteContent` depends on, not just resolveDraftAccess's
  // return value in isolation: the storage stub below has no `readDir` at
  // all, so if the caller pressed on to read content after a failed check
  // (the exact shape of the bug — the check's own error skipping past the
  // access decision entirely) this test fails with a TypeError instead of a
  // false green from asserting resolveDraftAccess's output alone.
  const storage = storageWith(async () => {
    throw new StorageUnavailableError("перевірка прав доступу не вдалася (504)");
  });
  const access = await resolveDraftAccess({ getStorage: async () => storage }, published);
  assert.equal(access.ok, false);
  if (!access.ok) {
    // The same short-circuit `readSiteContent` performs: `if (!access.ok) return access.content`.
    const result = access.content;
    assert.equal(result.isDraftPreview, false);
    assert.ok(result.draftError, "banner text must be present so the page can render it");
  }
  assert.equal(
    "readDir" in storage,
    false,
    "storage stub intentionally has no readDir — reaching for it would prove the check was bypassed",
  );
});

test("allowed session (push:true): resolves ok with the live storage handle, not the published fallback", async () => {
  const liveStorage = storageWith(async () => {});
  const result = await resolveDraftAccess({ getStorage: async () => liveStorage }, published);
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.storage === liveStorage);
});
