export interface SocialLink {
  name: "WhatsApp" | "Telegram" | "Instagram" | "Facebook" | "YouTube";
  url: string;
}

export const whatsappUrl = "https://wa.me/447706054203";

export function getSocialLinks(): SocialLink[] {
  const entries: Array<[SocialLink["name"], string | undefined]> = [
    ["WhatsApp", whatsappUrl],
    ["Telegram", process.env.NEXT_PUBLIC_TELEGRAM_URL],
    ["Instagram", process.env.NEXT_PUBLIC_INSTAGRAM_URL],
    ["Facebook", process.env.NEXT_PUBLIC_FACEBOOK_URL],
    ["YouTube", process.env.NEXT_PUBLIC_YOUTUBE_URL],
  ];

  return entries
    .filter((entry): entry is [SocialLink["name"], string] => Boolean(entry[1]))
    .map(([name, url]) => ({ name, url }));
}
export const phoneHref = "tel:+447706054203";
export const phoneDisplay = "+44 7706 054203";
export const emailHref = "mailto:dream.car.vavd@gmail.com";
export const emailDisplay = "dream.car.vavd@gmail.com";
