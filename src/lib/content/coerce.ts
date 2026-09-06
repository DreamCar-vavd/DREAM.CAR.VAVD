import type { CmsCar } from "./carsGate";
import type { CmsGalleryProject, CmsGalleryLanguage } from "./galleryGate";

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
    videoUrl: str(raw.videoUrl),
    showContactCta: raw.showContactCta !== false,
    uk: galleryLang(raw.uk),
    en: galleryLang(raw.en),
    ru: galleryLang(raw.ru),
  };
}
