import { test } from "node:test";
import assert from "node:assert/strict";
import { GitHubStorage } from "./github";
import {
  ConflictError,
  StorageAuthError,
  StorageForbiddenError,
  StorageRateLimitedError,
  StorageUnavailableError,
  WriteUncertainError,
} from "./adapter";

const CFG = { owner: "DreamCar-vavd", repo: "DREAM.CAR.VAVD", branch: "codex/test", token: "tok_abc" };
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

function fakeGitHub(
  routes: Record<
    string,
    (init?: RequestInit) => { status: number; body: unknown; headers?: Record<string, string> }
  >,
) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const impl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const key = Object.keys(routes).find((k) => url.includes(k));
    const res = key ? routes[key](init) : { status: 404, body: { message: "not found" } };
    return new Response(res.body === null ? "" : JSON.stringify(res.body), {
      status: res.status,
      headers: res.headers,
    });
  };
  return { impl, calls };
}

test("readFile uses the configured repo+branch and returns the blob sha as version", async () => {
  const { impl, calls } = fakeGitHub({
    "/contents/src/content/cms/review-state.json": () => ({
      status: 200,
      body: { content: b64('{"x":1}'), sha: "blobsha1", encoding: "base64" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const r = await gh.readFile("src/content/cms/review-state.json");
  assert.equal(r.data, '{"x":1}');
  assert.equal(r.version, "blobsha1");
  assert.match(calls[0].url, /repos\/DreamCar-vavd\/DREAM\.CAR\.VAVD\/contents\/src\/content\/cms\/review-state\.json\?ref=codex%2Ftest/);
});

test("a path outside the allowlist is rejected by the adapter", async () => {
  const gh = new GitHubStorage({ ...CFG, fetchImpl: fakeGitHub({}).impl });
  // @ts-expect-error deliberately passing a disallowed path
  await assert.rejects(() => gh.readFile("src/proxy.ts"), /allowlist/);
  // @ts-expect-error deliberately passing a disallowed path
  await assert.rejects(() => gh.writeFile("package.json", "{}", ""), /allowlist/);
});

test("a missing file reads as null with version ''", async () => {
  const gh = new GitHubStorage({ ...CFG, fetchImpl: fakeGitHub({}).impl });
  const r = await gh.readFile("src/content/cms/published.json");
  assert.equal(r.data, null);
  assert.equal(r.version, "");
});

test("writeFile PUTs with the expected blob sha (optimistic lock) on the configured branch", async () => {
  const { impl, calls } = fakeGitHub({
    "/contents/src/content/cms/published.json": (init) =>
      init?.method === "PUT"
        ? { status: 200, body: { content: { sha: "newsha" } } }
        : { status: 404, body: null },
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const out = await gh.writeFile("src/content/cms/published.json", "{}\n", "oldsha");
  assert.equal(out.version, "newsha");
  const put = calls.find((c) => c.method === "PUT")!;
  assert.equal((put.body as { sha: string }).sha, "oldsha");
  assert.equal((put.body as { branch: string }).branch, "codex/test");
});

test("creating a new file omits sha (no expectedVersion)", async () => {
  const { impl, calls } = fakeGitHub({
    "/contents/src/content/cms/review-state.json": () => ({ status: 201, body: { content: { sha: "s" } } }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  await gh.writeFile("src/content/cms/review-state.json", "{}\n", "");
  assert.equal("sha" in (calls.find((c) => c.method === "PUT")!.body as object), false);
});

test("a 409 from GitHub becomes ConflictError, not a silent overwrite", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/published.json": () => ({ status: 409, body: { message: "no match" } }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  await assert.rejects(
    () => gh.writeFile("src/content/cms/published.json", "{}\n", "stale"),
    ConflictError,
  );
});

test("readDir lists the fixed dir, fetches each file, version = tree of blob shas", async () => {
  const { impl, calls } = fakeGitHub({
    "/contents/src/content/cms/cars?ref=": () => ({
      status: 200,
      body: [
        { name: "b.json", sha: "sb", type: "file" },
        { name: "a.json", sha: "sa", type: "file" },
        { name: ".keep", sha: "sk", type: "file" },
      ],
    }),
    "/contents/src/content/cms/cars/a.json": () => ({
      status: 200,
      body: { content: b64('{"id":"a"}'), sha: "sa", encoding: "base64" },
    }),
    "/contents/src/content/cms/cars/b.json": () => ({
      status: 200,
      body: { content: b64('{"id":"b"}'), sha: "sb", encoding: "base64" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const r = await gh.readDir("src/content/cms/cars");
  assert.deepEqual(r.data.map((e) => e.name), ["a.json", "b.json"]);
  assert.equal(r.version, "a.json:sa|b.json:sb");
  assert.equal(calls.filter((c) => c.url.includes("/cars/") && c.url.includes(".json")).length, 2);
});

test("deployStatus maps GitHub deployment status to panel states + flags a test branch", async () => {
  const make = (state: string) =>
    fakeGitHub({
      "/commits/codex%2Ftest": () => ({ status: 200, body: { sha: "head1" } }),
      "/deployments?sha=head1": () => ({
        status: 200,
        body: [{ id: 7, environment: "Preview", created_at: "2026-09-06T00:00:00Z" }],
      }),
      "/deployments/7/statuses": () => ({
        status: 200,
        body: [{ state, environment_url: "https://preview.example" }],
      }),
    }).impl;

  for (const [gh, want] of [
    ["success", "ready"],
    ["in_progress", "pending"],
    ["queued", "pending"],
    ["failure", "error"],
    ["error", "error"],
  ] as const) {
    const s = new GitHubStorage({ ...CFG, fetchImpl: make(gh) });
    const d = await s.deployStatus();
    assert.equal(d.state, want, `${gh} -> ${want}`);
    assert.equal("isTest" in d && d.isTest, true); // branch codex/test != main
    assert.equal("environment" in d && d.environment, "Preview");
  }
});

test("deployStatus reports 'unknown' (not a false 'ready') when it lacks Deployments:Read", async () => {
  const { impl } = fakeGitHub({
    "/commits/codex%2Ftest": () => ({ status: 200, body: { sha: "head1" } }),
    "/deployments?sha=head1": () => ({ status: 403, body: { message: "Resource not accessible" } }),
  });
  const s = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const d = await s.deployStatus();
  assert.equal(d.state, "unknown");
  assert.match("reason" in d ? d.reason : "", /Deployments: Read|обмеження/);
});

test("deployStatus picks the newest deployment when several exist for one SHA", async () => {
  const { impl } = fakeGitHub({
    "/commits/codex%2Ftest": () => ({ status: 200, body: { sha: "head1" } }),
    "/deployments?sha=head1": () => ({
      status: 200,
      body: [
        { id: 1, environment: "Preview", created_at: "2026-09-06T10:00:00Z" },
        { id: 2, environment: "Preview", created_at: "2026-09-06T12:00:00Z" },
      ],
    }),
    "/deployments/2/statuses": () => ({ status: 200, body: [{ state: "success" }] }),
    "/deployments/1/statuses": () => ({ status: 200, body: [{ state: "error" }] }),
  });
  const s = new GitHubStorage({ ...CFG, fetchImpl: impl });
  assert.equal((await s.deployStatus()).state, "ready");
});

// ---------------------------------------------------------------------------
// Network-failure handling: bounded waits, right error class, no auto-retry
// ---------------------------------------------------------------------------

/** Short budgets so "hang" tests finish in tens of ms, not seconds. */
const FAST = { requestTimeoutMs: 40, operationTimeoutMs: 300 };
const econnreset = () => Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
const abortOnSignal = (init?: RequestInit): Promise<never> =>
  new Promise((_res, rej) => {
    init?.signal?.addEventListener("abort", () =>
      rej(new DOMException("The operation was aborted", "AbortError")),
    );
  });

test("a request that never responds is aborted and reported as StorageUnavailableError", async () => {
  const impl: typeof fetch = (_input, init) => abortOnSignal(init);
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  const started = Date.now();
  await assert.rejects(() => gh.readFile("src/content/cms/published.json"), StorageUnavailableError);
  assert.ok(Date.now() - started < 200, "bailed near the request timeout, not later");
});

test("a response whose body never finishes is also aborted (StorageUnavailableError)", async () => {
  const impl: typeof fetch = async (_input, init) =>
    ({ status: 200, text: () => abortOnSignal(init) }) as unknown as Response;
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readFile("src/content/cms/published.json"), StorageUnavailableError);
});

test("a dropped connection (ECONNRESET) on a read is StorageUnavailableError", async () => {
  const impl: typeof fetch = async () => {
    throw econnreset();
  };
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readDir("src/content/cms/cars"), StorageUnavailableError);
});

test("a normal response still works with timeouts configured", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/review-state.json": () => ({
      status: 200,
      body: { content: Buffer.from('{"ok":1}').toString("base64"), sha: "s9", encoding: "base64" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  const r = await gh.readFile("src/content/cms/review-state.json");
  assert.equal(r.data, '{"ok":1}');
  assert.equal(r.version, "s9");
});

test("a dropped connection on writeFile is WriteUncertainError and does NOT auto-retry", async () => {
  let puts = 0;
  const impl: typeof fetch = async (_input, init) => {
    if ((init?.method ?? "GET") === "PUT") {
      puts += 1;
      throw econnreset();
    }
    return new Response("{}", { status: 404 });
  };
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(
    () => gh.writeFile("src/content/cms/published.json", "{}\n", "sha"),
    WriteUncertainError,
  );
  assert.equal(puts, 1, "exactly one PUT — the adapter never retries a write");
});

test("deployStatus degrades to 'unknown' when GitHub is unreachable (no throw, content can still render)", async () => {
  const impl: typeof fetch = async () => {
    throw econnreset();
  };
  const s = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  const d = await s.deployStatus();
  assert.equal(d.state, "unknown");
  assert.equal("isTest" in d && d.isTest, true);
});

test("the whole-instance budget caps a slow directory listing — no unbounded total wait", async () => {
  const listBody = Array.from({ length: 20 }, (_, i) => ({
    name: `f${i}.json`,
    sha: `s${i}`,
    type: "file",
  }));
  const impl: typeof fetch = (input) =>
    new Promise((res) => {
      const url = String(input);
      setTimeout(() => {
        res(
          url.includes("/contents/src/content/cms/cars?ref=")
            ? new Response(JSON.stringify(listBody), { status: 200 })
            : new Response(
                JSON.stringify({ content: Buffer.from("{}").toString("base64"), sha: "x", encoding: "base64" }),
                { status: 200 },
              ),
        );
      }, 25);
    });
  const gh = new GitHubStorage({
    ...CFG,
    fetchImpl: impl,
    requestTimeoutMs: 1000,
    operationTimeoutMs: 120,
  });
  const started = Date.now();
  await assert.rejects(() => gh.readDir("src/content/cms/cars"), StorageUnavailableError);
  assert.ok(Date.now() - started < 400, "stopped at the budget, did not wait for all 20 files");
});

test("401 on a read = the session is gone -> StorageAuthError", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/published.json": () => ({
      status: 401,
      body: { message: "Bad credentials" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readFile("src/content/cms/published.json"), StorageAuthError);
});

test("403 'Resource not accessible' = permission narrowed -> StorageForbiddenError (NOT a re-login prompt)", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/cars?ref=": () => ({
      status: 403,
      body: { message: "Resource not accessible by integration" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readDir("src/content/cms/cars"), (e: Error) => {
    assert.ok(e instanceof StorageForbiddenError);
    assert.ok(!(e instanceof StorageAuthError));
    assert.doesNotMatch(e.message, /Resource not accessible|Bearer|integration/); // no raw body
    return true;
  });
});

test("403 with x-ratelimit-remaining: 0 = rate limited -> StorageRateLimitedError (retriable)", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/published.json": () => ({
      status: 403,
      body: { message: "API rate limit exceeded for installation" },
      headers: { "x-ratelimit-remaining": "0" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readFile("src/content/cms/published.json"), (e: Error) => {
    assert.ok(e instanceof StorageRateLimitedError);
    assert.equal((e as StorageRateLimitedError).retriable, true);
    return true;
  });
});

test("a 403 with no conclusive signal -> StorageForbiddenError with neutral wording (no invented cause)", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/published.json": () => ({ status: 403, body: {} }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readFile("src/content/cms/published.json"), (e: Error) => {
    assert.ok(e instanceof StorageForbiddenError);
    assert.doesNotMatch(e.message, /сесі|увійд|rate limit/i); // doesn't claim session-ended or rate-limit
    return true;
  });
});

test("secondary rate limit (body text, no header) -> StorageRateLimitedError, no invented wait time", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/published.json": () => ({
      status: 403,
      body: { message: "You have exceeded a secondary rate limit" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readFile("src/content/cms/published.json"), (e: Error) => {
    assert.ok(e instanceof StorageRateLimitedError);
    assert.match(e.message, /спробуйте пізніше/i);
    assert.doesNotMatch(e.message, /за \d+ (с|хв)|близько хвилини/i); // no fabricated duration
    return true;
  });
});

test("HTTP 429 (not 403) is also a rate limit -> StorageRateLimitedError", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/review-state.json": () => ({ status: 429, body: { message: "Too Many Requests" } }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readFile("src/content/cms/review-state.json"), StorageRateLimitedError);
});

test("a rate limit with Retry-After puts the real wait time in the message, not a guess", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/published.json": () => ({
      status: 429,
      body: { message: "Too Many Requests" },
      headers: { "retry-after": "120" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readFile("src/content/cms/published.json"), (e: Error) => {
    assert.ok(e instanceof StorageRateLimitedError);
    assert.match(e.message, /за 2 хв/); // 120s -> "2 хв"
    assert.doesNotMatch(e.message, /пізніше/);
    return true;
  });
});

test("a rate limit with x-ratelimit-reset (unix seconds) derives the wait from it", async () => {
  const resetInSeconds = 45;
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/published.json": () => ({
      status: 403,
      body: { message: "API rate limit exceeded" },
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + resetInSeconds),
      },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(() => gh.readFile("src/content/cms/published.json"), (e: Error) => {
    assert.match(e.message, /за \d+ с/); // ~45s -> seconds form
    return true;
  });
});

test("budget already spent before a write: the PUT is never sent -> StorageUnavailableError (NOT WriteUncertain)", async () => {
  let puts = 0;
  const impl: typeof fetch = async (_i, init) => {
    if ((init?.method ?? "GET") === "PUT") puts += 1;
    return new Response("{}", { status: 200 });
  };
  const gh = new GitHubStorage({
    ...CFG,
    fetchImpl: impl,
    requestTimeoutMs: 1000,
    operationTimeoutMs: 0, // budget is spent the instant the storage is created
  });
  await assert.rejects(
    () => gh.writeFile("src/content/cms/published.json", "{}\n", "sha"),
    (e: Error) => e.name === "StorageUnavailableError" && !(e instanceof WriteUncertainError),
  );
  assert.equal(puts, 0, "nothing was sent, so retrying is safe — not 'uncertain'");
});

test("conflict, allowlist and branch guarantees are unchanged with timeouts on", async () => {
  const { impl, calls } = fakeGitHub({
    "/contents/src/content/cms/published.json": () => ({ status: 409, body: { message: "no match" } }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl, ...FAST });
  await assert.rejects(
    () => gh.writeFile("src/content/cms/published.json", "{}\n", "stale"),
    ConflictError,
  );
  assert.match(calls[0].url, /ref=codex%2Ftest|contents\/src\/content\/cms\/published\.json/);
});

test("readMedia falls back to the blob API for a file over 1 MB (contents API drops `content`)", async () => {
  const big = Buffer.alloc(1_500_000, 7); // >1 MB
  const { impl, calls } = fakeGitHub({
    "/contents/public/images/cms/cars/x/photos/0/image.jpg": () => ({
      status: 200,
      body: { sha: "bigsha", encoding: "none", size: big.length }, // no `content`
    }),
    "/git/blobs/bigsha": () => ({
      status: 200,
      body: { content: big.toString("base64"), encoding: "base64", sha: "bigsha" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const bytes = await gh.readMedia("public/images/cms/cars/x/photos/0/image.jpg");
  assert.equal(bytes?.length, big.length);
  assert.ok(calls.some((c) => c.url.includes("/git/blobs/bigsha")));
});

test("readMedia decodes a small file straight from the contents API (no blob call)", async () => {
  const small = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
  const { impl, calls } = fakeGitHub({
    "/contents/public/images/cms/cars/x/photos/0/image.jpg": () => ({
      status: 200,
      body: { sha: "s1", encoding: "base64", content: small.toString("base64") },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const bytes = await gh.readMedia("public/images/cms/cars/x/photos/0/image.jpg");
  assert.deepEqual([...(bytes ?? [])], [...small]);
  assert.ok(!calls.some((c) => c.url.includes("/git/blobs/")));
});

// ---------------------------------------------------------------------------
// headSha / mediaIndex / deletePublishedMediaBatch (task 2026-09-09 §1–§4)
// ---------------------------------------------------------------------------

test("headSha returns the branch head commit sha", async () => {
  const { impl } = fakeGitHub({
    "/commits/codex%2Ftest": () => ({ status: 200, body: { sha: "HEAD1" } }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  assert.equal(await gh.headSha(), "HEAD1");
});

test("headSha throws (not null) when the branch head cannot be determined", async () => {
  const { impl } = fakeGitHub({
    "/commits/codex%2Ftest": () => ({ status: 404, body: { message: "no" } }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  await assert.rejects(() => gh.headSha(), StorageUnavailableError);
});

test("mediaIndex reads one recursive tree and returns git blob ids + sizes for public/images/cms only", async () => {
  const { impl, calls } = fakeGitHub({
    "/commits/codex%2Ftest": () => ({ status: 200, body: { sha: "HEAD1" } }),
    "/git/commits/HEAD1": () => ({ status: 200, body: { tree: { sha: "T1" } } }),
    "/git/trees/T1": () => ({
      status: 200,
      body: {
        truncated: false,
        tree: [
          { path: "public/images/cms/services/s1/_pub/abababab.jpg", type: "blob", sha: "BLOB_A", size: 1_200_000 },
          { path: "public/images/cms/services/s1/photos/0/image.jpg", type: "blob", sha: "BLOB_B", size: 900 },
          { path: "src/content/cms/published.json", type: "blob", sha: "BLOB_X", size: 10 },
          { path: "public/images/cms/services/s1", type: "tree", sha: "TREE_Y" },
        ],
      },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const idx = await gh.mediaIndex();
  assert.equal(idx.size, 2);
  assert.deepEqual(idx.get("public/images/cms/services/s1/_pub/abababab.jpg"), { id: "BLOB_A", size: 1_200_000 });
  assert.deepEqual(idx.get("public/images/cms/services/s1/photos/0/image.jpg"), { id: "BLOB_B", size: 900 });
  assert.ok(!idx.has("src/content/cms/published.json"));
  assert.equal(calls.filter((c) => c.url.includes("/git/trees/")).length, 1); // exactly one tree fetch
});

test("mediaIndex refuses a truncated tree rather than reporting a partial state as 'in sync'", async () => {
  const { impl } = fakeGitHub({
    "/commits/codex%2Ftest": () => ({ status: 200, body: { sha: "HEAD1" } }),
    "/git/commits/HEAD1": () => ({ status: 200, body: { tree: { sha: "T1" } } }),
    "/git/trees/T1": () => ({ status: 200, body: { truncated: true, tree: [] } }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  await assert.rejects(() => gh.mediaIndex(), StorageUnavailableError);
});

test("mediaIndex surfaces a GitHub read error — never an empty (='all in sync') index", async () => {
  const { impl } = fakeGitHub({
    "/commits/codex%2Ftest": () => ({ status: 200, body: { sha: "HEAD1" } }),
    "/git/commits/HEAD1": () => ({ status: 200, body: { tree: { sha: "T1" } } }),
    "/git/trees/T1": () => ({ status: 500, body: { message: "boom" } }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  await assert.rejects(() => gh.mediaIndex(), StorageUnavailableError);
});

function batchRoutes(over: Partial<Record<string, (init?: RequestInit) => { status: number; body: unknown }>> = {}) {
  return {
    "/commits/codex%2Ftest": () => ({ status: 200, body: { sha: "HEAD1" } }),
    "/git/commits": (init?: RequestInit) =>
      init?.method === "POST"
        ? { status: 201, body: { sha: "NEWCOMMIT" } }
        : { status: 200, body: { tree: { sha: "T1" } } },
    "/git/trees": (init?: RequestInit) =>
      init?.method === "POST"
        ? { status: 201, body: { sha: "NEWTREE" } }
        : {
            status: 200,
            body: {
              tree: [
                { path: "public/images/cms/services/s1/_pub/aaaaaaaa.jpg", type: "blob" },
                { path: "public/images/cms/services/s1/_pub/bbbbbbbb.jpg", type: "blob" },
              ],
            },
          },
    "/git/refs/heads/codex%2Ftest": () => ({ status: 200, body: { object: { sha: "NEWCOMMIT" } } }),
    ...over,
  };
}

test("deletePublishedMediaBatch: atomic commit removes present paths, reports missing ones as already-absent", async () => {
  const { impl, calls } = fakeGitHub(batchRoutes());
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const out = await gh.deletePublishedMediaBatch(
    [
      "public/images/cms/services/s1/_pub/bbbbbbbb.jpg",
      "public/images/cms/services/s1/_pub/cccccccc.jpg",
    ],
    "HEAD1",
  );
  assert.deepEqual(out, [
    { path: "public/images/cms/services/s1/_pub/bbbbbbbb.jpg", outcome: "deleted" },
    { path: "public/images/cms/services/s1/_pub/cccccccc.jpg", outcome: "already-absent" },
  ]);
  const newTree = calls.find((c) => c.url.endsWith("/git/trees") && c.method === "POST");
  assert.ok(newTree);
  assert.deepEqual((newTree!.body as { tree: { path: string; sha: null }[] }).tree, [
    { path: "public/images/cms/services/s1/_pub/bbbbbbbb.jpg", mode: "100644", type: "blob", sha: null },
  ]);
  const patch = calls.find((c) => c.url.includes("/git/refs/heads/") && c.method === "PATCH");
  assert.equal((patch!.body as { force: boolean }).force, false); // non-force = compare-and-swap
});

test("deletePublishedMediaBatch: expected head stale -> ConflictError, nothing committed", async () => {
  const { impl, calls } = fakeGitHub(batchRoutes());
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  await assert.rejects(
    () => gh.deletePublishedMediaBatch(["public/images/cms/services/s1/_pub/bbbbbbbb.jpg"], "OLDHEAD"),
    ConflictError,
  );
  assert.ok(!calls.some((c) => c.method === "POST")); // no tree/commit writes attempted
});

test("deletePublishedMediaBatch: a 422 on the non-force ref update is a ConflictError (HEAD moved mid-flight)", async () => {
  const { impl } = fakeGitHub(
    batchRoutes({ "/git/refs/heads/codex%2Ftest": () => ({ status: 422, body: { message: "not a fast forward" } }) }),
  );
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  await assert.rejects(
    () => gh.deletePublishedMediaBatch(["public/images/cms/services/s1/_pub/bbbbbbbb.jpg"], "HEAD1"),
    ConflictError,
  );
});

test("deletePublishedMediaBatch: no matching paths -> no commit, all already-absent", async () => {
  const { impl, calls } = fakeGitHub(batchRoutes());
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const out = await gh.deletePublishedMediaBatch(
    ["public/images/cms/services/s1/_pub/cccccccc.jpg"],
    "HEAD1",
  );
  assert.deepEqual(out, [
    { path: "public/images/cms/services/s1/_pub/cccccccc.jpg", outcome: "already-absent" },
  ]);
  assert.ok(!calls.some((c) => c.method === "POST"));
});

test("deletePublishedMediaBatch rejects a non-_pub path before any network call", async () => {
  const { impl, calls } = fakeGitHub(batchRoutes());
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  await assert.rejects(() =>
    gh.deletePublishedMediaBatch(["public/images/cms/services/s1/photos/0/image.jpg"], "HEAD1"),
  );
  assert.equal(calls.length, 0);
});
