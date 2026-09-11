import { test } from "node:test";
import assert from "node:assert/strict";
import { LEADS_LIST_ERROR_MESSAGE, leadsListErrorView } from "./loadError";

// Realistic failures whose `.message` leaks connection details.
const LEAKY: Array<{ err: Error & { code?: string }; secret: string; wantCode: string }> = [
  (() => {
    const e = new Error(
      "getaddrinfo ENOTFOUND ep-cool-name-123.eu-central-1.aws.neon.tech",
    ) as Error & { code?: string };
    e.code = "ENOTFOUND";
    return { err: e, secret: "neon.tech", wantCode: "ENOTFOUND" };
  })(),
  (() => {
    const e = new Error("connect ECONNREFUSED 10.0.0.4:5432") as Error & { code?: string };
    e.code = "ECONNREFUSED";
    return { err: e, secret: "10.0.0.4", wantCode: "ECONNREFUSED" };
  })(),
  (() => {
    const e = new Error('password authentication failed for user "leads_app"') as Error & {
      code?: string;
    };
    e.code = "28P01";
    return { err: e, secret: "leads_app", wantCode: "28P01" };
  })(),
  (() => {
    const e = new Error('database "leads_prod" does not exist') as Error & { code?: string };
    e.code = "3D000";
    return { err: e, secret: "leads_prod", wantCode: "3D000" };
  })(),
];

test("the panel message is a fixed constant, never the raw error", () => {
  for (const { err } of LEAKY) {
    const v = leadsListErrorView(err);
    assert.equal(v.message, LEADS_LIST_ERROR_MESSAGE);
  }
});

test("neither the message nor the logCode contains host / port / role / db name", () => {
  for (const { err, secret } of LEAKY) {
    const v = leadsListErrorView(err);
    assert.ok(!v.message.includes(secret), `message leaked "${secret}"`);
    assert.ok(!v.logCode.includes(secret), `logCode leaked "${secret}"`);
    assert.ok(!v.logCode.includes(" "), "logCode must be a single token");
  }
});

test("logCode surfaces the coarse error code for diagnosis", () => {
  for (const { err, wantCode } of LEAKY) {
    assert.equal(leadsListErrorView(err).logCode, wantCode);
  }
});

test("falls back to the error name when there is no code", () => {
  assert.equal(leadsListErrorView(new TypeError("boom")).logCode, "TypeError");
});

test("a crafted code string cannot smuggle host text into the log", () => {
  const e = { code: "X ep-secret.neon.tech :5432 leak" };
  const v = leadsListErrorView(e);
  assert.ok(!v.logCode.includes("neon.tech"));
  assert.ok(!v.logCode.includes(" "));
  assert.ok(!v.logCode.includes(":"));
});

test("handles null / undefined / string throws without blowing up", () => {
  for (const bad of [null, undefined, "plain string", 42]) {
    const v = leadsListErrorView(bad);
    assert.equal(v.message, LEADS_LIST_ERROR_MESSAGE);
    assert.equal(v.logCode, "unknown");
  }
});
