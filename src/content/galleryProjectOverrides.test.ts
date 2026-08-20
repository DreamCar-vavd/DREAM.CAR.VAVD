import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Locale } from "@/lib/i18n/config";
import type { GalleryProjectCopy } from "./types";

const localesUnderTest: Locale[] = ["uk", "ru", "en"];

const overridesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "gallery-project-overrides.json",
);
const overrides = JSON.parse(readFileSync(overridesPath, "utf-8")) as Record<
  string,
  Record<Locale, GalleryProjectCopy>
>;

const maserati = overrides["maserati-levante"];

const knownPlaceholders = [
  "уточняется",
  "уточнюється",
  "to be confirmed",
  "information to be confirmed",
];

function containsPlaceholder(copy: GalleryProjectCopy): boolean {
  const haystack = [
    copy.title,
    copy.year,
    copy.service,
    copy.clientRequest,
    copy.result,
    ...copy.completedItems,
  ]
    .join(" ")
    .toLowerCase();
  return knownPlaceholders.some((placeholder) => haystack.includes(placeholder));
}

test("maserati-levante override exists for uk, ru and en", () => {
  assert.ok(maserati, "gallery-project-overrides.json is missing the maserati-levante entry");
  for (const locale of localesUnderTest) {
    assert.ok(maserati[locale], `maserati-levante is missing the "${locale}" override`);
  }
});

test("maserati-levante ru and en no longer contain known placeholder phrases", () => {
  assert.equal(
    containsPlaceholder(maserati.ru),
    false,
    "ru override still contains a placeholder phrase such as \"уточняется\"",
  );
  assert.equal(
    containsPlaceholder(maserati.en),
    false,
    "en override still contains a placeholder phrase such as \"to be confirmed\"",
  );
});

test("maserati-levante uk, ru and en overrides share the same field structure", () => {
  const [uk, ru, en] = localesUnderTest.map((locale) => maserati[locale]);
  const fields = (copy: GalleryProjectCopy) => Object.keys(copy).sort();
  assert.deepEqual(fields(uk), fields(ru));
  assert.deepEqual(fields(uk), fields(en));
  assert.ok(Array.isArray(uk.completedItems));
  assert.ok(Array.isArray(ru.completedItems));
  assert.ok(Array.isArray(en.completedItems));
});

test("maserati-levante required text fields are non-empty in every locale", () => {
  for (const locale of localesUnderTest) {
    const copy = maserati[locale];
    assert.ok(copy.title.trim().length > 0, `${locale}: title is empty`);
    assert.ok(copy.service.trim().length > 0, `${locale}: service is empty`);
    assert.ok(copy.clientRequest.trim().length > 0, `${locale}: clientRequest is empty`);
    assert.ok(copy.result.trim().length > 0, `${locale}: result is empty`);
    assert.ok(copy.completedItems.length > 0, `${locale}: completedItems is empty`);
    for (const item of copy.completedItems) {
      assert.ok(item.trim().length > 0, `${locale}: completedItems has an empty entry`);
    }
  }
});

test("maserati-levante uk text no longer contains the previously confirmed typos", () => {
  const ukText = [
    maserati.uk.title,
    maserati.uk.service,
    maserati.uk.clientRequest,
    maserati.uk.result,
    ...maserati.uk.completedItems,
  ].join(" ");

  assert.equal(ukText.includes("Ркомендовано"), false, 'typo "Ркомендовано" is still present');
  assert.equal(ukText.includes("Компютерна"), false, 'typo "Компютерна" (missing apostrophe) is still present');
  assert.equal(ukText.includes("невиявлені"), false, 'incorrect fragment "невиявлені" is still present');
});
