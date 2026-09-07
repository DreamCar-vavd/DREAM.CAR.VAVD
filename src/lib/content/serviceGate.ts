/**
 * Publish gate for Services. Same pipeline as cars/gallery — storage,
 * versioning, review hashes and the snapshot are shared, not duplicated.
 */
import {
  LOCALES,
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
  seoTitle: string;
  seoDescription: string;
}
export interface CmsService {
  id: string; // == slug, the route segment
  order: number;
  status: ServiceStatus;
  iconSrc: string;
  price: string;
  photos: { image: string; caption: string }[];
  uk: CmsServiceLanguage;
  en: CmsServiceLanguage;
  ru: CmsServiceLanguage;
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
