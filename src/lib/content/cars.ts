import "server-only";
import { cache } from "react";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { ContentLocale } from "./carsGate";
import {
  getCarGateFailures,
  getPublishBlockers,
  isCarPubliclyVisible,
  type CmsCar,
  type GateFailure,
  type TranslationLocks,
} from "./carsGate";
import { formatMileage } from "./mileage";

const CARS_DIR = path.join(process.cwd(), "src/content/cms/cars");
const LOCKS_FILE = path.join(process.cwd(), "src/content/cms/translation-locks.json");
const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");

/** Shape the existing site components already consume. */
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

function coerceCar(id: string, raw: Record<string, unknown>): CmsCar {
  const lang = (v: unknown) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return {
      title: String(o.title ?? ""),
      specLine: String(o.specLine ?? ""),
      description: String(o.description ?? ""),
      viewGalleryLabel: String(o.viewGalleryLabel ?? ""),
      reviewState: o.reviewState === "confirmed" ? ("confirmed" as const) : ("draft" as const),
    };
  };
  const photos = Array.isArray(raw.photos)
    ? (raw.photos as Record<string, unknown>[]).map((p) => ({
        image: String(p?.image ?? ""),
        caption: String(p?.caption ?? ""),
      }))
    : [];
  const v = (raw.video ?? {}) as Record<string, unknown>;
  return {
    id,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 100,
    publishState: raw.publishState === "published" ? "published" : "draft",
    saleStatus: (["preparing", "for-sale", "reserved", "sold"].includes(String(raw.saleStatus))
      ? raw.saleStatus
      : "for-sale") as CmsCar["saleStatus"],
    year: String(raw.year ?? ""),
    price: String(raw.price ?? ""),
    mileageValue: Number(raw.mileageValue ?? 0),
    photos,
    video: {
      mode: String(v.mode ?? "none"),
      src: String(v.src ?? ""),
      posterSrc: String(v.posterSrc ?? ""),
    },
    uk: lang(raw.uk),
    en: lang(raw.en),
    ru: lang(raw.ru),
  };
}

const KS_IMAGE_PUBLIC_PATH = "/images/cms/cars/";

/** Keystatic image fields store a bare filename; the reader restores the URL. */
function toPublicImagePath(stored: string): string {
  if (!stored) return "";
  if (stored.startsWith("/") || stored.startsWith("http")) return stored;
  return KS_IMAGE_PUBLIC_PATH + stored;
}

export const readAllCars = cache(async (): Promise<{ cars: CmsCar[]; locks: TranslationLocks }> => {
  let locks: TranslationLocks = {};
  try {
    locks = JSON.parse(await fs.readFile(LOCKS_FILE, "utf8")) as TranslationLocks;
  } catch {
    locks = {};
  }

  let entries: string[] = [];
  try {
    entries = (await fs.readdir(CARS_DIR)).filter((f) => f.endsWith(".json") && !f.startsWith("."));
  } catch {
    return { cars: [], locks };
  }

  const cars: CmsCar[] = [];
  for (const file of entries) {
    const raw = JSON.parse(await fs.readFile(path.join(CARS_DIR, file), "utf8"));
    cars.push(coerceCar(file.replace(/\.json$/, ""), raw));
  }
  cars.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return { cars, locks };
});

/** Cars that pass the publish gate, in display order. */
export async function getPublicCars(): Promise<CmsCar[]> {
  const { cars, locks } = await readAllCars();
  return cars.filter((car) => isCarPubliclyVisible(car, { locks, sha256 }));
}

/** `{ [id]: CarListingCopy }` for one locale — drop-in for dict.carsForSale.listings. */
export async function getCarListingCopy(
  locale: ContentLocale,
): Promise<Record<string, CarListingCopy>> {
  const cars = await getPublicCars();
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

/** Media for the public cars, in display order. */
export async function getPublicCarMedia(): Promise<CarMedia[]> {
  const cars = await getPublicCars();
  return cars.map((car) => ({
    id: car.id,
    photos: car.photos.filter((p) => p.image).map((p) => ({ src: toPublicImagePath(p.image) })),
    video:
      car.video && car.video.mode !== "none" && car.video.mode !== "uploaded-file" && car.video.src
        ? { src: car.video.src, posterSrc: toPublicImagePath(car.video.posterSrc) }
        : null,
  }));
}

/** For the panel status view / content:check — every car with its gate result. */
export async function getCarsWithGate(): Promise<
  { car: CmsCar; failures: GateFailure[]; blockers: GateFailure[] }[]
> {
  const { cars, locks } = await readAllCars();
  return cars.map((car) => ({
    car,
    failures: getCarGateFailures(car, { locks, sha256 }),
    blockers: getPublishBlockers(car, { locks, sha256 }),
  }));
}
