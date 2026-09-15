/**
 * The contact form has two INDEPENDENT sinks:
 *   1. the durable record (panel database) — optional, best-effort, tried first;
 *   2. email delivery (Formspree / CONTACT_FORM_ENDPOINT) — the existing path.
 *
 * They are NOT one atomic operation. This module decides the HTTP response
 * from the two outcomes, so the rule lives in one tested place.
 *
 *  A both ok             -> 200 { ok:true }
 *  Б saved, email fails  -> 200 { ok:true, code:"SAVED_EMAIL_FAILED" }   (lead is safe in /panel/leads)
 *  В email ok, db down   -> 200 { ok:true, code:"EMAILED_NOT_SAVED" }    (email delivered; not in panel — warn, no PII)
 *  Г both fail           -> 502/504 { ok:false, code:"DELIVERY_FAILED" | "UPSTREAM_TIMEOUT" }
 *  Д retry after timeout -> the DB row is deduped by idempotency key; email may
 *                           re-send (Formspree is not idempotent — documented).
 */

export type EmailOutcome = "ok" | "failed" | "timeout";

export interface LeadResponse {
  status: number;
  body: { ok: boolean; code?: string };
}

export function resolveLeadResponse(opts: {
  /** was a database store configured for this request? */
  hasStore: boolean;
  /** did the DB write succeed (or dedupe)? irrelevant when !hasStore */
  savedToDb: boolean;
  email: EmailOutcome;
}): LeadResponse {
  const { hasStore, savedToDb, email } = opts;

  if (email === "ok") {
    if (hasStore && !savedToDb) return { status: 200, body: { ok: true, code: "EMAILED_NOT_SAVED" } };
    return { status: 200, body: { ok: true } };
  }

  // email failed or timed out
  if (savedToDb) return { status: 200, body: { ok: true, code: "SAVED_EMAIL_FAILED" } };
  return {
    status: email === "timeout" ? 504 : 502,
    body: { ok: false, code: email === "timeout" ? "UPSTREAM_TIMEOUT" : "DELIVERY_FAILED" },
  };
}
