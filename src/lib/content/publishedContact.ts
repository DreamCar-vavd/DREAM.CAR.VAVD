import "server-only";
import type { ContentLocale } from "./carsGate";
import type { CmsContact } from "./contactGate";
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
  /** localized labels for the current locale */
  heading: string;
  subheading: string;
  hoursLabel: string;
  addressLabel: string;
}

const EMPTY: CmsContact["uk"] = { heading: "", subheading: "", hoursLabel: "", addressLabel: "" };

/**
 * The published site contact block for one locale. `present: false` means the
 * owner has not published a contact record yet — callers keep their previous
 * behaviour (env vars + hardcoded defaults in src/lib/social.ts).
 */
export async function getContactData(locale: ContentLocale): Promise<SiteContactData> {
  const { contact } = await readSiteContent();
  const c = contact[0];
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
      ...EMPTY,
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
    heading: l.heading,
    subheading: l.subheading,
    hoursLabel: l.hoursLabel,
    addressLabel: l.addressLabel,
  };
}
