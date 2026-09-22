/**
 * A bounded-concurrency gate: at most `max` tasks run through `run()` at once,
 * the rest queue FIFO. Shared across callers, so several fan-outs (e.g. every
 * `readDir` in one page render) obey ONE ceiling together.
 *
 * The permit is handed **directly** from a finishing task to the next waiter —
 * `active` is never dropped while a waiter exists — so a `run()` call that
 * arrives in the gap between "slot freed" and "waiter resumed" cannot steal the
 * permit and push the count over `max`. (The naive version decremented `active`
 * on release and let the waiter re-increment on resume; a caller landing in
 * that window saw `active < max` and jumped the queue → `max + 1` active.)
 *
 * A task's rejection propagates only to its own `run()` caller; the permit is
 * still released in `finally`, so the queue never stalls on an error.
 */
export class ConcurrencyGate {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max < 1) {
      throw new RangeError(`ConcurrencyGate max must be a positive integer, got ${max}`);
    }
  }

  /** Tasks currently holding a permit — for tests / diagnostics. */
  get activeCount(): number {
    return this.active;
  }
  /** Callers parked in the queue — for tests / diagnostics. */
  get queueLength(): number {
    return this.waiters.length;
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      // Pass the permit straight through: `active` stays put, so nothing racing
      // in can grab it before `next` resumes.
      next();
    } else {
      this.active -= 1;
    }
  }

  async run<R>(task: () => Promise<R>): Promise<R> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}
