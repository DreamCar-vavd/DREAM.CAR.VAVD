import "server-only";
import type { ContentLocale } from "./carsGate";
import { isRenderable, type CmsCar } from "./carsGate";
import { formatMileage } from "./mileage";
import { readPublishedSnapshot } from "./snapshot";

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

async function getVisibleCars(): Promise<CmsCar[]> {
  const { cars } = await readPublishedSnapshot();
  return cars.filter(isRenderable);
}

const toPublicImagePath = (s: string) =>
  !s ? "" : s.startsWith("/") || s.startsWith("http") ? s : `/images/cms/cars/${s}`;

/** `{ [id]: CarListingCopy }` for one locale — drop-in for dict.carsForSale.listings. */
export async function getCarListingCopy(
  locale: ContentLocale,
): Promise<Record<string, CarListingCopy>> {
  const out: Record<string, CarListingCopy> = {};
  for (const car of await getVisibleCars()) {
    const lang = car[locale];
    out[car.id] = {
      title: lang.title,
      year: car.year,
      specLine: lang.specLine,
      mileage: formatMileage(car.mileageValue, locale),
      price: car.price,
      viewGallery: lang.viewGalleryLabel || `${car.photos.filter((p) => p.image).length}`,
    };
  }
  return out;
}

/** Media for the visible published cars, in display order. */
export async function getPublicCarMedia(): Promise<CarMedia[]> {
  return (await getVisibleCars()).map((car) => ({
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
