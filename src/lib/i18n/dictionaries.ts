import "server-only";
import type { Dictionary } from "@/content/types";
import type { Locale } from "./config";
import { getCarListingCopy } from "@/lib/content/publishedCars";
import { getGalleryProjectCopy } from "@/lib/content/publishedGallery";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  uk: () => import("@/content/dictionaries/uk").then((m) => m.default),
  ru: () => import("@/content/dictionaries/ru").then((m) => m.default),
  en: () => import("@/content/dictionaries/en").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const [base, carListings, galleryProjects] = await Promise.all([
    dictionaries[locale](),
    getCarListingCopy(locale),
    getGalleryProjectCopy(locale),
  ]);

  // Gallery album titles follow their project's title for the current locale.
  const albums = { ...base.gallery.albums };
  const maserati = galleryProjects["maserati-levante"];
  const volvo = galleryProjects["volvo-xc60-d5"];
  if (maserati?.title) albums.maseratiLevante = { ...albums.maseratiLevante, title: maserati.title };
  if (volvo?.title) albums.volvoXc60D5 = { ...albums.volvoXc60D5, title: volvo.title };

  return {
    ...base,
    carsForSale: { ...base.carsForSale, listings: carListings },
    gallery: {
      ...base.gallery,
      albums,
      // Only published projects; the grid renders a card only when the
      // project id is present here (empty object -> falls back per project).
      projects: { ...base.gallery.projects, ...galleryProjects },
    },
  };
}
