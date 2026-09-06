import { test } from "node:test";
import assert from "node:assert/strict";
import { GitHubStorage } from "./github";
import { ConflictError } from "./adapter";

const CFG = { owner: "DreamCar-vavd", repo: "DREAM.CAR.VAVD", branch: "codex/test", token: "tok_abc" };
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

function fakeGitHub(routes: Record<string, (init?: RequestInit) => { status: number; body: unknown }>) {
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
    return new Response(res.body === null ? "" : JSON.stringify(res.body), { status: res.status });
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
