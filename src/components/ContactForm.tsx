"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Dictionary } from "@/content/types";
import { services } from "@/content/services";
import { classifyContactErrorKind, type ContactErrorKind } from "@/lib/contactErrorKind";
import { CONTACT_MAX_LENGTHS } from "@/lib/contactLimits";
import { consumeRequestedService, onServiceRequested } from "@/lib/serviceContactIntent";
import { GoldButton } from "./GoldButton";

type Status = "idle" | "submitting" | "success" | "error";
type ErrorKind = ContactErrorKind | null;

interface Errors {
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  consent?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s()-]{6,}$/;
const SUBMIT_TIMEOUT_MS = 15_000;

// Priority order for moving focus to the first invalid field — matches
// the fields' visual/tab order in the form.
const FIELD_ORDER = ["name", "phone", "email", "message", "consent"] as const;

// Called from the service CTA-intent effect below, whenever the service
// modal's "go to contacts" CTA actually fired — moves keyboard/screen-reader
// focus onto the contacts heading itself. The CTA deliberately skips
// refocusing its own trigger for this path (see
// ServicesGrid.closeForNavigation) because that trigger can end up scrolled
// far off-screen once the page lands on `#contacts` — confirmed with real
// keyboard events. A plain
// `hashchange` listener was tried first and doesn't work here: Next.js's
// <Link> updates the URL via the History API, which never dispatches a
// `hashchange` event, so this is tied directly to the same CTA-intent
// signal that already reliably drives the service pre-fill.
function focusContactsHeading() {
  document.getElementById("contacts-heading")?.focus();
}

export function ContactForm({ dict }: { dict: Dictionary }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const isSubmittingRef = useRef(false);
  const pendingFocusRef = useRef<(typeof FIELD_ORDER)[number] | null>(null);
  const fieldRefs = useRef<Record<(typeof FIELD_ORDER)[number], HTMLElement | null>>({
    name: null,
    phone: null,
    email: null,
    message: null,
    consent: null,
  });
  const serviceSelectRef = useRef<HTMLSelectElement>(null);

  // Applies a requested service slug to the <select> — used both for a
  // value already waiting in sessionStorage at mount time, and for a live
  // request while this form is already mounted (see serviceContactIntent
  // for why both paths are needed: the modal's CTA is a same-page hash
  // link, so ContactForm is typically *already* mounted when the request
  // happens, not freshly mounted). An unmatched/unknown slug is a silent
  // no-op.
  //
  // `autoFilled` distinguishes "this value was set by an earlier CTA" from
  // "the visitor chose this themselves": a native `input` event only ever
  // fires for real user interaction, never for a plain `.value = x`
  // assignment, so it's a reliable signal to stop treating the field as
  // ours. Without this, picking one service's CTA and then a *different*
  // service's CTA in the same session would silently keep the first
  // choice — confirmed while testing this patch — because a plain "only
  // fill when empty" guard can't tell our own earlier fill apart from a
  // deliberate choice. A value already there when the effect first runs
  // (e.g. bfcache-restored) is treated as the visitor's, not ours.
  useEffect(() => {
    const select = serviceSelectRef.current;
    let autoFilled = false;
    function markUserEdited() {
      autoFilled = false;
    }
    select?.addEventListener("input", markUserEdited);
    function applyService(slug: string) {
      // Runs regardless of whether `slug` turns out to match a real
      // option below (e.g. the special-order pseudo-service never will)
      // — a CTA fired and the visitor followed a "go to contacts" link
      // either way, so focus should land there regardless of the match.
      focusContactsHeading();
      if (!select) return;
      if (select.value && !autoFilled) return;
      if (services.some((service) => service.slug === slug)) {
        select.value = slug;
        autoFilled = true;
      }
    }
    const stored = consumeRequestedService();
    if (stored) applyService(stored);
    const unsubscribe = onServiceRequested(applyService);
    return () => {
      unsubscribe();
      select?.removeEventListener("input", markUserEdited);
    };
  }, []);

  const idPrefix = useId();
  const errorId = (field: keyof Errors) => `${idPrefix}-${field}-error`;

  // Runs after React has committed `errors` to the DOM, so the field
  // already has its updated `aria-invalid`/`aria-describedby` by the time
  // it receives focus (a screen reader reading focus-in picks up the
  // error immediately instead of the pre-error state). A ref (not state)
  // holds the pending target so this effect only performs the imperative
  // `.focus()` call — it never triggers a further render itself.
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    pendingFocusRef.current = null;
    fieldRefs.current[target]?.focus();
  }, [errors]);

  function validate(formData: FormData): Errors {
    const next: Errors = {};
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const consent = formData.get("consent");

    if (!name) next.name = dict.contact.form.required;
    if (!phone) next.phone = dict.contact.form.required;
    else if (!phonePattern.test(phone)) next.phone = dict.contact.form.invalidPhone;
    if (email && !emailPattern.test(email)) next.email = dict.contact.form.invalidEmail;
    if (!message) next.message = dict.contact.form.required;
    if (!consent) next.consent = dict.contact.form.required;

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const validationErrors = validate(formData);

    // Clear any status/error banner from a previous attempt before
    // showing this attempt's outcome, so a stale success/error message
    // never sits next to newly-invalid fields.
    setStatus("idle");
    setErrorKind(null);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      const firstInvalidField = FIELD_ORDER.find((field) => validationErrors[field]);
      pendingFocusRef.current = firstInvalidField ?? null;
      return;
    }

    isSubmittingRef.current = true;
    setStatus("submitting");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          email: String(formData.get("email") ?? ""),
          service: String(formData.get("service") ?? ""),
          vehicle: String(formData.get("vehicle") ?? ""),
          message: String(formData.get("message") ?? ""),
          consent: formData.get("consent") === "on",
          website: String(formData.get("website") ?? ""),
        }),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as { ok?: boolean; code?: string } | null;

      if (response.ok && body?.ok) {
        setStatus("success");
        setErrorKind(null);
        form.reset();
        return;
      }

      setStatus("error");
      setErrorKind(classifyContactErrorKind(response.status, body?.code ?? null));
    } catch (error) {
      setStatus("error");
      setErrorKind(error instanceof Error && error.name === "AbortError" ? "timeout" : "generic");
    } finally {
      clearTimeout(timeoutId);
      isSubmittingRef.current = false;
    }
  }

  let statusMessage: string | null = null;
  if (status === "success") {
    statusMessage = dict.contact.form.success;
  } else if (status === "error" && errorKind === "notConfigured") {
    statusMessage = dict.contact.form.notConfigured;
  } else if (status === "error" && errorKind === "timeout") {
    statusMessage = dict.contact.form.timeout;
  } else if (status === "error" && errorKind === "rateLimited") {
    statusMessage = dict.contact.form.rateLimited;
  } else if (status === "error") {
    statusMessage = dict.contact.form.error;
  }

  const inputClass =
    "w-full rounded-sm border border-border-gold/60 bg-surface-light px-4 py-3 text-sm text-text placeholder:text-muted focus-visible:border-gold";

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
      >
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.name}
          </label>
          <input
            ref={(el) => {
              fieldRefs.current.name = el;
            }}
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            maxLength={CONTACT_MAX_LENGTHS.name}
            className={inputClass}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? errorId("name") : undefined}
          />
          {errors.name && (
            <p id={errorId("name")} className="mt-1 text-xs text-gold-light">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.phone}
          </label>
          <input
            ref={(el) => {
              fieldRefs.current.phone = el;
            }}
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            maxLength={CONTACT_MAX_LENGTHS.phone}
            className={inputClass}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? errorId("phone") : undefined}
          />
          {errors.phone && (
            <p id={errorId("phone")} className="mt-1 text-xs text-gold-light">
              {errors.phone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.email}
          </label>
          <input
            ref={(el) => {
              fieldRefs.current.email = el;
            }}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={CONTACT_MAX_LENGTHS.email}
            className={inputClass}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? errorId("email") : undefined}
          />
          {errors.email && (
            <p id={errorId("email")} className="mt-1 text-xs text-gold-light">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="service" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.service}
          </label>
          <select
            ref={serviceSelectRef}
            id="service"
            name="service"
            className={inputClass}
            defaultValue=""
          >
            <option value="" disabled>
              {dict.contact.form.selectService}
            </option>
            {services.map(({ slug }) => (
              <option key={slug} value={slug}>
                {dict.services[slug].title}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="vehicle" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.vehicle}
          </label>
          <input
            id="vehicle"
            name="vehicle"
            type="text"
            autoComplete="off"
            maxLength={CONTACT_MAX_LENGTHS.vehicle}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.message}
          </label>
          <textarea
            ref={(el) => {
              fieldRefs.current.message = el;
            }}
            id="message"
            name="message"
            rows={4}
            required
            maxLength={CONTACT_MAX_LENGTHS.message}
            className={inputClass}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? errorId("message") : undefined}
          />
          {errors.message && (
            <p id={errorId("message")} className="mt-1 text-xs text-gold-light">
              {errors.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            ref={(el) => {
              fieldRefs.current.consent = el;
            }}
            type="checkbox"
            name="consent"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? errorId("consent") : undefined}
          />
          {dict.contact.form.consent}
        </label>
        {errors.consent && (
          <p id={errorId("consent")} className="mt-1 text-xs text-gold-light">
            {errors.consent}
          </p>
        )}
      </div>

      <GoldButton type="submit" disabled={status === "submitting"} className="self-start">
        {status === "submitting" ? dict.contact.form.sending : dict.contact.form.submit}
      </GoldButton>

      {statusMessage &&
        (status === "error" ? (
          <p role="alert" className="text-sm text-gold-light">
            {statusMessage}
          </p>
        ) : (
          <p role="status" aria-live="polite" className="text-sm text-gold-light">
            {statusMessage}
          </p>
        ))}
    </form>
  );
}
