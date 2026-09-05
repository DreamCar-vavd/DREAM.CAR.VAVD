// Covers isModifiedClick.ts — the check that stops the service/vehicle CTA
// click handlers from writing a same-tab contact-intent (and closing their
// modal/gallery) when the click won't actually navigate the current tab.
// This is a plain function over a small event shape, so a real DOM/browser
// isn't needed — a literal object matching ModifiableClickEvent exercises
// the real exported function directly, not a reimplementation of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isModifiedClick, type ModifiableClickEvent } from "./isModifiedClick";

function event(overrides: Partial<ModifiableClickEvent> = {}): ModifiableClickEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    button: 0,
    currentTarget: { getAttribute: () => null },
    ...overrides,
  };
}

test("a plain left-click with no modifiers and no explicit target is NOT modified", () => {
  assert.equal(isModifiedClick(event()), false);
});

test("a plain left-click on a link with target=_self is NOT modified", () => {
  assert.equal(
    isModifiedClick(event({ currentTarget: { getAttribute: () => "_self" } })),
    false,
  );
});

for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
  test(`a click with ${key} held is modified`, () => {
    assert.equal(isModifiedClick(event({ [key]: true })), true);
  });
}

test("a middle-click (button 1) is modified", () => {
  assert.equal(isModifiedClick(event({ button: 1 })), true);
});

test("a link with target=_blank is treated as modified even on a plain click", () => {
  assert.equal(
    isModifiedClick(event({ currentTarget: { getAttribute: () => "_blank" } })),
    true,
  );
});
