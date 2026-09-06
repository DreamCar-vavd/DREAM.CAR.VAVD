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
import { coerceCar, coerceGalleryProject } from "./coerce";
import {
  galleryConfirmedText,
  getGalleryLangStatus,
  getGalleryPublishBlockers,
  isGalleryRenderable,
  type CmsGalleryProject,
} from "./galleryGate";
import type { AllowedDir } from "./store/adapter";

export type KindKey = "car" | "gallery";

export interface ContentKind<W extends { id: string; order: number }> {
  key: KindKey;
  label: string;
  dir: AllowedDir;
  /** key of the array inside published.json */
  snapshotKey: "cars" | "gallery";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const KINDS: Record<KindKey, ContentKind<any>> = {
  car: CAR_KIND,
  gallery: GALLERY_KIND,
};
