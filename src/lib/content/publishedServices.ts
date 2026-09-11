import "server-only";
import type { ContentLocale } from "./carsGate";
import type { ServiceCopy } from "@/content/types";
import type { ServiceStatus } from "./serviceGate";
import { readSiteContent } from "./siteContent";
import { readPublishedSnapshot } from "./snapshot";
import { servicePriceForLocale } from "./serviceGate";
import { imageSize } from "./imageSize";

export interface ServiceMetaEntry {
  slug: string;
  order: number;
  status: ServiceStatus;
  iconSrc: string;
  price: string;
  photos: { src: string; width: number; height: number; caption: string }[];
  /** SEO title/description for the current locale. */
  seoTitle: string;
  seoDescription: string;
}

/** dict.services[slug] for one locale — drop-in for the static service copy. */
export async function getServiceCopyForDict(
  locale: ContentLocale,
): Promise<Record<string, ServiceCopy>> {
  const { services } = await readSiteContent();
  const out: Record<string, ServiceCopy> = {};
  for (const s of services) {
    const l = s[locale];
    out[s.id] = {
      title: l.title,
      shortDescription: l.shortDescription,
      longDescription: l.longDescription,
      bullets: l.bullets,
      ...(l.cardDescription ? { cardDescription: l.cardDescription } : {}),
      ...(l.modalLead ? { modalLead: l.modalLead } : {}),
      ...(l.modalDescription ? { modalDescription: l.modalDescription } : {}),
      ...(l.modalSections.length ? { modalSections: l.modalSections } : {}),
    };
  }
  return out;
}

/** Icon / status / price / photos per published service, in display order. */
export async function getServicesMeta(locale: ContentLocale): Promise<ServiceMetaEntry[]> {
  const { services } = await readSiteContent();
  const out: ServiceMetaEntry[] = [];
  for (const s of services) {
    const photos: ServiceMetaEntry["photos"] = [];
    for (const p of s.photos.filter((x) => x.image)) {
      const dim = (await imageSize(p.image)) ?? { width: 4, height: 3 };
      photos.push({ src: p.image, width: dim.width, height: dim.height, caption: p.caption });
    }
    out.push({
      slug: s.id,
      order: s.order,
      status: s.status,
      iconSrc: s.iconSrc,
      price: servicePriceForLocale(s, locale),
      photos,
      seoTitle: s[locale].seoTitle,
      seoDescription: s[locale].seoDescription,
    });
  }
  return out;
}

/**
 * Published service slugs, read straight from the snapshot — NOT via
 * readSiteContent(), because this runs inside `generateStaticParams` and the
 * sitemap, where `draftMode()` must not be called. A draft that adds a brand
 * new service slug therefore has no static route until it is published (same
 * limitation as a brand-new car); its copy still previews on existing routes.
 */
export async function getPublishedServiceSlugs(): Promise<string[]> {
  const { services } = await readPublishedSnapshot();
  return services.map((s) => s.id);
}
