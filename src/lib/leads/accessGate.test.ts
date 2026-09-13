import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLeadsAccess } from "./accessGate";
import { NotConnectedError, StorageForbiddenError, StorageUnavailableError } from "../content/store/adapter";
import type { PanelStorage } from "../content/store/adapter";
import type { Lead, LeadsStore } from "./store";

/**
 * These tests exercise `loadLeadsAccess` — the exact function `/panel/leads`
 * calls before rendering — not a re-test of `assertWriteAccess` in isolation
 * (that already lives in `store/github.test.ts`). The point here is the
 * ORDERING: does the leads store ever get constructed/read when the gate
 * should have refused? A spy on both factories is the only way to prove
 * that; a render assertion on the page's JSX cannot.
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

function countingLeadsStore() {
  let getStoreCalls = 0;
  let listCalls = 0;
  const rows: Lead[] = [
    {
      id: "lead-1",
      createdAt: "2026-09-13T10:00:00Z",
      name: "Тест",
      phone: "",
      email: "",
      service: "",
      vehicle: "",
      message: "",
      demo: false,
    },
  ];
  const store: LeadsStore = {
    kind: "database",
    list: async () => {
      listCalls++;
      return { leads: rows, nextCursor: null, total: rows.length };
    },
    get: async (id) => rows.find((r) => r.id === id) ?? null,
  };
  return {
    getLeadsStore: async () => {
      getStoreCalls++;
      return store;
    },
    getStoreCalls: () => getStoreCalls,
    getListCalls: () => listCalls,
  };
}

test("no session (getStorage itself throws): leads store is never constructed", async () => {
  const leads = countingLeadsStore();
  const result = await loadLeadsAccess({
    getStorage: async () => {
      throw new NotConnectedError("Ви не увійшли через GitHub.");
    },
    getLeadsStore: leads.getLeadsStore,
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error instanceof NotConnectedError);
  assert.equal(leads.getStoreCalls(), 0, "getLeadsStore must not run on NotConnectedError");
  assert.equal(leads.getListCalls(), 0);
});

test("invalid/revoked token: assertWriteAccess rejects -> leads store never constructed", async () => {
  const leads = countingLeadsStore();
  const { storage, getCalls } = countingStorage(async () => {
    throw new StorageForbiddenError("недостатньо прав доступу для перегляду заявок");
  });
  const result = await loadLeadsAccess({
    getStorage: async () => storage,
    getLeadsStore: leads.getLeadsStore,
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error instanceof StorageForbiddenError);
  assert.equal(getCalls(), 1, "the access check itself must run exactly once");
  assert.equal(leads.getStoreCalls(), 0, "getLeadsStore must not run when access is forbidden");
  assert.equal(leads.getListCalls(), 0);
});

test("signed-in user without write access (push:false, surfaced as StorageForbiddenError): no leads read", async () => {
  const leads = countingLeadsStore();
  const { storage } = countingStorage(async () => {
    throw new StorageForbiddenError("недостатньо прав доступу для перегляду заявок");
  });
  const result = await loadLeadsAccess({
    getStorage: async () => storage,
    getLeadsStore: leads.getLeadsStore,
  });
  assert.equal(result.ok, false);
  assert.equal(leads.getStoreCalls(), 0);
  assert.equal(leads.getListCalls(), 0);
});

test("GitHub error/timeout during the access check: no leads read, error surfaces as retriable", async () => {
  const leads = countingLeadsStore();
  const { storage } = countingStorage(async () => {
    throw new StorageUnavailableError("GitHub не відповів вчасно");
  });
  const result = await loadLeadsAccess({
    getStorage: async () => storage,
    getLeadsStore: leads.getLeadsStore,
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error instanceof StorageUnavailableError);
  assert.ok(!result.ok && (result.error as StorageUnavailableError).retriable);
  assert.equal(leads.getStoreCalls(), 0, "getLeadsStore must not run while access is undetermined");
  assert.equal(leads.getListCalls(), 0);
});

test("allowed user (push:true): access check runs first, then the leads list is actually read", async () => {
  const leads = countingLeadsStore();
  const { storage, getCalls } = countingStorage(async () => {
    /* resolves — this account has push access */
  });
  const result = await loadLeadsAccess({
    getStorage: async () => storage,
    getLeadsStore: leads.getLeadsStore,
  });
  assert.equal(result.ok, true);
  assert.equal(getCalls(), 1);
  assert.equal(leads.getStoreCalls(), 1, "an allowed user must reach the leads store");
  assert.ok(result.ok);
  if (result.ok) {
    const page = await result.leadsStore.list({ limit: 20 });
    assert.equal(page.leads.length, 1);
    assert.equal(leads.getListCalls(), 1);
  }
});

test("regression guard: a gate that never calls assertWriteAccess is caught by this suite", async () => {
  // Simulates the exact bug class this test file exists to prevent: a
  // getStorage() that resolves successfully but a caller that FORGOT to call
  // assertWriteAccess() before reaching the leads store. If someone changes
  // loadLeadsAccess to skip the check, this test's storage stub records that
  // assertWriteAccess was never invoked, and the read-then-verify assertion
  // below fails instead of silently passing.
  const leads = countingLeadsStore();
  const { storage, getCalls } = countingStorage(async () => {
    throw new StorageForbiddenError("недостатньо прав доступу для перегляду заявок");
  });
  await loadLeadsAccess({ getStorage: async () => storage, getLeadsStore: leads.getLeadsStore });
  assert.equal(getCalls(), 1, "assertWriteAccess must be called on every gate evaluation");
});
