/**
 * One-shot, client-only bridge from a car listing's "contact us" CTA to the
 * contact form's vehicle field. See serviceContactIntent.ts for the full
 * rationale (sessionStorage + CustomEvent, not lifted state/context, and
 * why the CustomEvent alone cannot survive a real cross-page navigation).
 *
 * This CTA's target page (the homepage) is normally reached via a real
 * cross-page navigation from `/cars-for-sale`, so the sessionStorage path
 * is the one that actually matters here — the CustomEvent is kept only in
 * case Next.js's client-side route cache ever reuses an already-mounted
 * destination page instead of remounting it.
 *
 * Only a stable listing id is stored/dispatched here — never a free-form
 * name — so the consumer can validate it against real listing data before
 * ever touching the form field.
 *
 * Timestamped with the same `MAX_AGE_MS` as the service intent, for the same
 * reason — see serviceContactIntent.ts's doc comment: the actual fix for a
 * stray value is not writing one on a Ctrl/Cmd/Shift/Alt-click in the first
 * place (isModifiedClick.ts, applied at the CTA call site), not this timer.
 * `MAX_AGE_MS` is a secondary safety net for a genuinely interrupted same-tab
 * navigation, set generously since this CTA's target is normally reached via
 * a real cross-page navigation that may legitimately take a while to land.
 */
const KEY = "dreamCarVavd:contactIntent:vehicleId";
const EVENT = "dreamCarVavd:vehicleRequested";
const MAX_AGE_MS = 60_000;

interface StoredIntent {
  value: string;
  ts: number;
}

export function setRequestedVehicle(listingId: string) {
  try {
    const payload: StoredIntent = { value: listingId, ts: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Same rationale as setRequestedService: not fatal on its own, but a
    // real cross-page navigation has no other way to carry the request.
  }
  try {
    window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: listingId }));
  } catch {
    // No-op — navigation and modal close still proceed regardless.
  }
}

export function consumeRequestedVehicle(): string | null {
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
export function onVehicleRequested(handler: (listingId: string) => void): () => void {
  function listener(event: Event) {
    const detail = (event as CustomEvent<string>).detail;
    if (typeof detail === "string") handler(detail);
  }
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
