import "server-only";
import { cache } from "react";
import { draftMode } from "next/headers";
import { createHash } from "node:crypto";
import type { CmsCar } from "./carsGate";
import type { CmsGalleryProject } from "./galleryGate";
import type { CmsService } from "./serviceGate";
import type { CmsContact } from "./contactGate";
import type { CmsPromo } from "./promoGate";
import { coerceCar, coerceContact, coerceGalleryProject, coercePromo, coerceService } from "./coerce";
import { readPublishedSnapshot } from "./snapshot";

export interface SiteContent {
  cars: CmsCar[];
  gallery: CmsGalleryProject[];
  services: CmsService[];
  contact: CmsContact[];
  promos: CmsPromo[];
  isDraftPreview: boolean;
  draftVersion?: string;
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
 * - Normal request: the published snapshot. Routes stay statically generated.
 * - Draft preview (Draft Mode cookie set by /api/panel/preview for an
 *   authorised user): the current WORKING copy through the panel storage
 *   adapter — local files in dev, or the GitHub API with the signed-in user's
 *   token (re-checked EVERY render) in hosted mode. Draft Mode already forces
 *   Cache-Control: private, no-store.
 */
export const readSiteContent = cache(async (): Promise<SiteContent> => {
  const isDraftPreview = (await draftMode()).isEnabled;
  const snap = await readPublishedSnapshot();
  const published: SiteContent = {
    cars: snap.cars,
    gallery: snap.gallery,
    services: snap.services,
    contact: snap.contact,
    promos: snap.promos,
    isDraftPreview: false,
  };
  if (!isDraftPreview) return published;

  const { getStorage, NotConnectedError } = await import("./store");
  let storage;
  try {
    storage = await getStorage();
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return { ...published, draftError: "Сесію завершено або відкликано — перегляд чернетки недоступний." };
    }
    throw err;
  }

  try {
    const [carsDir, galleryDir, servicesDir, contactDir, promosDir] = await Promise.all([
      storage.readDir("src/content/cms/cars"),
      storage.readDir("src/content/cms/gallery"),
      storage.readDir("src/content/cms/services"),
      storage.readDir("src/content/cms/contact"),
      storage.readDir("src/content/cms/promos"),
    ]);
    return {
      cars: coerce(carsDir.data, coerceCar),
      gallery: coerce(galleryDir.data, coerceGalleryProject),
      services: coerce(servicesDir.data, coerceService),
      contact: coerce(contactDir.data, (id, r) => coerceContact(id, r)),
      promos: coerce(promosDir.data, coercePromo),
      isDraftPreview: true,
      draftVersion: shortHash(
        [carsDir, galleryDir, servicesDir, contactDir, promosDir].map((d) => d.version).join("|"),
      ),
    };
  } catch (err) {
    return {
      ...published,
      isDraftPreview: true,
      draftError: `Не вдалося завантажити чернетку з GitHub: ${(err as Error).message}`,
    };
  }
});
