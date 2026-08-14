import { test } from "node:test";
import assert from "node:assert/strict";
import uk from "./dictionaries/uk";
import ru from "./dictionaries/ru";
import en from "./dictionaries/en";
import { serviceSlugs } from "./services";

function keys(obj: object): string[] {
  return Object.keys(obj).sort();
}

test("all locale dictionaries expose the same top-level keys", () => {
  assert.deepEqual(keys(uk), keys(ru));
  assert.deepEqual(keys(uk), keys(en));
});

test("all locale dictionaries define the same service slugs", () => {
  assert.deepEqual(keys(uk.services), keys(ru.services));
  assert.deepEqual(keys(uk.services), keys(en.services));
  assert.deepEqual(keys(uk.services).sort(), [...serviceSlugs].sort());
});

test("every service entry has non-empty required fields", () => {
  for (const dict of [uk, ru, en]) {
    for (const slug of serviceSlugs) {
      const service = dict.services[slug];
      assert.ok(service.title.length > 0, `${slug} missing title`);
      assert.ok(service.shortDescription.length > 0, `${slug} missing shortDescription`);
      assert.ok(service.longDescription.length > 0, `${slug} missing longDescription`);
      assert.ok(service.bullets.length > 0, `${slug} missing bullets`);
    }
  }
});

test("faq and process step counts match across locales", () => {
  assert.equal(uk.faq.items.length, ru.faq.items.length);
  assert.equal(uk.faq.items.length, en.faq.items.length);
  assert.equal(uk.process.steps.length, ru.process.steps.length);
  assert.equal(uk.process.steps.length, en.process.steps.length);
  assert.equal(uk.benefits.items.length, ru.benefits.items.length);
  assert.equal(uk.benefits.items.length, en.benefits.items.length);
});
