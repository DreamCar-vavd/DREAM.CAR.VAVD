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
import { resolveDraftAccess, type DraftAccessResult } from "./draftAccess";

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

  const { getStorage } = await import("./store");
  // Re-checked on EVERY render, not only when Draft Mode was switched on: the
  // `__prerender_bypass` cookie set by /api/panel/preview has no expiry tied
  // to repo access, so a session that enabled preview while still an editor
  // would otherwise keep seeing draft content indefinitely after being
  // removed as a Collaborator — this repo is public, so a plain content read
  // alone would still succeed for that stale session. `resolveDraftAccess` is
  // the pure, testable half of this check (see draftAccess.test.ts); it fails
  // CLOSED on any error — the published snapshot, never the draft, on doubt.
  let access: DraftAccessResult;
  try {
    access = await resolveDraftAccess({ getStorage }, published);
  } catch {
    // Defense in depth: `resolveDraftAccess` already classifies every known
    // storage failure (see draftAccess.ts) and returns `ok: false` instead of
    // throwing, but this call sits BEFORE the try/catch below — an
    // unclassified error here must still fail closed to the published
    // snapshot, not crash the whole page render. Deliberately generic (no
    // err.message): an error type this function doesn't recognise is not
    // guaranteed to be secret-free.
    return {
      ...published,
      draftError: "Тимчасово не вдалося перевірити доступ до чернетки. Оновіть сторінку за хвилину.",
    };
  }
  if (!access.ok) return access.content;
  const storage = access.storage;

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
      // one record only — ignore any stray extra file in the draft copy
      contact: coerce(contactDir.data, (id, r) => coerceContact(id, r)).filter((c) => c.id === "site"),
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
