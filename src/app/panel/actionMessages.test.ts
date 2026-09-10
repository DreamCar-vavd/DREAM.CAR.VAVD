import { test } from "node:test";
import assert from "node:assert/strict";
import {
  busyLabelFor,
  checkResultMessage,
  messageForResponse,
  NETWORK_UNCERTAIN_MSG,
  PANEL_REFRESHED_MSG,
  REFRESH_SLOW_MSG,
} from "./actionMessages";

test("messageForResponse: a confirmed write is green; while the panel refreshes it says so", () => {
  const settled = messageForResponse({ ok: true, message: "Опубліковано." });
  assert.equal(settled.kind, "ok");
  assert.equal(settled.text, "Опубліковано.");

  const refreshing = messageForResponse({ ok: true, message: "Опубліковано." }, true);
  assert.equal(refreshing.kind, "ok");
  assert.match(refreshing.text, /Оновлюємо панель/);
});

test("messageForResponse: a conflict is amber (reload-and-check), not a plain error", () => {
  const m = messageForResponse({ ok: false, conflict: true, message: "Дані змінилися." });
  assert.equal(m.kind, "conflict");
  assert.equal(m.text, "Дані змінилися.");
});

test("messageForResponse: an UNCERTAIN write outcome (transient) is amber, not a retry-now error", () => {
  const m = messageForResponse({ ok: false, transient: true, message: "Відповідь не надійшла." });
  assert.equal(m.kind, "conflict"); // -> gets the "Оновити" affordance, no blind retry
});

test("messageForResponse: bad input / auth / access is a red error (refresh won't help)", () => {
  assert.equal(messageForResponse({ ok: false, message: "Не вказано мову." }).kind, "err");
  assert.equal(messageForResponse({ ok: false, auth: true, message: "Увійдіть знову." }).kind, "err");
  assert.equal(messageForResponse({ ok: false, forbidden: true, message: "Немає прав." }).kind, "err");
});

test("messageForResponse: blockers count is appended for a gated publish", () => {
  const m = messageForResponse({
    ok: false,
    message: "Не можна опублікувати.",
    blockers: [{ kind: "a" }, { kind: "b" }],
  });
  assert.equal(m.kind, "err");
  assert.match(m.text, /\(2 пункт\(и\)\)/);
});

test("the network-uncertain message points at the read-only check, not a blind retry", () => {
  assert.match(NETWORK_UNCERTAIN_MSG, /не отримано/);
  assert.match(NETWORK_UNCERTAIN_MSG, /Перевірити результат/);
  assert.match(NETWORK_UNCERTAIN_MSG, /лише читає стан/);
  assert.match(NETWORK_UNCERTAIN_MSG, /перед тим, як повторювати/);
  assert.doesNotMatch(NETWORK_UNCERTAIN_MSG, /^Опубліковано|^Збережено/);
});

test("checkResultMessage: says applied / not applied / undetermined — always hedged", () => {
  const yes = checkResultMessage(true);
  assert.equal(yes.kind, "ok");
  assert.match(yes.text, /вже застосовано|застосовано/);
  assert.match(yes.text, /[Пп]овторювати не треба|не треба/);

  const no = checkResultMessage(false);
  assert.equal(no.kind, "conflict");
  assert.match(no.text, /НЕ застосовано/);
  assert.match(no.text, /повторити/);

  const dunno = checkResultMessage(null);
  assert.equal(dunno.kind, "conflict");
  assert.match(dunno.text, /невизначений|не вдалося/);
});

test("REFRESH_SLOW_MSG is a hint, not a failure; PANEL_REFRESHED_MSG confirms done", () => {
  assert.match(REFRESH_SLOW_MSG, /довше/);
  assert.doesNotMatch(REFRESH_SLOW_MSG, /помилк|не вдалося|збій/i);
  assert.match(PANEL_REFRESHED_MSG, /оновлено/);
});

test("busyLabelFor: every action has a spoken verb phrase, never a bare ellipsis", () => {
  for (const a of [
    "publish",
    "unpublish",
    "confirm-locale",
    "complete-deletion",
    "cleanup-dry-run",
    "cleanup-confirm",
    "check-result",
    "refresh",
    "something-new",
  ]) {
    const label = busyLabelFor(a);
    assert.ok(label.length > 1, `"${a}" -> "${label}"`);
    assert.notEqual(label, "…");
    assert.match(label, /…$/); // trailing ellipsis = "in progress", but with words
  }
  assert.equal(busyLabelFor("publish"), "Публікується…");
  assert.equal(busyLabelFor("cleanup-confirm"), "Прибираємо копії…");
});
