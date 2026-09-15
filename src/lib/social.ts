export interface SocialLink {
  name: "WhatsApp" | "Telegram" | "Instagram" | "Facebook" | "YouTube";
  url: string;
}

/**
 * Pre-panel defaults. Now the fallback used by getDictionary() when no
 * contact record is published in the panel; a published record overrides
 * every value. The technical submission recipient (CONTACT_FORM_ENDPOINT)
 * is NOT here — it stays an env var.
 */
export const DEFAULT_CONTACT = {
  phoneDisplay: "+44 7706 054203",
  phoneHref: "tel:+447706054203",
  email: "dream.car.vavd@gmail.com",
  emailHref: "mailto:dream.car.vavd@gmail.com",
  whatsappUrl: "https://wa.me/447706054203",
} as const;

// Back-compat re-exports (still imported in a few static places).
export const whatsappUrl = DEFAULT_CONTACT.whatsappUrl;
export const phoneHref = DEFAULT_CONTACT.phoneHref;
export const phoneDisplay = DEFAULT_CONTACT.phoneDisplay;
export const emailHref = DEFAULT_CONTACT.emailHref;
export const emailDisplay = DEFAULT_CONTACT.email;

/** URL builders / validators reused by getDictionary + the contact gate. */
export function whatsappUrlFromNumber(n: string): string {
  const digits = n.replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}
export function telHref(e164: string): string {
  const cleaned = e164.replace(/[^0-9+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

export function getSocialLinks(from?: {
  whatsappUrl?: string;
  telegramUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
}): SocialLink[] {
  const entries: Array<[SocialLink["name"], string | undefined]> = [
    ["WhatsApp", from?.whatsappUrl || DEFAULT_CONTACT.whatsappUrl],
    ["Telegram", from?.telegramUrl || process.env.NEXT_PUBLIC_TELEGRAM_URL],
    ["Instagram", from?.instagramUrl || process.env.NEXT_PUBLIC_INSTAGRAM_URL],
    ["Facebook", from?.facebookUrl || process.env.NEXT_PUBLIC_FACEBOOK_URL],
    ["YouTube", from?.youtubeUrl || process.env.NEXT_PUBLIC_YOUTUBE_URL],
  ];
  return entries
    .filter((e): e is [SocialLink["name"], string] => Boolean(e[1]))
    .map(([name, url]) => ({ name, url }));
}
