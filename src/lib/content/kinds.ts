/**
 * Content-kind registry. Each kind plugs its own coercion + gate into the ONE
 * publish pipeline in panelStore — there is no second copy of the
 * storage / versioning / review-lock / snapshot machinery.
 */
import {
  confirmedText,
  getLangStatus,
  getPublishBlockers,
  isRenderable as carRenderable,
  type CmsCar,
  type ContentLocale,
  type GateContext,
  type GateFailure,
  type LangReviewStatus,
} from "./carsGate";
import { coerceCar, coerceContact, coerceGalleryProject, coerceService } from "./coerce";
import {
  galleryConfirmedText,
  getGalleryLangStatus,
  getGalleryPublishBlockers,
  isGalleryRenderable,
  type CmsGalleryProject,
} from "./galleryGate";
import {
  getServiceLangStatus,
  getServicePublishBlockers,
  isServiceRenderable,
  serviceConfirmedText,
  type CmsService,
} from "./serviceGate";
import {
  contactConfirmedText,
  getContactLangStatus,
  getContactPublishBlockers,
  isContactRenderable,
  type CmsContact,
} from "./contactGate";
import type { AllowedDir } from "./store/adapter";

export type KindKey = "car" | "gallery" | "service" | "contact";

export interface ContentKind<W extends { id: string; order: number }> {
  key: KindKey;
  label: string;
  dir: AllowedDir;
  /** key of the array inside published.json */
  snapshotKey: "cars" | "gallery" | "services" | "contact";
  /** true for the single-entry Contacts kind (one row, no "add"). */
  singleEntry?: boolean;
  coerce(id: string, raw: Record<string, unknown>): W;
  displayTitle(item: W): string;
  langStatus(item: W, locale: ContentLocale, ctx: GateContext): LangReviewStatus;
  confirmedText(item: W, locale: ContentLocale): string;
  publishBlockers(item: W, ctx: GateContext): GateFailure[];
  isRenderable(item: W): boolean;
}

export const CAR_KIND: ContentKind<CmsCar> = {
  key: "car",
  label: "Автомобілі",
  dir: "src/content/cms/cars",
  snapshotKey: "cars",
  coerce: coerceCar,
  displayTitle: (c) => c.uk.title || c.id,
  langStatus: (c, l, ctx) => getLangStatus(c, l, ctx),
  confirmedText: (c, l) => confirmedText(c[l]),
  publishBlockers: (c, ctx) => getPublishBlockers(c, ctx),
  isRenderable: (c) => carRenderable(c),
};

export const GALLERY_KIND: ContentKind<CmsGalleryProject> = {
  key: "gallery",
  label: "Галерея",
  dir: "src/content/cms/gallery",
  snapshotKey: "gallery",
  coerce: coerceGalleryProject,
  displayTitle: (p) => p.uk.title || p.id,
  langStatus: (p, l, ctx) => getGalleryLangStatus(p, l, ctx),
  confirmedText: (p, l) => galleryConfirmedText(p[l]),
  publishBlockers: (p, ctx) => getGalleryPublishBlockers(p, ctx),
  isRenderable: () => isGalleryRenderable(),
};

export const SERVICE_KIND: ContentKind<CmsService> = {
  key: "service",
  label: "Послуги",
  dir: "src/content/cms/services",
  snapshotKey: "services",
  coerce: coerceService,
  displayTitle: (s) => s.uk.title || s.id,
  langStatus: (s, l, ctx) => getServiceLangStatus(s, l, ctx),
  confirmedText: (s, l) => serviceConfirmedText(s[l]),
  publishBlockers: (s, ctx) => getServicePublishBlockers(s, ctx),
  isRenderable: () => isServiceRenderable(),
};

export const CONTACT_KIND: ContentKind<CmsContact> = {
  key: "contact",
  label: "Контакти й графік",
  dir: "src/content/cms/contact",
  snapshotKey: "contact",
  singleEntry: true,
  coerce: coerceContact,
  displayTitle: () => "Контакти сайту",
  langStatus: (c, l, ctx) => getContactLangStatus(c, l, ctx),
  confirmedText: (c, l) => contactConfirmedText(c[l]),
  publishBlockers: (c, ctx) => getContactPublishBlockers(c, ctx),
  isRenderable: () => isContactRenderable(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const KINDS: Record<KindKey, ContentKind<any>> = {
  car: CAR_KIND,
  gallery: GALLERY_KIND,
  service: SERVICE_KIND,
  contact: CONTACT_KIND,
};

export const KIND_ORDER: KindKey[] = ["car", "gallery", "service", "contact"];
