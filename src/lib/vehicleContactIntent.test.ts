// Covers vehicleContactIntent.ts — the sessionStorage+CustomEvent bridge
// used by the car-listing "contact us" CTA. Mirrors
// serviceContactIntent.test.ts (added by the service-modal CTA PR this one
// depends on) — same stubbing approach (Map-backed sessionStorage, a real
// Node EventTarget for `window`), same real-function coverage. Kept as its
// own file rather than merged into serviceContactIntent.test.ts so this
// PR's test additions map 1:1 onto the file this PR actually adds
// (vehicleContactIntent.ts), with no re-declaration of the service bridge's
// own tests (already covered by the dependency).

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setRequestedVehicle, consumeRequestedVehicle, onVehicleRequested } from "./vehicleContactIntent";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map<string, string>();
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
  (globalThis as unknown as { window: EventTarget }).window = new EventTarget();
});

test("consumeRequestedVehicle returns null when nothing was ever set", () => {
  assert.equal(consumeRequestedVehicle(), null);
});

test("setRequestedVehicle then consumeRequestedVehicle returns the value exactly once", () => {
  setRequestedVehicle("dacia-sandero-2022");
  assert.equal(consumeRequestedVehicle(), "dacia-sandero-2022");
  assert.equal(consumeRequestedVehicle(), null, "a second read must not see the same value again");
});

test("a stored intent older than the safety-net window is treated as absent (and is still cleared)", () => {
  setRequestedVehicle("suzuki-sx4-s-cross");
  const key = "dreamCarVavd:contactIntent:vehicleId";
  const raw = store.get(key);
  assert.ok(raw, "setRequestedVehicle must have written something");
  const parsed = JSON.parse(raw!);
  parsed.ts = Date.now() - 90_000;
  store.set(key, JSON.stringify(parsed));
  assert.equal(consumeRequestedVehicle(), null, "an expired intent must not be applied");
  assert.equal(store.has(key), false, "the expired entry must still be cleared, not left behind");
});

test("a slow same-tab/cross-page navigation (well past the OLD 10s TTL, still within the current safety net) is NOT lost", () => {
  setRequestedVehicle("dacia-sandero-comfort-2019");
  const key = "dreamCarVavd:contactIntent:vehicleId";
  const parsed = JSON.parse(store.get(key)!);
  parsed.ts = Date.now() - 15_000;
  store.set(key, JSON.stringify(parsed));
  assert.equal(
    consumeRequestedVehicle(),
    "dacia-sandero-comfort-2019",
    "a 15s-old intent must still be honored — the fix is not writing stray intents, not a shorter timer",
  );
});

test("corrupted JSON in storage is ignored, not thrown", () => {
  store.set("dreamCarVavd:contactIntent:vehicleId", "{not json");
  assert.equal(consumeRequestedVehicle(), null);
});

test("onVehicleRequested delivers a live setRequestedVehicle call, and unsubscribe stops delivery", () => {
  const received: string[] = [];
  const unsubscribe = onVehicleRequested((id: string) => received.push(id));
  setRequestedVehicle("dacia-sandero-comfort-2019");
  assert.deepEqual(received, ["dacia-sandero-comfort-2019"]);
  unsubscribe();
  setRequestedVehicle("suzuki-sx4-s-cross");
  assert.deepEqual(received, ["dacia-sandero-comfort-2019"], "no further delivery after unsubscribe");
});

test("setRequestedVehicle still dispatches the live event when sessionStorage.setItem throws", () => {
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage.setItem = () => {
    throw new Error("QuotaExceededError (simulated)");
  };
  const received: string[] = [];
  onVehicleRequested((id: string) => received.push(id));
  assert.doesNotThrow(() => setRequestedVehicle("dacia-sandero-2022"));
  assert.deepEqual(received, ["dacia-sandero-2022"]);
});
