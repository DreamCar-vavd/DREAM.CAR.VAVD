import { test } from "node:test";
import assert from "node:assert/strict";
import { createPgLeadsStore, decodeCursor, encodeCursor, type Queryable } from "./postgres";
import type { LeadInput } from "./store";

const input: LeadInput = {
  name: "Оля",
  phone: "+44 7700 900123",
  email: "o@example.com",
  service: "diagnostics",
  vehicle: "BMW",
  message: "коли можна?",
};

/** Records every SQL call and returns queued results in order. */
function fakeDb(results: Array<{ rows: Record<string, unknown>[]; rowCount?: number }>) {
  const calls: { text: string; params?: unknown[] }[] = [];
  let i = 0;
  const db: Queryable = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text: text.replace(/\s+/g, " ").trim(), params });
      const r = results[i++] ?? { rows: [] };
      return { rows: r.rows as never, rowCount: r.rowCount ?? r.rows.length };
    },
  };
  return { db, calls };
}

test("create: a fresh row -> inserted:true, one INSERT ... ON CONFLICT", async () => {
  const { db, calls } = fakeDb([{ rows: [{ id: "11111111-1111-1111-1111-111111111111" }] }]);
  const store = createPgLeadsStore(db);
  const r = await store.create(input, "key-abc");
  assert.deepEqual(r, { id: "11111111-1111-1111-1111-111111111111", inserted: true });
  assert.match(calls[0].text, /INSERT INTO leads .* ON CONFLICT \(idempotency_key\) DO NOTHING RETURNING id/);
  assert.deepEqual(calls[0].params, [
    input.name,
    input.phone,
    input.email,
    input.service,
    input.vehicle,
    input.message,
    "key-abc",
  ]);
});

test("create: a deduped retry (0 rows) -> inserted:false, still returns the existing id", async () => {
  const { db, calls } = fakeDb([
    { rows: [], rowCount: 0 }, // ON CONFLICT DO NOTHING
    { rows: [{ id: "22222222-2222-2222-2222-222222222222" }] }, // SELECT by key
  ]);
  const store = createPgLeadsStore(db);
  const r = await store.create(input, "key-dup");
  assert.deepEqual(r, { id: "22222222-2222-2222-2222-222222222222", inserted: false });
  assert.match(calls[1].text, /SELECT id FROM leads WHERE idempotency_key = \$1/);
});

test("list: first page requests limit+1, orders newest-first, excludes soft-deleted", async () => {
  const rows = Array.from({ length: 21 }, (_, n) => ({
    id: `id-${n}`,
    created_at: new Date(Date.UTC(2026, 8, 7, 12, 0, 0) - n * 60_000).toISOString(),
    name: "N",
    phone: "",
    email: "",
    service: "",
    vehicle: "",
    message: "",
  }));
  const { db, calls } = fakeDb([{ rows }, { rows: [{ n: "40" }] }]);
  const store = createPgLeadsStore(db);
  const page = await store.list({ limit: 20 });
  assert.equal(page.leads.length, 20);
  assert.equal(page.total, 40);
  assert.ok(page.nextCursor);
  assert.match(calls[0].text, /WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT \$1/);
  assert.deepEqual(calls[0].params, [21]);
});

test("list: a cursor page adds the (created_at, id) < (ts, id) predicate", async () => {
  const cursor = encodeCursor({
    id: "id-5",
    createdAt: "2026-09-07T11:55:00.000Z",
    name: "",
    phone: "",
    email: "",
    service: "",
    vehicle: "",
    message: "",
    demo: false,
  });
  const { db, calls } = fakeDb([{ rows: [] }, { rows: [{ n: "40" }] }]);
  const store = createPgLeadsStore(db);
  const page = await store.list({ limit: 20, cursor });
  assert.equal(page.nextCursor, null);
  assert.match(calls[0].text, /\(created_at, id\) < \(\$1, \$2\)/);
  assert.deepEqual(calls[0].params, ["2026-09-07T11:55:00.000Z", "id-5", 21]);
});

test("list: limit is clamped to [1,100]", async () => {
  const { db, calls } = fakeDb([{ rows: [] }, { rows: [{ n: "0" }] }]);
  await createPgLeadsStore(db).list({ limit: 9999 });
  assert.deepEqual(calls[0].params, [101]);
});

test("get: rejects a non-uuid id without touching the db", async () => {
  const { db, calls } = fakeDb([]);
  assert.equal(await createPgLeadsStore(db).get("../etc/passwd"), null);
  assert.equal(await createPgLeadsStore(db).get("demo-003"), null);
  assert.equal(calls.length, 0);
});

test("cursor round-trips and rejects junk", () => {
  const lead = {
    id: "abc",
    createdAt: "2026-09-07T12:00:00.000Z",
    name: "",
    phone: "",
    email: "",
    service: "",
    vehicle: "",
    message: "",
    demo: false,
  };
  const c = encodeCursor(lead);
  assert.deepEqual(decodeCursor(c), { ts: "2026-09-07T12:00:00.000Z", id: "abc" });
  assert.equal(decodeCursor("!!!not-base64!!!"), null);
  assert.equal(decodeCursor(Buffer.from("nopipe", "utf8").toString("base64url")), null);
});

test("row mapping: demo:false, ISO date, empty strings for nulls", async () => {
  const { db } = fakeDb([
    {
      rows: [
        {
          id: "33333333-3333-3333-3333-333333333333",
          created_at: new Date("2026-09-07T12:00:00Z"),
          name: "N",
          phone: null,
          email: null,
          service: null,
          vehicle: null,
          message: null,
        },
      ],
    },
  ]);
  const lead = await createPgLeadsStore(db).get("33333333-3333-3333-3333-333333333333");
  assert.equal(lead?.demo, false);
  assert.equal(lead?.createdAt, "2026-09-07T12:00:00.000Z");
  assert.equal(lead?.phone, "");
});
