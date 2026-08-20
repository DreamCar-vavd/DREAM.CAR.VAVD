"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Dictionary } from "@/content/types";
import { services } from "@/content/services";
import { GoldButton } from "./GoldButton";

type Status = "idle" | "submitting" | "success" | "error";
type ErrorKind = "notConfigured" | "timeout" | "generic" | null;

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

export function ContactForm({ dict }: { dict: Dictionary }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const isSubmittingRef = useRef(false);

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
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    isSubmittingRef.current = true;
    setStatus("submitting");
    setErrorKind(null);

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
      if (body?.code === "NOT_CONFIGURED") {
        setErrorKind("notConfigured");
      } else if (body?.code === "UPSTREAM_TIMEOUT") {
        setErrorKind("timeout");
      } else {
        setErrorKind("generic");
      }
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
          <input id="name" name="name" type="text" required className={inputClass} aria-invalid={Boolean(errors.name)} />
          {errors.name && <p className="mt-1 text-xs text-gold-light">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.phone}
          </label>
          <input id="phone" name="phone" type="tel" required className={inputClass} aria-invalid={Boolean(errors.phone)} />
          {errors.phone && <p className="mt-1 text-xs text-gold-light">{errors.phone}</p>}
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.email}
          </label>
          <input id="email" name="email" type="email" className={inputClass} aria-invalid={Boolean(errors.email)} />
          {errors.email && <p className="mt-1 text-xs text-gold-light">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="service" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.service}
          </label>
          <select id="service" name="service" className={inputClass} defaultValue="">
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
          <input id="vehicle" name="vehicle" type="text" className={inputClass} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className="mb-1.5 block text-sm text-muted">
            {dict.contact.form.message}
          </label>
          <textarea id="message" name="message" rows={4} required className={inputClass} aria-invalid={Boolean(errors.message)} />
          {errors.message && <p className="mt-1 text-xs text-gold-light">{errors.message}</p>}
        </div>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            name="consent"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]"
            aria-invalid={Boolean(errors.consent)}
          />
          {dict.contact.form.consent}
        </label>
        {errors.consent && <p className="mt-1 text-xs text-gold-light">{errors.consent}</p>}
      </div>

      <GoldButton type="submit" disabled={status === "submitting"} className="self-start">
        {dict.contact.form.submit}
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
