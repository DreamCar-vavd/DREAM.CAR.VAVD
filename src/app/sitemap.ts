import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/config";
import { serviceSlugs } from "@/content/services";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    entries.push({ url: `${siteUrl}/${locale}`, changeFrequency: "monthly", priority: 1 });
    entries.push({
      url: `${siteUrl}/${locale}/privacy-policy`,
      changeFrequency: "yearly",
      priority: 0.3,
    });
    entries.push({
      url: `${siteUrl}/${locale}/cookies`,
      changeFrequency: "yearly",
      priority: 0.3,
    });
    entries.push({
      url: `${siteUrl}/${locale}/cars-for-sale`,
      changeFrequency: "weekly",
      priority: 0.9,
    });
    for (const slug of serviceSlugs) {
      entries.push({
        url: `${siteUrl}/${locale}/services/${slug}`,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  }

  return entries;
}
