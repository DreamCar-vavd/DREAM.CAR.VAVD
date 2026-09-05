// Covers focusContactsHeading.ts — the shared helper all three "go to
// contacts" CTAs (service modal, car listing, gallery project) call after
// closing their own overlay. This only exercises the function's own
// contract (which id it looks up, and that a missing element doesn't
// throw) — it is NOT a substitute for the manual browser verification of
// the actual reported bug (the gallery CTA's modal never closing), which
// needs real component rendering this project's plain `node --test` setup
// doesn't provide.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { focusContactsHeading } from "./focusContactsHeading";

const originalDocument = (globalThis as { document?: unknown }).document;

afterEach(() => {
  (globalThis as { document?: unknown }).document = originalDocument;
});

test("focusContactsHeading looks up 'contacts-heading' and calls .focus() on it", () => {
  let requestedId: string | null = null;
  let focusCalled = false;
  (globalThis as { document: { getElementById: (id: string) => unknown } }).document = {
    getElementById: (id: string) => {
      requestedId = id;
      return {
        focus: () => {
          focusCalled = true;
        },
      };
    },
  };
  focusContactsHeading();
  assert.equal(requestedId, "contacts-heading");
  assert.equal(focusCalled, true);
});

test("focusContactsHeading does not throw when the element is missing", () => {
  (globalThis as { document: { getElementById: (id: string) => unknown } }).document = {
    getElementById: () => null,
  };
  assert.doesNotThrow(() => focusContactsHeading());
});
