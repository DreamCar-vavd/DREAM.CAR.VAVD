import { test } from "node:test";
import assert from "node:assert/strict";
import { GitHubStorage } from "./github";
import { ConflictError } from "./adapter";

const CFG = { owner: "DreamCar-vavd", repo: "DREAM.CAR.VAVD", branch: "codex/test", token: "tok_abc" };
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

/** Minimal fake of the GitHub REST endpoints the adapter uses. */
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

test("reads a JSON file from the configured repo+branch and returns its blob sha as version", async () => {
  const { impl, calls } = fakeGitHub({
    "/contents/src/content/cms/review-state.json": () => ({
      status: 200,
      body: { content: b64('{"x":1}'), sha: "blobsha1", encoding: "base64" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const r = await gh.readReview();
  assert.deepEqual(r.data, { x: 1 });
  assert.equal(r.version, "blobsha1");
  assert.match(calls[0].url, /repos\/DreamCar-vavd\/DREAM\.CAR\.VAVD\/contents\/src\/content\/cms\/review-state\.json\?ref=codex%2Ftest/);
});

test("a missing file reads as empty with version ''", async () => {
  const { impl } = fakeGitHub({});
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const r = await gh.readPublished();
  assert.deepEqual(r.data, { publishedAt: "", cars: [] });
  assert.equal(r.version, "");
});

test("writePublished PUTs with the expected blob sha (optimistic lock) and returns the new sha", async () => {
  const { impl, calls } = fakeGitHub({
    "/contents/src/content/cms/published.json": (init) => {
      if (init?.method === "PUT") return { status: 200, body: { content: { sha: "newsha" }, commit: { sha: "c1" } } };
      return { status: 404, body: null };
    },
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const out = await gh.writePublished({ publishedAt: "t", cars: [] }, "oldsha");
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
  await gh.writeReview({}, "");
  const put = calls.find((c) => c.method === "PUT")!;
  assert.equal("sha" in (put.body as object), false);
});

test("a 409 from GitHub becomes ConflictError, not a silent overwrite", async () => {
  const { impl } = fakeGitHub({
    "/contents/src/content/cms/published.json": () => ({ status: 409, body: { message: "does not match" } }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  await assert.rejects(() => gh.writePublished({ publishedAt: "t", cars: [] }, "stale"), ConflictError);
});

test("readWorkingCars lists the fixed dir then fetches each car file", async () => {
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
      body: { content: b64('{"order":1,"uk":{"title":"A"}}'), sha: "sa", encoding: "base64" },
    }),
    "/contents/src/content/cms/cars/b.json": () => ({
      status: 200,
      body: { content: b64('{"order":2,"uk":{"title":"B"}}'), sha: "sb", encoding: "base64" },
    }),
  });
  const gh = new GitHubStorage({ ...CFG, fetchImpl: impl });
  const r = await gh.readWorkingCars();
  assert.deepEqual(r.data.map((c) => c.id), ["a", "b"]);
  assert.equal(r.version, "a.json:sa|b.json:sb");
  assert.equal(calls.filter((c) => c.url.includes("/cars/") && c.url.includes(".json")).length, 2);
});

test("deployStatus maps GitHub deployment status to panel states", async () => {
  const make = (state: string) =>
    fakeGitHub({
      "/commits/codex%2Ftest": () => ({ status: 200, body: { sha: "head1" } }),
      "/deployments?sha=head1": () => ({ status: 200, body: [{ id: 7 }] }),
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
    assert.equal((await s.deployStatus()).state, want, `${gh} -> ${want}`);
  }
});
