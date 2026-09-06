import "server-only";
import { cache } from "react";
import { draftMode } from "next/headers";
import { createHash } from "node:crypto";
import type { CmsCar } from "./carsGate";
import type { CmsGalleryProject } from "./galleryGate";
import { coerceCar, coerceGalleryProject } from "./coerce";
import { readPublishedSnapshot } from "./snapshot";

export interface SiteContent {
  cars: CmsCar[];
  gallery: CmsGalleryProject[];
  /** true when the reader served the unpublished WORKING copy (draft preview). */
  isDraftPreview: boolean;
  /** short id of the working version being previewed (github mode). */
  draftVersion?: string;
  /** set when a draft was requested but could not be served / had to fall back. */
  draftError?: string;
}

const shortHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);

function coerce<T extends { id: string; order: number }>(
  entries: { name: string; text: string }[],
  fn: (id: string, raw: Record<string, unknown>) => T,
): T[] {
  return entries
    .map((e) => fn(e.name.replace(/\.json$/, ""), JSON.parse(e.text || "{}")))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/**
 * The content the public pages render.
 *
 * - Normal request: the published snapshot — what the owner explicitly
 *   published. Routes stay statically generated.
 * - Draft-preview request (Next.js Draft Mode cookie set by /api/panel/preview
 *   for an authorised user): the current WORKING copy, read through the panel
 *   storage adapter:
 *     · local dev  -> the files on disk
 *     · github mode -> the GitHub API using the signed-in user's token, which
 *       is re-checked on EVERY draft render — a revoked session immediately
 *       stops serving drafts (falls back to published), the stale Draft Mode
 *       cookie alone is never enough.
 *   Draft Mode already forces `Cache-Control: private, no-store`, so a draft
 *   render never lands in a shared cache.
 */
export const readSiteContent = cache(async (): Promise<SiteContent> => {
  const isDraftPreview = (await draftMode()).isEnabled;
  const snap = await readPublishedSnapshot();
  const published: SiteContent = {
    cars: snap.cars,
    gallery: snap.gallery,
    isDraftPreview: false,
  };
  if (!isDraftPreview) return published;

  const { getStorage, NotConnectedError } = await import("./store");
  let storage;
  try {
    storage = await getStorage(); // re-checks the GitHub session in hosted mode
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return { ...published, draftError: "Сесію завершено або відкликано — перегляд чернетки недоступний." };
    }
    throw err;
  }

  try {
    const [carsDir, galleryDir] = await Promise.all([
      storage.readDir("src/content/cms/cars"),
      storage.readDir("src/content/cms/gallery"),
    ]);
    return {
      cars: coerce(carsDir.data, coerceCar),
      gallery: coerce(galleryDir.data, coerceGalleryProject),
      isDraftPreview: true,
      draftVersion: shortHash(`${carsDir.version}|${galleryDir.version}`),
    };
  } catch (err) {
    return {
      ...published,
      isDraftPreview: true,
      draftError: `Не вдалося завантажити чернетку з GitHub: ${(err as Error).message}`,
    };
  }
});
