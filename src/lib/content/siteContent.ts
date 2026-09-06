import "server-only";
import { cache } from "react";
import { draftMode } from "next/headers";
import type { CmsCar } from "./carsGate";
import type { CmsGalleryProject } from "./galleryGate";
import { readPublishedSnapshot } from "./snapshot";

export interface SiteContent {
  cars: CmsCar[];
  gallery: CmsGalleryProject[];
  /** true when the reader served the unpublished WORKING copy (draft preview). */
  isDraftPreview: boolean;
}

/**
 * The content the public pages render.
 *
 * - Normal request: the published snapshot (report/34) — what the owner
 *   explicitly published. The route stays statically generated.
 * - Draft-preview request (Next.js Draft Mode cookie, set only for an
 *   authorised panel user by /api/panel/preview): the current WORKING copy,
 *   shown exactly as it would go live — including still-unconfirmed languages
 *   and not-yet-published items.
 *
 * The working-copy reader is imported lazily so the static build never traces
 * its dynamic directory reads.
 */
export const readSiteContent = cache(async (): Promise<SiteContent> => {
  const isDraftPreview = (await draftMode()).isEnabled;
  if (!isDraftPreview) {
    const snap = await readPublishedSnapshot();
    return { cars: snap.cars, gallery: snap.gallery, isDraftPreview: false };
  }
  const { readWorkingContent } = await import("./workingReader");
  const { cars, gallery } = await readWorkingContent();
  return { cars, gallery, isDraftPreview: true };
});
