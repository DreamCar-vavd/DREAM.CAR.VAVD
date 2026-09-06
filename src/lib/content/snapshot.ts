import "server-only";
import { cache } from "react";
import { promises as fs } from "node:fs";
import { LOCALES, type CmsCar } from "./carsGate";
import type { CmsGalleryProject } from "./galleryGate";
import { coerceCar, coerceGalleryProject } from "./coerce";
import { PUBLISHED_FILE } from "./paths";

/**
 * The published snapshot is the ONLY content the public site reads.
 *
 * Build-time sanity assertions (report/34 §4): the panel only writes
 * publishable items, so these should never fire — but a hand-edited or
 * corrupted published.json FAILS `next build`, and Vercel keeps the previous
 * good deployment rather than shipping a broken page.
 */

function assertCarSane(car: CmsCar): void {
  const w = `published.json → car "${car?.id ?? "?"}"`;
  if (!car?.id) throw new Error(`${w}: missing id`);
  if (!car.photos?.filter((p) => p?.image?.trim()).length) throw new Error(`${w}: no photos`);
  if (car.video?.mode === "uploaded-file") throw new Error(`${w}: video "uploaded-file" not connected`);
  for (const l of LOCALES) {
    if (!String(car[l]?.title ?? "").trim() || !String(car[l]?.specLine ?? "").trim()) {
      throw new Error(`${w}: ${l.toUpperCase()} title/specLine empty`);
    }
  }
}

function assertGallerySane(p: CmsGalleryProject): void {
  const w = `published.json → gallery "${p?.id ?? "?"}"`;
  if (!p?.id) throw new Error(`${w}: missing id`);
  if (!p.photos?.filter((x) => x?.image?.trim()).length) throw new Error(`${w}: no photos`);
  for (const l of LOCALES) {
    if (!String(p[l]?.title ?? "").trim()) throw new Error(`${w}: ${l.toUpperCase()} title empty`);
  }
}

export interface PublishedSnapshot {
  publishedAt: string;
  cars: CmsCar[];
  gallery: CmsGalleryProject[];
}

export const readPublishedSnapshot = cache(async (): Promise<PublishedSnapshot> => {
  let raw: string;
  try {
    raw = await fs.readFile(PUBLISHED_FILE, "utf8");
  } catch {
    return { publishedAt: "", cars: [], gallery: [] };
  }
  const parsed = JSON.parse(raw) as {
    publishedAt?: string;
    cars?: Record<string, unknown>[];
    gallery?: Record<string, unknown>[];
  };
  const cars = (parsed.cars ?? [])
    .map((c) => coerceCar(String(c.id ?? ""), c))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const gallery = (parsed.gallery ?? [])
    .map((g) => coerceGalleryProject(String(g.id ?? ""), g))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  cars.forEach(assertCarSane);
  gallery.forEach(assertGallerySane);
  return { publishedAt: parsed.publishedAt ?? "", cars, gallery };
});
