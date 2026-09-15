import "server-only";
import type { ContentLocale } from "./carsGate";
import type { GalleryProjectCopy } from "@/content/types";
import { readSiteContent } from "./siteContent";
import { imageSize } from "./imageSize";

export interface GalleryMediaPhoto {
  src: string;
  width: number;
  height: number;
  caption: string;
}
export interface GalleryMediaEntry {
  id: string;
  kind: "album" | "showcase";
  /** 1-based position among albums; 0 for showcase cards. */
  albumNumber: number;
  showContactCta: boolean;
  images: GalleryMediaPhoto[];
}

const DEFAULT_DIM = { width: 4, height: 3 };

/**
 * Which photos each published gallery project shows, in order, with intrinsic
 * dimensions read from the files at build time. Drives the grid cards and the
 * modal — the static media map (galleryProjects.ts) is no longer used.
 */
export async function getGalleryMedia(): Promise<GalleryMediaEntry[]> {
  const { gallery } = await readSiteContent();
  let albumNo = 0;
  const out: GalleryMediaEntry[] = [];
  for (const p of gallery) {
    const isAlbum = p.kind === "album";
    if (isAlbum) albumNo += 1;
    const images: GalleryMediaPhoto[] = [];
    for (const photo of p.photos.filter((x) => x.image)) {
      const dim = (await imageSize(photo.image)) ?? DEFAULT_DIM;
      images.push({ src: photo.image, width: dim.width, height: dim.height, caption: photo.caption });
    }
    if (images.length === 0) continue; // gate already blocks this; belt-and-braces
    out.push({
      id: p.id,
      kind: p.kind,
      albumNumber: isAlbum ? albumNo : 0,
      showContactCta: p.showContactCta,
      images,
    });
  }
  return out;
}

/**
 * Gallery TEXT for one locale, keyed by project id — a drop-in for
 * dict.gallery.projects. Only published projects appear. Which photos each
 * project shows is still resolved from the static media map by id (next
 * sub-stage), so an unpublished project keeps its media but shows no card.
 */
export async function getGalleryProjectCopy(
  locale: ContentLocale,
): Promise<Record<string, GalleryProjectCopy>> {
  const { gallery } = await readSiteContent();
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

