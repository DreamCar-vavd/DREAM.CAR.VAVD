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

const KEYS = { current: "key-cur", previous: "key-prev" };

test("create: no existing key -> checks both keys, then INSERT ... ON CONFLICT", async () => {
  const { db, calls } = fakeDb([
    { rows: [], rowCount: 0 }, // dedup SELECT (current, previous) — none
    { rows: [{ id: "11111111-1111-1111-1111-111111111111" }] }, // INSERT
  ]);
  const store = createPgLeadsStore(db);
  const r = await store.create(input, KEYS);
  assert.deepEqual(r, { id: "11111111-1111-1111-1111-111111111111", inserted: true });
  assert.match(calls[0].text, /SELECT id FROM leads WHERE idempotency_key IN \(\$1, \$2\)/);
  assert.deepEqual(calls[0].params, ["key-cur", "key-prev"]);
  assert.match(calls[1].text, /INSERT INTO leads .* ON CONFLICT \(idempotency_key\) DO NOTHING RETURNING id/);
  assert.deepEqual(calls[1].params, [
    input.name, input.phone, input.email, input.service, input.vehicle, input.message, "key-cur",
  ]);
});

test("create: a boundary retry stored under the PREVIOUS key -> inserted:false, no INSERT", async () => {
  const { db, calls } = fakeDb([
    { rows: [{ id: "22222222-2222-2222-2222-222222222222" }] }, // dedup SELECT matched previous
  ]);
  const store = createPgLeadsStore(db);
  const r = await store.create(input, KEYS);
  assert.deepEqual(r, { id: "22222222-2222-2222-2222-222222222222", inserted: false });
  assert.equal(calls.length, 1); // never reached the INSERT
});

test("create: a concurrent insert wins the race (0 rows from INSERT) -> re-select current key", async () => {
  const { db, calls } = fakeDb([
    { rows: [], rowCount: 0 }, // dedup SELECT — none yet
    { rows: [], rowCount: 0 }, // INSERT lost the ON CONFLICT race
    { rows: [{ id: "33333333-3333-3333-3333-333333333333" }] }, // re-select current
  ]);
  const store = createPgLeadsStore(db);
  const r = await store.create(input, KEYS);
  assert.deepEqual(r, { id: "33333333-3333-3333-3333-333333333333", inserted: false });
  assert.match(calls[2].text, /SELECT id FROM leads WHERE idempotency_key = \$1/);
});

test("create: a failing db query rejects — the caller (contact route) swallows it and still emails", async () => {
  const db: Queryable = {
    async query() {
      throw Object.assign(new Error("connect ECONNREFUSED 10.0.0.4:5432"), { code: "ECONNREFUSED" });
    },
  };
  await assert.rejects(() => createPgLeadsStore(db).create(input, KEYS), /ECONNREFUSED/);
});

test("list: an empty table -> no rows, no cursor, total 0", async () => {
  const { db } = fakeDb([{ rows: [] }, { rows: [{ n: "0" }] }]);
  const page = await createPgLeadsStore(db).list({ limit: 20 });
  assert.deepEqual(page, { leads: [], nextCursor: null, total: 0 });
});

test("list: a read failure rejects (surfaced by the page as a generic message, not the raw error)", async () => {
  const db: Queryable = {
    async query() {
      throw Object.assign(new Error('password authentication failed for user "leads_app"'), {
        code: "28P01",
      });
    },
  };
  await assert.rejects(() => createPgLeadsStore(db).list({ limit: 20 }));
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
