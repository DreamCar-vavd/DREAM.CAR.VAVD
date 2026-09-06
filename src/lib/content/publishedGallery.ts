import "server-only";
import type { ContentLocale } from "./carsGate";
import type { GalleryProjectCopy } from "@/content/types";
import { readPublishedSnapshot } from "./snapshot";

/**
 * Gallery TEXT for one locale, keyed by project id — a drop-in for
 * dict.gallery.projects. Only published projects appear. Which photos each
 * project shows is still resolved from the static media map by id (next
 * sub-stage), so an unpublished project keeps its media but shows no card.
 */
export async function getGalleryProjectCopy(
  locale: ContentLocale,
): Promise<Record<string, GalleryProjectCopy>> {
  const { gallery } = await readPublishedSnapshot();
  const out: Record<string, GalleryProjectCopy> = {};
  for (const p of gallery) {
    const lang = p[locale];
    out[p.id] = {
      title: lang.title,
      year: p.year,
      service: lang.service,
      clientRequest: lang.clientRequest,
      completedItems: lang.completedItems,
      result: lang.result,
    };
  }
  return out;
}

/** Published project ids (for the grid to know which cards to render). */
export async function getPublishedGalleryIds(): Promise<Set<string>> {
  const { gallery } = await readPublishedSnapshot();
  return new Set(gallery.map((p) => p.id));
}

/** Album title override for one locale (dict.gallery.albums.<key>.title). */
export async function getGalleryAlbumTitle(
  id: string,
  locale: ContentLocale,
): Promise<string | undefined> {
  const { gallery } = await readPublishedSnapshot();
  return gallery.find((p) => p.id === id)?.[locale].title;
}
