/**
 * Pure helpers for the panel action buttons — kept out of the client component
 * so they can be unit-tested without a DOM.
 *
 * The three states the owner must be able to tell apart:
 *  - "ok"       — the server confirmed the change; the panel is refreshing.
 *  - "conflict" — a version moved, the backend is degraded, or a write's outcome
 *                 is UNKNOWN: reload and check the current state before retrying
 *                 (never a blind retry). Rendered amber with an "Оновити" button.
 *  - "err"      — bad input / auth / access: a refresh will not help; the message
 *                 says what to do. Rendered red, announced assertively.
 */

export interface ActionResponse {
  ok: boolean;
  message: string;
  conflict?: boolean;
  transient?: boolean;
  auth?: boolean;
  forbidden?: boolean;
  blockers?: { kind: string }[];
}

export type MsgKind = "ok" | "err" | "conflict";
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
  // conflict / transient (unknown write outcome) -> reload-and-check
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
