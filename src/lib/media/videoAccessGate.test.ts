import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadVideoAccess } from "./videoAccessGate";
import {
  NotConnectedError,
  StorageAuthError,
  StorageForbiddenError,
  StorageUnavailableError,
} from "../content/store/adapter";
import type { PanelStorage } from "../content/store/adapter";
import { LocalVideoStore } from "./videoStore";
import type { VideoObject, VideoStore } from "./videoStore";

/**
 * These tests exercise `loadVideoAccess` — the exact function `/panel/video`
 * and every method of `/api/panel/video` call before touching any video
 * storage — not a re-test of `assertWriteAccess` in isolation (that already
 * lives in `store/github.test.ts`). The point here is the ORDERING: does
 * `getVideoStore()` (Blob API, local filesystem) ever get called when the
 * gate should have refused? A spy on both factories is the only way to prove
 * that; a render assertion on the page's JSX, or a response-shape assertion
 * on the route, cannot. Modelled directly on
 * `src/lib/leads/accessGate.test.ts`.
 */

function countingStorage(assertWriteAccess: () => Promise<void>) {
  let calls = 0;
  const storage: Pick<PanelStorage, "assertWriteAccess"> = {
    assertWriteAccess: async () => {
      calls++;
      await assertWriteAccess();
    },
  };
  return { storage: storage as PanelStorage, getCalls: () => calls };
}

function countingVideoStore() {
  let getStoreCalls = 0;
  let listCalls = 0;
  const video: VideoObject = {
    key: "abc12345-clip.mp4",
    url: "/uploads/videos/abc12345-clip.mp4",
    size: 1234,
    uploadedAt: "2026-09-16T10:00:00Z",
  };
  const store: VideoStore = {
    kind: "local",
    createUpload: async () => {
      throw new Error("createUpload must not be called in this suite");
    },
    head: async () => {
      throw new Error("head must not be called in this suite");
    },
    remove: async () => {
      throw new Error("remove must not be called in this suite");
    },
    list: async () => {
      listCalls++;
      return [video];
    },
  };
  return {
    getVideoStore: () => {
      getStoreCalls++;
      return store;
    },
    getStoreCalls: () => getStoreCalls,
    getListCalls: () => listCalls,
  };
}

test("no session (getStorage itself throws): getVideoStore is never constructed", async () => {
  const videoStore = countingVideoStore();
  const result = await loadVideoAccess({
    getStorage: async () => {
      throw new NotConnectedError("Ви не увійшли через GitHub.");
    },
    getVideoStore: videoStore.getVideoStore,
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error instanceof NotConnectedError);
  assert.equal(videoStore.getStoreCalls(), 0, "getVideoStore must not run on NotConnectedError");
  assert.equal(videoStore.getListCalls(), 0);
});

test("invalid/expired/revoked token (GitHub 401): StorageAuthError, video store never constructed", async () => {
  const videoStore = countingVideoStore();
  const { storage, getCalls } = countingStorage(async () => {
    throw new StorageAuthError();
  });
  const result = await loadVideoAccess({
    getStorage: async () => storage,
    getVideoStore: videoStore.getVideoStore,
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error instanceof StorageAuthError);
  assert.equal(getCalls(), 1, "the access check itself must run exactly once");
  assert.equal(videoStore.getStoreCalls(), 0, "getVideoStore must not run when the session is invalid");
  assert.equal(videoStore.getListCalls(), 0);
});

test("signed-in with a valid token but no push access (GitHub 403): StorageForbiddenError, no video store read", async () => {
  const videoStore = countingVideoStore();
  const { storage, getCalls } = countingStorage(async () => {
    throw new StorageForbiddenError("недостатньо прав доступу для цієї дії");
  });
  const result = await loadVideoAccess({
    getStorage: async () => storage,
    getVideoStore: videoStore.getVideoStore,
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error instanceof StorageForbiddenError);
  assert.equal(getCalls(), 1);
  assert.equal(videoStore.getStoreCalls(), 0, "getVideoStore must not run when push access is missing");
  assert.equal(videoStore.getListCalls(), 0);
});

test("GitHub error/timeout during the access check: no video store read, error surfaces as retriable", async () => {
  const videoStore = countingVideoStore();
  const { storage } = countingStorage(async () => {
    throw new StorageUnavailableError("GitHub не відповів вчасно");
  });
  const result = await loadVideoAccess({
    getStorage: async () => storage,
    getVideoStore: videoStore.getVideoStore,
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error instanceof StorageUnavailableError);
  assert.ok(!result.ok && (result.error as StorageUnavailableError).retriable);
  assert.equal(videoStore.getStoreCalls(), 0, "getVideoStore must not run while access is undetermined");
  assert.equal(videoStore.getListCalls(), 0);
});

test("allowed user (push:true): access check runs first, then the video list is actually read", async () => {
  const videoStore = countingVideoStore();
  const { storage, getCalls } = countingStorage(async () => {
    /* resolves — this account has push access */
  });
  const result = await loadVideoAccess({
    getStorage: async () => storage,
    getVideoStore: videoStore.getVideoStore,
  });
  assert.equal(result.ok, true);
  assert.equal(getCalls(), 1);
  assert.equal(videoStore.getStoreCalls(), 1, "an allowed user must reach the video store");
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.storage, storage);
    const list = await result.videoStore.list();
    assert.equal(list.length, 1);
    assert.equal(videoStore.getListCalls(), 1);
  }
});

test("regression guard: a gate that never calls assertWriteAccess is caught by this suite", async () => {
  // Simulates the exact bug class this test file exists to prevent: a
  // getStorage() that resolves successfully but a caller that FORGOT to call
  // assertWriteAccess() before reaching the video store. If someone changes
  // loadVideoAccess to skip the check, this test's storage stub records that
  // assertWriteAccess was never invoked, and the assertion below fails
  // instead of silently passing.
  const videoStore = countingVideoStore();
  const { storage, getCalls } = countingStorage(async () => {
    throw new StorageForbiddenError("недостатньо прав доступу для цієї дії");
  });
  await loadVideoAccess({ getStorage: async () => storage, getVideoStore: videoStore.getVideoStore });
  assert.equal(getCalls(), 1, "assertWriteAccess must be called on every gate evaluation");
});

test(
  "allowed user, REAL LocalVideoStore(tempRoot): gate pass-through actually works against disk, " +
    "isolated from the repo's public/uploads/videos",
  async () => {
    // Every test above injects countingVideoStore() -- a fake -- to prove
    // ordering. This one instead injects the real LocalVideoStore class
    // (same one production's getVideoStore() returns for local dev), pointed
    // at a throwaway mkdtemp() root, to prove the gate's pass-through also
    // works against genuine disk I/O. `route.test.ts` used to cover this at
    // the route level by letting requireVideoAccess() fall through to the
    // REAL, un-injected getVideoStore() -- which defaults to
    // `<repo>/public/uploads/videos` (see videoStore.ts's LocalVideoStore
    // constructor). PANEL_CONTENT_ROOT does not influence that default at
    // all, so that route test was silently reading/writing the real repo
    // directory. It was removed; this test plus videoStore.test.ts's own
    // `withTempLocalStore()` coverage (createUpload/receive/head/list/remove
    // against a temp root) now cover the same ground in isolation.
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "video-access-gate-local-"));
    try {
      const store = new LocalVideoStore(tmpRoot);
      const { storage, getCalls } = countingStorage(async () => {
        /* resolves -- this account has push access */
      });
      const result = await loadVideoAccess({
        getStorage: async () => storage,
        getVideoStore: () => store,
      });
      assert.equal(result.ok, true);
      assert.equal(getCalls(), 1);
      if (!result.ok) return;
      assert.equal(result.videoStore, store);
      // Starts empty -- proof this never fell back to a real, possibly
      // non-empty repo directory.
      assert.deepEqual(await result.videoStore.list(), []);
      const created = await store.createUpload({ filename: "clip.mp4", contentType: "video/mp4", size: 10 });
      await store.receive!(created.key, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42")]));
      const onDisk = await fs.readdir(tmpRoot);
      assert.deepEqual(onDisk, [created.key], "the file must land in the temp root, not the repo");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  },
);
