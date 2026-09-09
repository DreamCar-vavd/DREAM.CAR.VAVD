/**
 * Publish gate for Services. Same pipeline as cars/gallery — storage,
 * versioning, review hashes and the snapshot are shared, not duplicated.
 */
import {
  LOCALES,
  reviewInstanceMatches,
  type ContentLocale,
  type GateContext,
  type GateFailure,
  type LangReviewStatus,
} from "./carsGate";

export type ServiceStatus = "available" | "coming-soon";

export interface CmsServiceSection {
  heading: string;
  items: string[];
}
export interface CmsServiceLanguage {
  title: string;
  shortDescription: string;
  longDescription: string;
  cardDescription: string;
  bullets: string[];
  modalLead: string;
  modalDescription: string;
  modalSections: CmsServiceSection[];
  /**
   * Free-text price for THIS language, e.g. «за домовленістю» / «on request» /
   * «от £60». A shared number cannot express these, so this one is per-locale
   * and IS part of the review hash — editing it re-opens the language review.
   */
  priceNote: string;
  seoTitle: string;
  seoDescription: string;
}
export interface CmsService {
  id: string; // == slug, the route segment
  order: number;
  status: ServiceStatus;
  iconSrc: string;
  /**
   * A plain numeric amount + currency symbol. Language-independent, so it is
   * NOT part of the review hash — changing the number never forces a
   * re-translation. Empty amount = no numeric price; the per-language
   * `priceNote` (if any) is shown instead.
   */
  priceAmount: string;
  priceCurrency: string;
  photos: { image: string; caption: string }[];
  uk: CmsServiceLanguage;
  en: CmsServiceLanguage;
  ru: CmsServiceLanguage;
}

/** `/^\d+(\.\d{1,2})?$/` or empty. */
export function isValidPriceAmount(v: string): boolean {
  const t = (v ?? "").trim();
  return t === "" || /^\d+(\.\d{1,2})?$/.test(t);
}

/** The price string to display for one locale (number wins over note). */
export function servicePriceForLocale(s: CmsService, locale: ContentLocale): string {
  const amount = (s.priceAmount ?? "").trim();
  if (amount) {
    const cur = (s.priceCurrency ?? "").trim();
    return cur ? `${cur}${amount}` : amount;
  }
  return (s[locale]?.priceNote ?? "").trim();
}

const REQUIRED = ["title", "shortDescription", "longDescription"] as const;

/** Fields whose change invalidates a prior review (canonical JSON). */
export function serviceConfirmedText(l: CmsServiceLanguage): string {
  return JSON.stringify({
    title: (l?.title ?? "").trim(),
    shortDescription: (l?.shortDescription ?? "").trim(),
    longDescription: (l?.longDescription ?? "").trim(),
    cardDescription: (l?.cardDescription ?? "").trim(),
    bullets: (l?.bullets ?? []).map((s) => s.trim()).filter(Boolean),
    modalLead: (l?.modalLead ?? "").trim(),
    modalDescription: (l?.modalDescription ?? "").trim(),
    modalSections: (l?.modalSections ?? []).map((s) => ({
      heading: (s.heading ?? "").trim(),
      items: (s.items ?? []).map((i) => i.trim()).filter(Boolean),
    })),
    priceNote: (l?.priceNote ?? "").trim(),
    seoTitle: (l?.seoTitle ?? "").trim(),
    seoDescription: (l?.seoDescription ?? "").trim(),
  });
}

export function getServiceLangStatus(
  service: CmsService,
  locale: ContentLocale,
  ctx: GateContext = {},
): LangReviewStatus {
  const l = service[locale];
  if (!REQUIRED.every((f) => String(l?.[f] ?? "").trim())) return "empty";
  const confirmedHash = ctx.review?.[service.id]?.[locale]?.hash;
  if (confirmedHash === undefined) return "needs-review";
  if (!reviewInstanceMatches(ctx, service.id)) return "needs-review";
  if (ctx.sha256 && confirmedHash !== ctx.sha256(serviceConfirmedText(l))) return "needs-review";
  return "reviewed";
}

export function getServicePublishBlockers(
  service: CmsService,
  ctx: GateContext = {},
): GateFailure[] {
  const failures: GateFailure[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(service.id)) {
    failures.push({ kind: "missing-field", locale: "uk", field: "slug" });
  }
  if (!isValidPriceAmount(service.priceAmount)) {
    failures.push({ kind: "missing-field", locale: "uk", field: "priceAmount" });
  }
  for (const locale of LOCALES) {
    const l = service[locale];
    for (const field of REQUIRED) {
      if (!String(l?.[field] ?? "").trim()) {
        failures.push({ kind: "missing-field", locale, field });
      }
    }
    const filled = REQUIRED.every((f) => String(l?.[f] ?? "").trim());
    if (filled && getServiceLangStatus(service, locale, ctx) !== "reviewed") {
      failures.push({ kind: "needs-review", locale });
    }
  }
  return failures;
}

/** Every published service renders — «Незабаром» shows a badge, not hidden. */
export function isServiceRenderable(): boolean {
  return true;
}
