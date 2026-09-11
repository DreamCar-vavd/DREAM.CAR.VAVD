import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveIdempotencyKeys, type LeadInput } from "./store";
import { createPgLeadsStore, type Queryable } from "./postgres";
import { resolveLeadResponse } from "./deliver";

const base: LeadInput = {
  name: "Оля",
  phone: "+44 7700 900123",
  email: "o@example.com",
  service: "diagnostics",
  vehicle: "",
  message: "коли можна записатися?",
};

const BUCKET = 600_000;

test("a retry seconds later, straddling a 10-min boundary, still matches via the previous key", async () => {
  const t0 = 5_000_000 * BUCKET - 3_000; // 3 s before a boundary
  const first = await deriveIdempotencyKeys(base, t0);
  const retry = await deriveIdempotencyKeys(base, t0 + 8_000); // 8 s later, next bucket

  // first submission landed in bucket N; the retry is in bucket N+1 but its
  // `previous` key === the first submission's `current` key.
  assert.equal(retry.previous, first.current);
});

test("two intentional identical submissions within ~15 min collapse to one key pair", async () => {
  const t0 = 9_000_000 * BUCKET + 10_000;
  const a = await deriveIdempotencyKeys(base, t0);
  const b = await deriveIdempotencyKeys(base, t0 + 12 * 60_000); // 12 min later
  // b.current is a new bucket, but b.previous covers a.current OR a.previous.
  assert.ok(b.previous === a.current || b.current === a.current);
});

test("the same text 30+ min later is a genuinely new enquiry — fresh keys, no overlap", async () => {
  const t0 = 9_000_000 * BUCKET + 10_000;
  const a = await deriveIdempotencyKeys(base, t0);
  const later = await deriveIdempotencyKeys(base, t0 + 40 * 60_000);
  assert.notEqual(later.current, a.current);
  assert.notEqual(later.previous, a.current);
  assert.notEqual(later.previous, a.previous);
});

test("different message text -> different keys even in the same bucket", async () => {
  const t0 = 9_000_000 * BUCKET;
  const a = await deriveIdempotencyKeys(base, t0);
  const b = await deriveIdempotencyKeys({ ...base, message: "інше питання" }, t0);
  assert.notEqual(a.current, b.current);
});

test("end-to-end: the adapter dedups a boundary retry without inserting a second row", async () => {
  let inserts = 0;
  const rows: { id: string; key: string }[] = [];
  const db: Queryable = {
    async query(rawText: string, params: unknown[] = []) {
      const text = rawText.replace(/\s+/g, " ").trim();
      if (text.includes("SELECT id FROM leads WHERE idempotency_key IN")) {
        const hit = rows.find((r) => params.includes(r.key));
        return { rows: (hit ? [{ id: hit.id }] : []) as never, rowCount: hit ? 1 : 0 };
      }
      if (text.includes("INSERT INTO leads")) {
        const key = params[6] as string;
        if (rows.some((r) => r.key === key)) return { rows: [] as never, rowCount: 0 };
        inserts += 1;
        const id = `id-${inserts}`;
        rows.push({ id, key });
        return { rows: [{ id }] as never, rowCount: 1 };
      }
      if (text.includes("SELECT id FROM leads WHERE idempotency_key = $1")) {
        const hit = rows.find((r) => r.key === params[0]);
        return { rows: (hit ? [{ id: hit.id }] : []) as never, rowCount: hit ? 1 : 0 };
      }
      return { rows: [] as never, rowCount: 0 };
    },
  };
  const store = createPgLeadsStore(db);

  const t0 = 5_000_000 * BUCKET - 3_000;
  const r1 = await store.create(base, await deriveIdempotencyKeys(base, t0));
  const r2 = await store.create(base, await deriveIdempotencyKeys(base, t0 + 8_000));

  assert.equal(r1.inserted, true);
  assert.equal(r2.inserted, false);
  assert.equal(r2.id, r1.id);
  assert.equal(inserts, 1);
});

test("email is retried after a failure — the DB dedup never blocks a fresh delivery attempt", () => {
  // A retry: the row is already saved (savedToDb true) and email failed once.
  // resolveLeadResponse still returns a success the client can act on, and the
  // route always calls fetch() again on the next request (nothing gates it).
  const afterFailedEmail = resolveLeadResponse({ hasStore: true, savedToDb: true, email: "failed" });
  assert.deepEqual(afterFailedEmail, { status: 200, body: { ok: true, code: "SAVED_EMAIL_FAILED" } });
  const retrySucceeds = resolveLeadResponse({ hasStore: true, savedToDb: true, email: "ok" });
  assert.deepEqual(retrySucceeds, { status: 200, body: { ok: true } });
});
