import { test } from "node:test";
import assert from "node:assert/strict";
import { getLeadsStore, resolveLeadsMode } from "./store";

// `@types/node` types NODE_ENV as read-only; the runtime object is a plain
// mutable env map. This narrow helper keeps the tests honest without `any`.
const env = process.env as Record<string, string | undefined>;
function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete env[key];
  else env[key] = value;
}

test("resolveLeadsMode: DB url wins; else demo in dev / when explicitly on; else not-configured", () => {
  const orig = { url: process.env.LEADS_DATABASE_URL, demo: process.env.LEADS_DEMO_MODE };
  try {
    delete process.env.LEADS_DATABASE_URL;
    delete process.env.LEADS_DEMO_MODE;
    // node:test runs with NODE_ENV !== "production" -> dev -> demo
    assert.equal(resolveLeadsMode(), "demo");

    process.env.LEADS_DEMO_MODE = "1";
    assert.equal(resolveLeadsMode(), "demo");

    process.env.LEADS_DATABASE_URL = "postgres://x";
    assert.equal(resolveLeadsMode(), "database");
  } finally {
    if (orig.url === undefined) delete process.env.LEADS_DATABASE_URL;
    else process.env.LEADS_DATABASE_URL = orig.url;
    if (orig.demo === undefined) delete process.env.LEADS_DEMO_MODE;
    else process.env.LEADS_DEMO_MODE = orig.demo;
  }
});

test("HOSTED (NODE_ENV=production) with no LEADS_DATABASE_URL and no LEADS_DEMO_MODE -> 'not-configured', never demo", () => {
  // This is what runs on the Vercel Preview / Production deployment: the panel
  // must NOT show synthetic rows there — the owner could mistake them for real
  // enquiries. Demo is opt-in (LEADS_DEMO_MODE=1) or local-dev only.
  const orig = {
    url: process.env.LEADS_DATABASE_URL,
    demo: process.env.LEADS_DEMO_MODE,
    env: process.env.NODE_ENV,
  };
  try {
    setEnv("LEADS_DATABASE_URL", undefined);
    setEnv("LEADS_DEMO_MODE", undefined);
    setEnv("NODE_ENV", "production");
    assert.equal(resolveLeadsMode(), "not-configured");

    // Explicit opt-in still works even in production (a deliberate test toggle).
    setEnv("LEADS_DEMO_MODE", "1");
    assert.equal(resolveLeadsMode(), "demo");
  } finally {
    setEnv("LEADS_DATABASE_URL", orig.url);
    setEnv("LEADS_DEMO_MODE", orig.demo);
    setEnv("NODE_ENV", orig.env);
  }
});

test("not-configured store: empty list, null everything — and it is NOT the demo store", async () => {
  const orig = { url: process.env.LEADS_DATABASE_URL, demo: process.env.LEADS_DEMO_MODE, env: process.env.NODE_ENV };
  try {
    setEnv("LEADS_DATABASE_URL", undefined);
    setEnv("LEADS_DEMO_MODE", undefined);
    setEnv("NODE_ENV", "production");
    const store = await getLeadsStore();
    assert.equal(store.kind, "not-configured");
    const page = await store.list({ limit: 20 });
    assert.deepEqual(page, { leads: [], nextCursor: null, total: null });
    assert.equal(await store.get("demo-001"), null);
  } finally {
    setEnv("LEADS_DATABASE_URL", orig.url);
    setEnv("LEADS_DEMO_MODE", orig.demo);
    setEnv("NODE_ENV", orig.env);
  }
});

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
