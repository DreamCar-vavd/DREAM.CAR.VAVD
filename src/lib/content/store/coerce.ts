import type { CmsCar } from "../carsGate";
import type { Snapshot } from "./adapter";

function coerceLang(v: unknown) {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    title: String(o.title ?? ""),
    specLine: String(o.specLine ?? ""),
    description: String(o.description ?? ""),
    viewGalleryLabel: String(o.viewGalleryLabel ?? ""),
  };
}

const SALE_STATUSES = ["preparing", "for-sale", "reserved", "sold"];

export function coerceCar(id: string, raw: Record<string, unknown>): CmsCar {
  const v = (raw.video ?? {}) as Record<string, unknown>;
  return {
    id,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 100,
    saleStatus: (SALE_STATUSES.includes(String(raw.saleStatus))
      ? raw.saleStatus
      : "for-sale") as CmsCar["saleStatus"],
    year: String(raw.year ?? ""),
    price: String(raw.price ?? ""),
    mileageValue: Number(raw.mileageValue ?? 0),
    photos: Array.isArray(raw.photos)
      ? (raw.photos as Record<string, unknown>[]).map((p) => ({
          image: String(p?.image ?? ""),
          caption: String(p?.caption ?? ""),
        }))
      : [],
    video: {
      mode: String(v.mode ?? "none"),
      src: String(v.src ?? ""),
      posterSrc: String(v.posterSrc ?? ""),
    },
    uk: coerceLang(raw.uk),
    en: coerceLang(raw.en),
    ru: coerceLang(raw.ru),
  };
}

export function coerceSnapshot(raw: unknown): Snapshot {
  const o = (raw ?? {}) as { publishedAt?: unknown; cars?: unknown };
  const cars = Array.isArray(o.cars) ? (o.cars as Record<string, unknown>[]) : [];
  return {
    publishedAt: String(o.publishedAt ?? ""),
    cars: cars.map((c) => coerceCar(String(c.id ?? ""), c)),
  };
}
