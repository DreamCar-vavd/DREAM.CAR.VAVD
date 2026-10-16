import "server-only";
import type { ContentLocale } from "./carsGate";
import type { CmsContact } from "./contactGate";
import { EMPTY_HOURS, type BusinessHours } from "./businessHours";
import { readSiteContent } from "./siteContent";

export interface SiteContactData {
  present: boolean;
  phoneDisplay: string;
  phoneE164: string;
  email: string;
  whatsappNumber: string;
  telegramUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  addressText: string;
  mapsUrl: string;
  hours: string;
  /** Structured schedule, shared by every locale (page + JSON-LD). */
  businessHours: BusinessHours;
  /** localized labels for the current locale */
  heading: string;
  subheading: string;
  hoursLabel: string;
  addressLabel: string;
  serviceArea: string;
}

const EMPTY: CmsContact["uk"] = {
  heading: "",
  subheading: "",
  hoursLabel: "",
  addressLabel: "",
  serviceArea: "",
};

/**
 * The published site contact block for one locale. `present: false` means the
 * owner has not published a contact record yet — callers keep their previous
 * behaviour (env vars + hardcoded defaults in src/lib/social.ts).
 */
export async function getContactData(locale: ContentLocale): Promise<SiteContactData> {
  const { contact } = await readSiteContent();
  // Contacts are a single record. Read the canonical `site` entry explicitly —
  // never "whichever sorts first" — so a stray second record can't change what
  // the site shows.
  const c = contact.find((x) => x.id === "site") ?? null;
  if (!c) {
    return {
      present: false,
      phoneDisplay: "",
      phoneE164: "",
      email: "",
      whatsappNumber: "",
      telegramUrl: "",
      instagramUrl: "",
      facebookUrl: "",
      youtubeUrl: "",
      addressText: "",
      mapsUrl: "",
      hours: "",
      businessHours: EMPTY_HOURS,
      ...EMPTY,
      serviceArea: "",
    };
  }
  const l = c[locale] ?? EMPTY;
  return {
    present: true,
    phoneDisplay: c.phoneDisplay,
    phoneE164: c.phoneE164,
    email: c.email,
    whatsappNumber: c.whatsappNumber,
    telegramUrl: c.telegramUrl,
    instagramUrl: c.instagramUrl,
    facebookUrl: c.facebookUrl,
    youtubeUrl: c.youtubeUrl,
    addressText: c.addressText,
    mapsUrl: c.mapsUrl,
    hours: c.hours,
    businessHours: {
      weekdayOpen: c.weekdayOpen ?? "",
      weekdayClose: c.weekdayClose ?? "",
      saturdayOpen: c.saturdayOpen ?? "",
      saturdayClose: c.saturdayClose ?? "",
      sundayMode: c.sundayMode ?? EMPTY_HOURS.sundayMode,
    },
    heading: l.heading,
    subheading: l.subheading,
    hoursLabel: l.hoursLabel,
    addressLabel: l.addressLabel,
    serviceArea: l.serviceArea ?? "",
  };
}
