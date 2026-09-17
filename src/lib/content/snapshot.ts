import "server-only";
import { cache } from "react";
import { promises as fs } from "node:fs";
import { LOCALES, type CmsCar } from "./carsGate";
import type { CmsGalleryProject } from "./galleryGate";
import type { CmsService } from "./serviceGate";
import type { CmsContact } from "./contactGate";
import type { CmsPromo } from "./promoGate";
import { coerceCar, coerceContact, coerceGalleryProject, coercePromo, coerceService } from "./coerce";
import { PUBLISHED_FILE } from "./paths";

/**
 * The published snapshot is the ONLY content the public site reads.
 *
 * Build-time sanity assertions (report/34 §4): the panel only writes
 * publishable items, so these should never fire — but a hand-edited or
 * corrupted published.json FAILS `next build`, and Vercel keeps the previous
 * good deployment.
 */

function assertCarSane(car: CmsCar): void {
  const w = `published.json → car "${car?.id ?? "?"}"`;
  if (!car?.id) throw new Error(`${w}: missing id`);
  if (!car.photos?.filter((p) => p?.image?.trim()).length) throw new Error(`${w}: no photos`);
  if (car.video?.mode === "uploaded-file") throw new Error(`${w}: video "uploaded-file" not connected`);
  if (car.video?.mode === "hosted-file" && !String(car.video.src ?? "").trim()) {
    throw new Error(`${w}: video "hosted-file" has no src`);
  }
  for (const l of LOCALES) {
    if (!String(car[l]?.title ?? "").trim() || !String(car[l]?.specLine ?? "").trim()) {
      throw new Error(`${w}: ${l.toUpperCase()} title/specLine empty`);
    }
  }
}
function assertGallerySane(p: CmsGalleryProject): void {
  const w = `published.json → gallery "${p?.id ?? "?"}"`;
  if (!p?.id) throw new Error(`${w}: missing id`);
  if (!p.photos?.filter((x) => x?.image?.trim()).length) throw new Error(`${w}: no photos`);
  for (const l of LOCALES) {
    if (!String(p[l]?.title ?? "").trim()) throw new Error(`${w}: ${l.toUpperCase()} title empty`);
  }
}
function assertServiceSane(s: CmsService): void {
  const w = `published.json → service "${s?.id ?? "?"}"`;
  if (!s?.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id)) throw new Error(`${w}: bad slug`);
  for (const l of LOCALES) {
    const lang = s[l];
    if (
      !String(lang?.title ?? "").trim() ||
      !String(lang?.shortDescription ?? "").trim() ||
      !String(lang?.longDescription ?? "").trim()
    ) {
      throw new Error(`${w}: ${l.toUpperCase()} required text empty`);
    }
  }
}
function assertContactSane(c: CmsContact): void {
  const w = `published.json → contact "${c?.id ?? "?"}"`;
  if (c?.id !== "site") throw new Error(`${w}: contact id must be "site"`);
  for (const l of LOCALES) {
    if (!String(c[l]?.heading ?? "").trim() || !String(c[l]?.subheading ?? "").trim()) {
      throw new Error(`${w}: ${l.toUpperCase()} heading/subheading empty`);
    }
  }
}
function assertPromoSane(p: CmsPromo): void {
  const w = `published.json → promo "${p?.id ?? "?"}"`;
  if (!p?.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)) throw new Error(`${w}: bad slug`);
  if (!["banner", "promo", "news"].includes(p.type)) throw new Error(`${w}: bad type`);
  const needsBody = p.type === "news";
  for (const l of LOCALES) {
    if (!String(p[l]?.title ?? "").trim()) throw new Error(`${w}: ${l.toUpperCase()} title empty`);
    if (needsBody && !String(p[l]?.body ?? "").trim()) {
      throw new Error(`${w}: ${l.toUpperCase()} news body empty`);
    }
  }
}

export interface PublishedSnapshot {
  publishedAt: string;
  cars: CmsCar[];
  gallery: CmsGalleryProject[];
  services: CmsService[];
  /** 0 or 1 entry. */
  contact: CmsContact[];
  promos: CmsPromo[];
}

export const readPublishedSnapshot = cache(async (): Promise<PublishedSnapshot> => {
  let raw: string;
  try {
    raw = await fs.readFile(PUBLISHED_FILE, "utf8");
  } catch {
    return { publishedAt: "", cars: [], gallery: [], services: [], contact: [], promos: [] };
  }
  const p = JSON.parse(raw) as Record<string, Record<string, unknown>[] | string>;
  const list = (k: string) => (Array.isArray(p[k]) ? (p[k] as Record<string, unknown>[]) : []);
  const cars = list("cars")
    .map((c) => coerceCar(String(c.id ?? ""), c))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const gallery = list("gallery")
    .map((g) => coerceGalleryProject(String(g.id ?? ""), g))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const services = list("services")
    .map((s) => coerceService(String(s.id ?? ""), s))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const contactRaw = list("contact").map((c) => coerceContact(String(c.id ?? "site"), c));
  if (contactRaw.length > 1) {
    throw new Error(`published.json → contact: expected 0 or 1 record, got ${contactRaw.length}`);
  }
  const contact = contactRaw;
  const promos = list("promos")
    .map((x) => coercePromo(String(x.id ?? ""), x))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  cars.forEach(assertCarSane);
  gallery.forEach(assertGallerySane);
  services.forEach(assertServiceSane);
  contact.forEach(assertContactSane);
  promos.forEach(assertPromoSane);
  return { publishedAt: String(p.publishedAt ?? ""), cars, gallery, services, contact, promos };
});
