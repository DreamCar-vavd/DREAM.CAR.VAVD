import "server-only";
import type { Dictionary } from "@/content/types";
import type { Locale } from "./config";
import { getCarListingCopy } from "@/lib/content/publishedCars";
import { getGalleryProjectCopy } from "@/lib/content/publishedGallery";
import { getServiceCopyForDict } from "@/lib/content/publishedServices";
import { getContactData } from "@/lib/content/publishedContact";
import { DEFAULT_CONTACT, telHref, whatsappUrlFromNumber } from "@/lib/social";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  uk: () => import("@/content/dictionaries/uk").then((m) => m.default),
  ru: () => import("@/content/dictionaries/ru").then((m) => m.default),
  en: () => import("@/content/dictionaries/en").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const [base, carListings, galleryProjects, serviceCopy, contact] = await Promise.all([
    dictionaries[locale](),
    getCarListingCopy(locale),
    getGalleryProjectCopy(locale),
    getServiceCopyForDict(locale),
    getContactData(locale),
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
      projects: { ...base.gallery.projects, ...galleryProjects },
    },
    // Services come from the panel snapshot; static dict values stay as the
    // fallback for any slug not yet published.
    services: { ...base.services, ...serviceCopy },
    contact: {
      ...base.contact,
      heading: (contact.present && contact.heading) || base.contact.heading,
      subheading: (contact.present && contact.subheading) || base.contact.subheading,
      phone: (contact.present && contact.phoneDisplay) || base.contact.phone || DEFAULT_CONTACT.phoneDisplay,
      email: (contact.present && contact.email) || base.contact.email || DEFAULT_CONTACT.email,
      phoneHref:
        (contact.present && contact.phoneE164 && telHref(contact.phoneE164)) ||
        DEFAULT_CONTACT.phoneHref,
      emailHref: `mailto:${(contact.present && contact.email) || DEFAULT_CONTACT.email}`,
      whatsappUrl:
        (contact.present && whatsappUrlFromNumber(contact.whatsappNumber)) ||
        DEFAULT_CONTACT.whatsappUrl,
      telegramUrl: (contact.present && contact.telegramUrl) || process.env.NEXT_PUBLIC_TELEGRAM_URL || "",
      instagramUrl: (contact.present && contact.instagramUrl) || process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
      facebookUrl: (contact.present && contact.facebookUrl) || process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
      youtubeUrl: (contact.present && contact.youtubeUrl) || process.env.NEXT_PUBLIC_YOUTUBE_URL || "",
      addressText: (contact.present && contact.addressText) || process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "",
      mapsUrl: (contact.present && contact.mapsUrl) || process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL || "",
      hours: (contact.present && contact.hours) || "",
      hoursLabel: (contact.present && contact.hoursLabel) || "",
      addressLabel: (contact.present && contact.addressLabel) || "",
    },
  };
}
