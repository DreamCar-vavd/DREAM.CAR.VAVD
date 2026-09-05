// Covers serviceContactIntent.ts — the sessionStorage+CustomEvent bridge
// used by the service-modal "contact us" CTA. Needs `window` (for
// dispatchEvent/addEventListener) and `sessionStorage`, neither of which
// exist in plain `node --test`. Rather than pull in jsdom (a new
// dependency), this stubs the minimal surface the module actually calls —
// `window` as a real Node `EventTarget` (built in; `CustomEvent` is also
// global in Node 18+), and `sessionStorage` as a tiny Map-backed object —
// re-installed fresh before every test. This exercises the REAL exported
// functions — expiry, consume-once, corrupted-storage and thrown-storage
// resilience — not a reimplementation of their logic.
//
// This is not a substitute for the manual Playwright testing done in the
// isolated copy for the actual DOM/React integration (auto-fill,
// re-selection, keyboard focus, mobile layout, modified-click handling) —
// those aren't part of this project's CI and are documented in the PR
// description instead.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setRequestedService, consumeRequestedService, onServiceRequested } from "./serviceContactIntent";

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

test("consumeRequestedService returns null when nothing was ever set", () => {
  assert.equal(consumeRequestedService(), null);
});

test("setRequestedService then consumeRequestedService returns the value exactly once", () => {
  setRequestedService("car-service");
  assert.equal(consumeRequestedService(), "car-service");
  assert.equal(consumeRequestedService(), null, "a second read must not see the same value again");
});

test("a stored intent older than the safety-net window is treated as absent (and is still cleared)", () => {
  setRequestedService("detailing");
  // Rewrite the stored timestamp to simulate a same-tab navigation that was
  // genuinely interrupted (browser Stop, network error before the
  // destination mounted) well beyond the MAX_AGE_MS safety net. This is
  // NOT the Ctrl/Cmd-click case — that no longer writes anything at all
  // (see isModifiedClick.test.ts) — this is the rarer, still-real case the
  // timer exists for.
  const key = "dreamCarVavd:contactIntent:service";
  const raw = store.get(key);
  assert.ok(raw, "setRequestedService must have written something");
  const parsed = JSON.parse(raw!);
  parsed.ts = Date.now() - 90_000;
  store.set(key, JSON.stringify(parsed));
  assert.equal(consumeRequestedService(), null, "an expired intent must not be applied");
  assert.equal(store.has(key), false, "the expired entry must still be cleared, not left behind");
});

test("a slow same-tab navigation (well past the OLD 10s TTL, still within the current safety net) is NOT lost", () => {
  // Regression guard: a genuine, still-relevant navigation that simply
  // takes a while must not have its context silently dropped by an
  // over-eager timer. 15s exceeds the previous MAX_AGE_MS (10_000) but
  // must still be honored under the current one.
  setRequestedService("diagnostics");
  const key = "dreamCarVavd:contactIntent:service";
  const parsed = JSON.parse(store.get(key)!);
  parsed.ts = Date.now() - 15_000;
  store.set(key, JSON.stringify(parsed));
  assert.equal(
    consumeRequestedService(),
    "diagnostics",
    "a 15s-old intent must still be honored — the fix is not writing stray intents, not a shorter timer",
  );
});

test("corrupted JSON in storage is ignored, not thrown", () => {
  store.set("dreamCarVavd:contactIntent:service", "{not json");
  assert.equal(consumeRequestedService(), null);
});

test("onServiceRequested delivers a live setRequestedService call, and unsubscribe stops delivery", () => {
  const received: string[] = [];
  const unsubscribe = onServiceRequested((slug: string) => received.push(slug));
  setRequestedService("diagnostics");
  assert.deepEqual(received, ["diagnostics"]);
  unsubscribe();
  setRequestedService("srs-airbag");
  assert.deepEqual(received, ["diagnostics"], "no further delivery after unsubscribe");
});

test("setRequestedService still dispatches the live event when sessionStorage.setItem throws", () => {
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage.setItem = () => {
    throw new Error("QuotaExceededError (simulated)");
  };
  const received: string[] = [];
  onServiceRequested((slug: string) => received.push(slug));
  assert.doesNotThrow(() => setRequestedService("car-selection"));
  assert.deepEqual(received, ["car-selection"]);
});
