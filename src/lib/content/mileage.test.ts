import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMileage } from "./mileage";

test("reproduces the pre-panel mileage strings for all three cars", () => {
  assert.equal(formatMileage(47170, "uk"), "47 170 миль");
  assert.equal(formatMileage(47170, "ru"), "47 170 миль");
  assert.equal(formatMileage(47170, "en"), "47,170 miles");

  assert.equal(formatMileage(6150, "uk"), "6 150 миль");
  assert.equal(formatMileage(6150, "en"), "6,150 miles");

  assert.equal(formatMileage(42488, "ru"), "42 488 миль");
  assert.equal(formatMileage(42488, "en"), "42,488 miles");
});

test("small and edge values", () => {
  assert.equal(formatMileage(0, "en"), "0 miles");
  assert.equal(formatMileage(999, "uk"), "999 миль");
  assert.equal(formatMileage(1000, "en"), "1,000 miles");
  assert.equal(formatMileage(-5, "en"), "");
  assert.equal(formatMileage(Number.NaN, "uk"), "");
});
