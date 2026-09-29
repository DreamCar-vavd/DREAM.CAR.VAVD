/**
 * Publish gate for Gallery projects — the copy shown in the gallery modal.
 *
 * Stage boundary (report/35 §7): this stage makes the gallery TEXT (all three
 * languages) editable, reviewable and publishable through the same pipeline as
 * cars. Which photos belong to a project, their order and captions still come
 * from the static media map (src/content/galleryProjects.ts) and are the next
 * sub-stage; adding a brand-new album is not yet possible.
 *
 * Pure, dependency-free. Shares the storage / versioning / review-hash /
 * snapshot machinery in panelStore — nothing is duplicated here.
 */
import {
  LOCALES,
  reviewInstanceMatches,
  reviewRowFor,
  type ContentLocale,
  type GateContext,
  type GateFailure,
  type LangReviewStatus,
} from "./carsGate";
import { parseYoutubeUrl } from "../media/youtube";

export type GalleryKind = "album" | "showcase";

export interface CmsGalleryLanguage {
  title: string;
  shortDescription: string;
  longDescription: string;
  service: string;
  clientRequest: string;
  completedItems: string[];
  result: string;
}

export interface CmsGalleryProject {
  id: string;
  order: number;
  kind: GalleryKind;
  year: string;
  photos: { image: string; caption: string }[];
  videoUrl: string;
  showContactCta: boolean;
  uk: CmsGalleryLanguage;
  en: CmsGalleryLanguage;
  ru: CmsGalleryLanguage;
}

const REQUIRED = ["title"] as const;

/** Fields whose change invalidates a prior review (canonical JSON). */
export function galleryConfirmedText(lang: CmsGalleryLanguage): string {
  return JSON.stringify({
    title: (lang?.title ?? "").trim(),
    shortDescription: (lang?.shortDescription ?? "").trim(),
    longDescription: (lang?.longDescription ?? "").trim(),
    service: (lang?.service ?? "").trim(),
    clientRequest: (lang?.clientRequest ?? "").trim(),
    completedItems: (lang?.completedItems ?? []).map((s) => s.trim()).filter(Boolean),
    result: (lang?.result ?? "").trim(),
  });
}

export function getGalleryLangStatus(
  project: CmsGalleryProject,
  locale: ContentLocale,
  ctx: GateContext = {},
): LangReviewStatus {
  const lang = project[locale];
  if (!REQUIRED.every((f) => String(lang?.[f] ?? "").trim())) return "empty";
  const confirmedHash = reviewRowFor(ctx, project.id)?.[locale]?.hash;
  if (confirmedHash === undefined) return "needs-review";
  if (!reviewInstanceMatches(ctx, project.id)) return "needs-review";
  if (ctx.sha256 && confirmedHash !== ctx.sha256(galleryConfirmedText(lang))) return "needs-review";
  return "reviewed";
}

export function getGalleryPublishBlockers(
  project: CmsGalleryProject,
  ctx: GateContext = {},
): GateFailure[] {
  const failures: GateFailure[] = [];
  const realPhotos = Array.isArray(project.photos)
    ? project.photos.filter((p) => p?.image?.trim())
    : [];
  if (realPhotos.length === 0) failures.push({ kind: "no-photos" });

  // The optional per-project YouTube link. Empty is fine (the modal shows its
  // disabled "video coming soon" button); a non-empty value must pass the same
  // strict check as the car video link, so an invalid link is never published.
  const videoUrl = (project.videoUrl ?? "").trim();
  if (videoUrl) {
    const parsed = parseYoutubeUrl(videoUrl);
    if (!parsed.ok) failures.push({ kind: "video-link-invalid", reason: parsed.reason });
  }

  for (const locale of LOCALES) {
    const lang = project[locale];
    for (const field of REQUIRED) {
      if (!String(lang?.[field] ?? "").trim()) {
        failures.push({ kind: "missing-field", locale, field });
      }
    }
    const filled = REQUIRED.every((f) => String(lang?.[f] ?? "").trim());
    if (filled && getGalleryLangStatus(project, locale, ctx) !== "reviewed") {
      failures.push({ kind: "needs-review", locale });
    }
  }
  return failures;
}

/** Every published gallery project renders (no sold/hidden concept). */
export function isGalleryRenderable(): boolean {
  return true;
}
