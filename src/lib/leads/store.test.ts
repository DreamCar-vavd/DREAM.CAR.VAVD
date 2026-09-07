import { test } from "node:test";
import assert from "node:assert/strict";
import { getLeadsStore } from "./store";

test("with no LEADS_DATABASE_URL, the store is the demo store and every row is flagged demo", async () => {
  delete process.env.LEADS_DATABASE_URL;
  const store = await getLeadsStore();
  assert.equal(store.kind, "demo");
  const page = await store.list({ limit: 10 });
  assert.equal(page.leads.length, 10);
  assert.ok(page.leads.every((l) => l.demo === true));
  assert.ok(page.total && page.total > 10);
});

test("demo rows are newest-first and carry the required fields", async () => {
  delete process.env.LEADS_DATABASE_URL;
  const store = await getLeadsStore();
  const { leads } = await store.list({ limit: 20 });
  for (let i = 1; i < leads.length; i++) {
    assert.ok(leads[i - 1].createdAt >= leads[i].createdAt, "not sorted desc by date");
  }
  for (const l of leads) {
    for (const f of ["id", "createdAt", "name", "phone", "service"] as const) {
      assert.ok(typeof l[f] === "string", `${f} missing`);
    }
  }
});

test("pagination walks the whole set once, without overlap, then stops", async () => {
  delete process.env.LEADS_DATABASE_URL;
  const store = await getLeadsStore();
  const seen = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const p: Awaited<ReturnType<typeof store.list>> = await store.list({ limit: 10, cursor });
    p.leads.forEach((l) => seen.add(l.id));
    cursor = p.nextCursor;
    pages += 1;
    assert.ok(pages < 20, "cursor never terminated");
  } while (cursor);
  const first = await store.list({ limit: 1 });
  assert.equal(seen.size, first.total);
});

test("get() returns one demo row by id, null for anything else", async () => {
  delete process.env.LEADS_DATABASE_URL;
  const store = await getLeadsStore();
  const one = await store.get("demo-003");
  assert.equal(one?.id, "demo-003");
  assert.equal(await store.get("demo-999"), null);
  assert.equal(await store.get("../secrets"), null);
});

test("a set LEADS_DATABASE_URL selects the Postgres store, never demo data", async () => {
  process.env.LEADS_DATABASE_URL = "postgres://user:pass@127.0.0.1:1/nonexistent";
  try {
    const store = await getLeadsStore();
    assert.equal(store.kind, "database");
    // An unreachable DB throws a connection error — it does NOT return demo rows.
    await assert.rejects(() => store.list({ limit: 5 }));
  } finally {
    delete process.env.LEADS_DATABASE_URL;
  }
});
