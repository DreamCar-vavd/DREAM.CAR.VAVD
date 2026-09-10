/**
 * Pure helpers for the panel action buttons — kept out of the client component
 * so they can be unit-tested without a DOM.
 *
 * The three states the owner must be able to tell apart:
 *  - "ok"        — the server confirmed the change; the panel is refreshing.
 *  - "conflict"  — a version moved or the backend is degraded but the write
 *                  provably did NOT land: reload and (optionally) retry.
 *                  Rendered amber with an "Оновити" button.
 *  - "uncertain" — a write was in flight and its outcome is genuinely UNKNOWN
 *                  (`outcome:"unknown"`, or a dropped browser→server response).
 *                  The action LOCKS; the only way forward is a read-only
 *                  "Перевірити результат". Rendered amber, announced assertively.
 *  - "err"       — bad input / auth / access: a refresh will not help; the
 *                  message says what to do. Rendered red, announced assertively.
 */

export interface ActionResponse {
  ok: boolean;
  message: string;
  conflict?: boolean;
  transient?: boolean;
  /** The machine flag — set by the server ONLY when a write's result is unknown. */
  outcome?: "unknown";
  auth?: boolean;
  forbidden?: boolean;
  blockers?: { kind: string }[];
}

export type MsgKind = "ok" | "err" | "conflict" | "uncertain";
export interface ActionMessage {
  kind: MsgKind;
  text: string;
}

/**
 * What to show after the server responded. `refreshing` = the post-success
 * `router.refresh()` is still running, so an ok result says so explicitly —
 * which reads differently from "no response, check the state" (below).
 */
export function messageForResponse(data: ActionResponse, refreshing = false): ActionMessage {
  const extra = data.blockers?.length ? ` (${data.blockers.length} пункт(и))` : "";
  if (data.ok) {
    return {
      kind: "ok",
      text: refreshing ? `${data.message} Оновлюємо панель…` : data.message,
    };
  }
  // A write in flight whose result is unknown — the caller LOCKS the action.
  if (data.outcome === "unknown") return { kind: "uncertain", text: data.message + extra };
  // Version moved / backend degraded, but nothing was written — reload, retry ok.
  if (data.conflict || data.transient) return { kind: "conflict", text: data.message + extra };
  return { kind: "err", text: data.message + extra };
}

/**
 * No response came back (timeout / dropped connection). The write MAY or MAY NOT
 * have landed, so the owner must **check the current state** — not retry blindly.
 * The action stays locked until that check runs (see `CHECK_RESULT_*`).
 */
export const NETWORK_UNCERTAIN_MSG =
  "Відповідь від сервера не отримано — невідомо, чи застосовано дію. " +
  "Натисніть «Перевірити результат» (лише читає стан) перед тим, як повторювати.";

/** Post-refresh reads the panel's fresh state and compares it to before the lost
 *  action. We can only say "схоже" — the read is honest about its certainty. */
export function checkResultMessage(applied: boolean | null): ActionMessage {
  if (applied === true) {
    return { kind: "ok", text: "Схоже, зміну вже застосовано — панель показує новий стан. Повторювати не треба." };
  }
  if (applied === false) {
    return { kind: "conflict", text: "Схоже, зміну НЕ застосовано — стан незмінний. Можна повторити дію." };
  }
  return {
    kind: "conflict",
    text: "Стан прочитати не вдалося — результат досі невизначений. Спробуйте «Перевірити результат» ще раз.",
  };
}

export const CHECK_FAILED_MSG = "Перевірити результат не вдалося — спробуйте ще раз.";

/**
 * What the button does with a write's reply. `data === null` = the fetch threw
 * or the body would not parse — i.e. NO structured answer came back. Pure so
 * every "lost response / definite refusal / success" path is unit-testable
 * without a DOM. The three exclusive routes:
 *  - lock:true    -> outcome UNKNOWN; disable the action, force a read-only check
 *  - refresh:true -> the write landed; sync the panel
 *  - neither      -> a definite refusal (conflict / transient / bad input); the
 *                    owner may retry, nothing was written
 */
export function routeWriteResponse(data: ActionResponse | null): {
  lock: boolean;
  refresh: boolean;
  msg: ActionMessage;
} {
  if (!data) return { lock: true, refresh: false, msg: { kind: "uncertain", text: NETWORK_UNCERTAIN_MSG } };
  if (!data.ok && data.outcome === "unknown") {
    return { lock: true, refresh: false, msg: messageForResponse(data) };
  }
  if (data.ok) return { lock: false, refresh: true, msg: messageForResponse(data, true) };
  return { lock: false, refresh: false, msg: messageForResponse(data) };
}

/**
 * What the button does with the read-only result check's reply. `applied`:
 * `true`/`false` unlock (definite answer); `null` — or no parseable reply —
 * KEEPS the action locked (a failed check is not an answer, and never a
 * success). A settled refresh on its own never reaches here.
 */
export function routeCheckResponse(
  data: { applied?: boolean | null; message?: string } | null,
): { unlock: boolean; refresh: boolean; msg: ActionMessage } {
  if (!data || data.applied === undefined) {
    return { unlock: false, refresh: false, msg: { kind: "uncertain", text: CHECK_FAILED_MSG } };
  }
  const applied = data.applied ?? null;
  const text = data.message || checkResultMessage(applied).text;
  const kind: MsgKind = applied === true ? "ok" : applied === false ? "conflict" : "uncertain";
  return { unlock: applied !== null, refresh: applied !== null, msg: { kind, text } };
}

/** A click may fire a request only when nothing is already in flight for this
 *  action AND it is not locked pending a result check. */
export function shouldFireAction(s: {
  inFlight: boolean;
  busy: boolean;
  refreshing: boolean;
  locked: boolean;
}): boolean {
  return !s.inFlight && !s.busy && !s.refreshing && !s.locked;
}

/** Shown while a refresh is taking longer than usual — a hint, not a failure. */
export const REFRESH_SLOW_MSG = "Оновлення триває довше, ніж зазвичай…";

/** Shown once, right after a confirmed `router.refresh()` settled. */
export const PANEL_REFRESHED_MSG = "Готово — панель оновлено.";

/** A verb phrase for the button while its request is in flight — never a bare "…". */
export function busyLabelFor(action: string): string {
  switch (action) {
    case "publish":
      return "Публікується…";
    case "unpublish":
      return "Прибираємо з сайту…";
    case "confirm-locale":
      return "Зберігаємо…";
    case "complete-deletion":
      return "Завершуємо видалення…";
    case "cleanup-dry-run":
      return "Перевіряємо…";
    case "cleanup-confirm":
      return "Прибираємо копії…";
    case "check-result":
      return "Перевіряємо стан…";
    case "refresh":
      return "Оновлюємо…";
    default:
      return "Виконується…";
  }
}
