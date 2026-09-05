/**
 * One-shot, client-only bridge from a service modal's "contact us" CTA to
 * the contact form's service <select>. Deliberately not React state/context:
 * the modal (ServicesGrid) and the form (ContactForm) are unrelated sibling
 * subtrees on the same page.
 *
 * Two delivery mechanisms, because the CTA's target (`#contacts`) is a
 * same-page hash link on the homepage where ContactForm is *already*
 * mounted — a plain "read sessionStorage once on mount" effect would never
 * re-run and would silently miss the request:
 *
 * - `sessionStorage` (read via `consumeRequestedService`) covers a form
 *   that mounts *after* the request was made (a fresh page load — this is
 *   the ONLY delivery path that survives a real cross-page navigation;
 *   the CustomEvent below cannot, since it fires on the page that's about
 *   to be torn down, before the destination page's window/listener exist).
 * - a `CustomEvent` on `window` (subscribed via `onServiceRequested`)
 *   covers a form that was *already mounted* when the request happens —
 *   the actual case for this specific CTA, since it's a same-page
 *   navigation.
 *
 * Both fire on every `setRequestedService` call, so either an already-
 * mounted or a not-yet-mounted ContactForm picks it up correctly.
 *
 * The actual cause of a stray value surviving to misfire on a later,
 * unrelated visit was Ctrl/Cmd/Shift/Alt-clicking the CTA: the click
 * handler ran (and wrote this) even though that click opens a new tab and
 * leaves *this* tab exactly where it was. That's fixed at the source in the
 * CTA components themselves (see isModifiedClick.ts) — a modified click
 * never calls `setRequestedService` at all, so nothing is left behind here.
 *
 * `MAX_AGE_MS` below is a secondary safety net only, for the rarer case of
 * a genuine same-tab navigation that gets interrupted after the click (the
 * browser's Stop button, a network error before the destination mounts) —
 * not the primary defense, and not something a shorter timer alone could
 * have fixed: a real cross-page navigation legitimately needs a `consume`
 * that hasn't happened yet however long the destination takes to load, so
 * this is set generously (`MAX_AGE_MS`) rather than tightened, and "consume"
 * (read + immediately clear) still applies on top: a value is used at most
 * once.
 */
const KEY = "dreamCarVavd:contactIntent:service";
const EVENT = "dreamCarVavd:serviceRequested";
const MAX_AGE_MS = 60_000;

interface StoredIntent {
  value: string;
  ts: number;
}

export function setRequestedService(slug: string) {
  try {
    const payload: StoredIntent = { value: slug, ts: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Storage can throw in private-browsing/quota-exceeded edge cases;
    // the CustomEvent below still gets a chance to deliver the request
    // to an already-mounted form, so this alone isn't fatal — but it
    // does mean a real cross-page navigation loses the request in that
    // case (there is no other way to carry it across a document reload).
  }
  try {
    window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: slug }));
  } catch {
    // No-op if CustomEvent/window is unavailable for any reason — the
    // CTA still navigates and closes the modal either way.
  }
}

export function consumeRequestedService(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<StoredIntent>;
    if (typeof parsed.value !== "string" || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null; // safety net only — see MAX_AGE_MS comment above
    return parsed.value;
  } catch {
    return null;
  }
}

/** Subscribes to live requests made while the form is already mounted. Returns an unsubscribe function for effect cleanup. */
export function onServiceRequested(handler: (slug: string) => void): () => void {
  function listener(event: Event) {
    const detail = (event as CustomEvent<string>).detail;
    if (typeof detail === "string") handler(detail);
  }
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
