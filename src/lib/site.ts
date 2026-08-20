import { locales, defaultLocale, type Locale } from "@/lib/i18n/config";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dream-car-vavd.com").replace(
  /\/$/,
  "",
);

export function buildLanguageAlternates(pathForLocale: (locale: Locale) => string) {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = `${siteUrl}${pathForLocale(locale)}`;
  }
  languages["x-default"] = `${siteUrl}${pathForLocale(defaultLocale)}`;
  return languages;
}
