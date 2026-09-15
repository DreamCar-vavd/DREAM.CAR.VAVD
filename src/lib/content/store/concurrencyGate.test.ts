import { test } from "node:test";
import assert from "node:assert/strict";
import { ConcurrencyGate } from "./concurrencyGate";

/** A promise you resolve/reject by hand — lets a test drive task timing exactly. */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const tick = () => Promise.resolve();
/** Yield the microtask queue `n` times — lets a precise number of continuations run. */
const microtasks = async (n: number) => {
  for (let i = 0; i < n; i += 1) await tick();
};
const flush = async (n = 8) => microtasks(n);

/** Wraps a task so the test can observe how many run at once. */
function makeTracker() {
  const state = { running: 0, peak: 0, started: [] as number[], finished: [] as number[] };
  const task =
    (id: number, gate: { promise: Promise<unknown> }) =>
    async () => {
      state.running += 1;
      state.peak = Math.max(state.peak, state.running);
      state.started.push(id);
      try {
        await gate.promise;
      } finally {
        state.running -= 1;
        state.finished.push(id);
      }
    };
  return { state, task };
}

// The bug report's sequence, at width 2:
//   A, B take both permits · C queues · A finishes -> permit freed + C signalled
//   · BEFORE C resumes a new caller D arrives.
// The naive gate dropped `active` to 1 on release and let the waiter re-add it
// on resume, so D (landing in that gap) saw a free slot, jumped the queue, and C
// resumed too -> 3 concurrent. Which exact microtask D lands on is scheduler
// detail, so we sweep D's arrival across the whole window; the fixed gate holds
// <= max for every offset, the naive one breaks on at least one.
for (let gap = 0; gap <= 6; gap += 1) {
  test(`ConcurrencyGate: a new caller arriving ${gap} microtask(s) after a release still cannot exceed the limit`, async () => {
    const gate = new ConcurrencyGate(2);
    const { state, task } = makeTracker();
    const dA = deferred();
    const dB = deferred();
    const dC = deferred();
    const dD = deferred();

    const pA = gate.run(task(1, dA));
    const pB = gate.run(task(2, dB));
    await flush();
    assert.equal(state.running, 2);
    assert.equal(gate.activeCount, 2);

    const pC = gate.run(task(3, dC)); // queues
    await flush();
    assert.equal(state.running, 2, "C is waiting");
    assert.equal(gate.queueLength, 1);

    dA.resolve(); // permit freed, C signalled
    await microtasks(gap); // D arrives `gap` microtasks into the release window
    const pD = gate.run(task(4, dD));
    await flush();

    assert.ok(
      state.peak <= 2,
      `permit over-issued at gap=${gap}: peak concurrency ${state.peak}, limit 2`,
    );

    dB.resolve();
    dC.resolve();
    dD.resolve();
    await Promise.all([pA, pB, pC, pD]);
    assert.equal(state.running, 0);
    assert.equal(gate.activeCount, 0, "all permits returned");
    assert.equal(gate.queueLength, 0, "queue drained, nothing hung");
    assert.deepEqual(state.started, [1, 2, 3, 4], "FIFO: C ran before the later D");
  });
}

test("ConcurrencyGate: never more than `max` active under a heavy burst", async () => {
  const MAX = 4;
  const gate = new ConcurrencyGate(MAX);
  const { state, task } = makeTracker();
  const defs = Array.from({ length: 30 }, () => deferred());
  const ps = defs.map((d, i) => gate.run(task(i, d)));
  // Release them in a jittered order while more are still queued.
  for (let i = 0; i < defs.length; i += 1) {
    defs[i].resolve();
    if (i % 3 === 0) await flush(2);
  }
  await Promise.all(ps);
  assert.equal(state.peak, MAX, `expected exactly ${MAX} peak, saw ${state.peak}`);
  assert.equal(gate.activeCount, 0);
  assert.equal(gate.queueLength, 0);
  assert.equal(state.finished.length, 30);
});

test("ConcurrencyGate: a rejected task still releases its permit — the queue keeps draining", async () => {
  const gate = new ConcurrencyGate(1);
  const order: string[] = [];
  const boom = gate.run(async () => {
    order.push("boom-start");
    throw new Error("task failed");
  });
  const after = gate.run(async () => {
    order.push("after-start");
  });
  await assert.rejects(() => boom, /task failed/);
  await after;
  assert.deepEqual(order, ["boom-start", "after-start"], "the second task ran after the failed one released");
  assert.equal(gate.activeCount, 0);
  assert.equal(gate.queueLength, 0);
});

test("ConcurrencyGate: the queue never hangs — every queued caller eventually runs, in order", async () => {
  const gate = new ConcurrencyGate(2);
  const done: number[] = [];
  const ps = Array.from({ length: 12 }, (_, i) =>
    gate.run(async () => {
      await flush(1);
      done.push(i);
    }),
  );
  await Promise.all(ps);
  assert.deepEqual(done, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(gate.activeCount, 0);
});

test("ConcurrencyGate: results come back to each caller (values + order preserved)", async () => {
  const gate = new ConcurrencyGate(3);
  const out = await Promise.all(
    Array.from({ length: 10 }, (_, i) => gate.run(async () => i * i)),
  );
  assert.deepEqual(out, [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]);
});

test("ConcurrencyGate: width 1 fully serialises (a mutex)", async () => {
  const gate = new ConcurrencyGate(1);
  const { state, task } = makeTracker();
  const defs = Array.from({ length: 5 }, () => deferred());
  const ps = defs.map((d, i) => gate.run(task(i, d)));
  await flush();
  assert.equal(state.running, 1);
  for (const d of defs) {
    d.resolve();
    await flush(2);
  }
  await Promise.all(ps);
  assert.equal(state.peak, 1);
});

test("ConcurrencyGate: rejects a non-positive limit", () => {
  assert.throws(() => new ConcurrencyGate(0), RangeError);
  assert.throws(() => new ConcurrencyGate(-1), RangeError);
  assert.throws(() => new ConcurrencyGate(1.5), RangeError);
});
