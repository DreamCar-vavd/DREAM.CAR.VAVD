import type { CmsCar } from "./carsGate";
import type { CmsGalleryProject, CmsGalleryLanguage } from "./galleryGate";
import type { CmsService, CmsServiceLanguage } from "./serviceGate";
import type { CmsContact, CmsContactLanguage } from "./contactGate";

const str = (v: unknown) => String(v ?? "");
const strArr = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => String(x ?? "")).filter(Boolean) : [];

const SALE_STATUSES = ["preparing", "for-sale", "reserved", "sold"];

export function coerceCar(id: string, raw: Record<string, unknown>): CmsCar {
  const v = (raw.video ?? {}) as Record<string, unknown>;
  const lang = (x: unknown) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return {
      title: str(o.title),
      specLine: str(o.specLine),
      description: str(o.description),
      viewGalleryLabel: str(o.viewGalleryLabel),
    };
  };
  return {
    id,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 100,
    saleStatus: (SALE_STATUSES.includes(str(raw.saleStatus))
      ? raw.saleStatus
      : "for-sale") as CmsCar["saleStatus"],
    year: str(raw.year),
    price: str(raw.price),
    mileageValue: Number(raw.mileageValue ?? 0),
    photos: Array.isArray(raw.photos)
      ? (raw.photos as Record<string, unknown>[]).map((p) => ({
          image: str(p?.image),
          caption: str(p?.caption),
        }))
      : [],
    video: { mode: str(v.mode) || "none", src: str(v.src), posterSrc: str(v.posterSrc) },
    uk: lang(raw.uk),
    en: lang(raw.en),
    ru: lang(raw.ru),
  };
}

function galleryLang(x: unknown): CmsGalleryLanguage {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    title: str(o.title),
    shortDescription: str(o.shortDescription),
    longDescription: str(o.longDescription),
    service: str(o.service),
    clientRequest: str(o.clientRequest),
    completedItems: strArr(o.completedItems),
    result: str(o.result),
  };
}

export function coerceGalleryProject(
  id: string,
  raw: Record<string, unknown>,
): CmsGalleryProject {
  return {
    id,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 100,
    kind: raw.kind === "showcase" ? "showcase" : "album",
    year: str(raw.year),
    photos: Array.isArray(raw.photos)
      ? (raw.photos as Record<string, unknown>[]).map((p) => ({
          image: str(p?.image),
          caption: str(p?.caption),
        }))
      : [],
    videoUrl: str(raw.videoUrl),
    showContactCta: raw.showContactCta !== false,
    uk: galleryLang(raw.uk),
    en: galleryLang(raw.en),
    ru: galleryLang(raw.ru),
  };
}

function serviceLang(x: unknown): CmsServiceLanguage {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    title: str(o.title),
    shortDescription: str(o.shortDescription),
    longDescription: str(o.longDescription),
    cardDescription: str(o.cardDescription),
    bullets: strArr(o.bullets),
    modalLead: str(o.modalLead),
    modalDescription: str(o.modalDescription),
    modalSections: Array.isArray(o.modalSections)
      ? (o.modalSections as Record<string, unknown>[]).map((s) => ({
          heading: str(s?.heading),
          items: strArr(s?.items),
        }))
      : [],
    priceNote: str(o.priceNote),
    seoTitle: str(o.seoTitle),
    seoDescription: str(o.seoDescription),
  };
}

export function coerceService(id: string, raw: Record<string, unknown>): CmsService {
  return {
    id,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 100,
    status: raw.status === "coming-soon" ? "coming-soon" : "available",
    iconSrc: str(raw.iconSrc),
    priceAmount: str(raw.priceAmount),
    priceCurrency: raw.priceCurrency == null ? "£" : str(raw.priceCurrency),
    photos: Array.isArray(raw.photos)
      ? (raw.photos as Record<string, unknown>[]).map((p) => ({
          image: str(p?.image),
          caption: str(p?.caption),
        }))
      : [],
    uk: serviceLang(raw.uk),
    en: serviceLang(raw.en),
    ru: serviceLang(raw.ru),
  };
}

function contactLang(x: unknown): CmsContactLanguage {
  const o = (x ?? {}) as Record<string, unknown>;
  return {
    heading: str(o.heading),
    subheading: str(o.subheading),
    hoursLabel: str(o.hoursLabel),
    addressLabel: str(o.addressLabel),
  };
}

export function coerceContact(id: string, raw: Record<string, unknown>): CmsContact {
  return {
    id: id || "site",
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 1,
    phoneDisplay: str(raw.phoneDisplay),
    phoneE164: str(raw.phoneE164),
    email: str(raw.email),
    whatsappNumber: str(raw.whatsappNumber),
    telegramUrl: str(raw.telegramUrl),
    instagramUrl: str(raw.instagramUrl),
    facebookUrl: str(raw.facebookUrl),
    youtubeUrl: str(raw.youtubeUrl),
    addressText: str(raw.addressText),
    mapsUrl: str(raw.mapsUrl),
    hours: str(raw.hours),
    uk: contactLang(raw.uk),
    en: contactLang(raw.en),
    ru: contactLang(raw.ru),
  };
}
