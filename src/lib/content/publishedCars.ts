import "server-only";
import { cache } from "react";
import { promises as fs } from "node:fs";
import type { ContentLocale } from "./carsGate";
import { LOCALES, isRenderable, type CmsCar } from "./carsGate";
import { formatMileage } from "./mileage";
import { PUBLISHED_FILE } from "./paths";

/** Shapes the existing site components already consume. */
export interface CarListingCopy {
  title: string;
  year: string;
  specLine: string;
  mileage: string;
  price: string;
  viewGallery: string;
}
export interface CarMedia {
  id: string;
  photos: { src: string }[];
  video: { src: string; posterSrc: string } | null;
}

interface PublishedSnapshot {
  publishedAt: string;
  cars: CmsCar[];
}

/**
 * Build-time sanity assertion (report/34 §4). The panel only ever writes
 * publishable cars into the snapshot, so this should never fire — but if the
 * file is hand-edited or corrupted, we FAIL `next build` rather than ship a
 * broken car. Vercel keeps the previous good deployment on a failed build.
 */
function assertSane(car: CmsCar): void {
  const where = `published.json → car "${car?.id ?? "?"}"`;
  if (!car || typeof car.id !== "string" || !car.id) {
    throw new Error(`${where}: missing id`);
  }
  const photos = Array.isArray(car.photos) ? car.photos.filter((p) => p?.image?.trim()) : [];
  if (photos.length === 0) throw new Error(`${where}: no photos`);
  if (car.video?.mode === "uploaded-file") {
    throw new Error(`${where}: video mode "uploaded-file" is not connected`);
  }
  for (const locale of LOCALES) {
    const lang = car[locale];
    if (!String(lang?.title ?? "").trim() || !String(lang?.specLine ?? "").trim()) {
      throw new Error(`${where}: ${locale.toUpperCase()} title/specLine empty`);
    }
  }
}

const readSnapshot = cache(async (): Promise<PublishedSnapshot> => {
  let raw: string;
  try {
    raw = await fs.readFile(PUBLISHED_FILE, "utf8");
  } catch {
    return { publishedAt: "", cars: [] };
  }
  const parsed = JSON.parse(raw) as PublishedSnapshot;
  const cars = Array.isArray(parsed.cars) ? parsed.cars : [];
  cars.forEach(assertSane);
  cars.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return { publishedAt: parsed.publishedAt ?? "", cars };
});

/** Published cars that should render publicly (sold / preparing filtered out). */
async function getVisibleCars(): Promise<CmsCar[]> {
  const { cars } = await readSnapshot();
  return cars.filter(isRenderable);
}

function toPublicImagePath(stored: string): string {
  if (!stored) return "";
  return stored.startsWith("/") || stored.startsWith("http")
    ? stored
    : `/images/cms/cars/${stored}`;
}

/** `{ [id]: CarListingCopy }` for one locale — drop-in for dict.carsForSale.listings. */
export async function getCarListingCopy(
  locale: ContentLocale,
): Promise<Record<string, CarListingCopy>> {
  const cars = await getVisibleCars();
  const out: Record<string, CarListingCopy> = {};
  for (const car of cars) {
    const lang = car[locale];
    const photoCount = car.photos.filter((p) => p.image).length;
    out[car.id] = {
      title: lang.title,
      year: car.year,
      specLine: lang.specLine,
      mileage: formatMileage(car.mileageValue, locale),
      price: car.price,
      viewGallery: lang.viewGalleryLabel || `${photoCount}`,
    };
  }
  return out;
}

/** Media for the visible published cars, in display order. */
export async function getPublicCarMedia(): Promise<CarMedia[]> {
  const cars = await getVisibleCars();
  return cars.map((car) => ({
    id: car.id,
    photos: car.photos.filter((p) => p.image).map((p) => ({ src: toPublicImagePath(p.image) })),
    video:
      car.video &&
      (car.video.mode === "legacy-file" || car.video.mode === "external-link") &&
      car.video.src
        ? { src: car.video.src, posterSrc: toPublicImagePath(car.video.posterSrc) }
        : null,
  }));
}
