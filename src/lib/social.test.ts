import { test } from "node:test";
import assert from "node:assert/strict";
import { getSocialLinks } from "./social";

test("getSocialLinks returns the permanent Telegram URL regardless of env vars", () => {
  const telegram = getSocialLinks().find((link) => link.name === "Telegram");
  assert.ok(telegram, "Telegram link is missing from getSocialLinks()");
  assert.equal(telegram.url, "https://t.me/DREAM_CAR_VAVD");
});
