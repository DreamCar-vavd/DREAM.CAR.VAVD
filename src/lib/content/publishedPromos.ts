import "server-only";
import type { ContentLocale } from "./carsGate";
import { isPromoRenderable, type PromoType } from "./promoGate";
import { readSiteContent } from "./siteContent";
import { imageSize } from "./imageSize";

export interface PromoView {
  id: string;
  type: PromoType;
  order: number;
  image: { src: string; width: number; height: number } | null;
  linkUrl: string;
  date: string;
  title: string;
  summary: string;
  linkLabel: string;
  body: string;
}

/** Visible published promos for one locale, in display order. */
export async function getPromos(locale: ContentLocale): Promise<PromoView[]> {
  const { promos } = await readSiteContent();
  const out: PromoView[] = [];
  for (const p of promos.filter(isPromoRenderable)) {
    let image: PromoView["image"] = null;
    if (p.image) {
      const dim = (await imageSize(p.image)) ?? { width: 3, height: 2 };
      image = { src: p.image, width: dim.width, height: dim.height };
    }
    const l = p[locale];
    out.push({
      id: p.id,
      type: p.type,
      order: p.order,
      image,
      linkUrl: p.linkUrl,
      date: p.date,
      title: l.title,
      summary: l.summary,
      linkLabel: l.linkLabel,
      body: l.body,
    });
  }
  return out;
}

/** Split for the two render slots (thin banners vs the cards section). */
export async function getPromoSlots(locale: ContentLocale): Promise<{
  banners: PromoView[];
  cards: PromoView[];
}> {
  const all = await getPromos(locale);
  return {
    banners: all.filter((p) => p.type === "banner"),
    cards: all.filter((p) => p.type === "promo" || p.type === "news"),
  };
}
