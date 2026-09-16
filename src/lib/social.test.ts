import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSocialLinks, resolveTelegramUrl } from "./social";

const PERMANENT_TELEGRAM_URL = "https://t.me/DREAM_CAR_VAVD";

test("getSocialLinks returns the permanent Telegram URL regardless of env vars", () => {
  const telegram = getSocialLinks().find((link) => link.name === "Telegram");
  assert.ok(telegram, "Telegram link is missing from getSocialLinks()");
  assert.equal(telegram.url, PERMANENT_TELEGRAM_URL);
});

test("getSocialLinks: a published override still wins over the permanent default", () => {
  const telegram = getSocialLinks({ telegramUrl: "https://t.me/some_other_handle" }).find(
    (link) => link.name === "Telegram",
  );
  assert.equal(telegram?.url, "https://t.me/some_other_handle");
});

// resolveTelegramUrl is the single fallback rule shared by getSocialLinks()
// (above) and getDictionary() (src/lib/i18n/dictionaries.ts) — covering it
// directly, for both the "nothing published" and "something published"
// cases, is what actually exercises the logic getDictionary() runs, not
// just a call into getSocialLinks() in isolation.
test("resolveTelegramUrl: empty, missing, or whitespace-only falls back to the permanent handle", () => {
  assert.equal(resolveTelegramUrl(undefined), PERMANENT_TELEGRAM_URL);
  assert.equal(resolveTelegramUrl(null), PERMANENT_TELEGRAM_URL);
  assert.equal(resolveTelegramUrl(""), PERMANENT_TELEGRAM_URL);
  assert.equal(resolveTelegramUrl("   "), PERMANENT_TELEGRAM_URL);
});

test("resolveTelegramUrl: a non-empty published value is used as-is", () => {
  assert.equal(resolveTelegramUrl("https://t.me/some_other_handle"), "https://t.me/some_other_handle");
  assert.equal(resolveTelegramUrl("  https://t.me/padded  "), "https://t.me/padded");
});

test("getDictionary's contact.telegramUrl is wired through resolveTelegramUrl, not a second fallback", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, "i18n", "dictionaries.ts"), "utf8");
  assert.match(
    source,
    /telegramUrl:\s*resolveTelegramUrl\(/,
    "dictionaries.ts should resolve telegramUrl via the shared resolveTelegramUrl(), not its own inline fallback",
  );
  assert.ok(
    !source.includes("NEXT_PUBLIC_TELEGRAM_URL"),
    "dictionaries.ts must not read the removed NEXT_PUBLIC_TELEGRAM_URL env var",
  );
});
