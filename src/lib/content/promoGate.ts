/**
 * Publish gate for Banners / Promos / News — one kind, three shapes.
 *
 * Same pipeline as everything else (storage, versioning, review hashes,
 * snapshot). No scheduled publishing: `date` is an editorial field shown on
 * a news item; it never triggers anything. `visible` hides an item from the
 * public site while keeping it in the panel — a published-but-hidden state,
 * the promo equivalent of a "sold" car.
 */
import {
  LOCALES,
  reviewInstanceMatches,
  reviewRowFor,
  type ContentLocale,
  type GateContext,
  type GateFailure,
  type LangReviewStatus,
} from "./carsGate";

export type PromoType = "banner" | "promo" | "news";

export interface CmsPromoLanguage {
  title: string;
  summary: string;
  /** button / link caption; only meaningful when `linkUrl` is set */
  linkLabel: string;
  /** full article text — required for `news`, optional otherwise */
  body: string;
}

export interface CmsPromo {
  id: string; // == slug
  order: number;
  type: PromoType;
  visible: boolean;
  image: string;
  /** internal ("/uk/..." / "#services") or an https link; empty = no link */
  linkUrl: string;
  /** editorial date for a news item (YYYY-MM-DD). Display only. */
  date: string;
  uk: CmsPromoLanguage;
  en: CmsPromoLanguage;
  ru: CmsPromoLanguage;
}

/** `news` also needs a body; the others just a title. */
function requiredFields(type: PromoType): readonly (keyof CmsPromoLanguage)[] {
  return type === "news" ? (["title", "body"] as const) : (["title"] as const);
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** internal path or an https URL (no javascript:/data:/http:) */
export function isSafePromoLink(v: string): boolean {
  const t = (v ?? "").trim();
  if (!t) return true;
  if (t.startsWith("/") && !t.startsWith("//")) return true;
  if (t.startsWith("#")) return true;
  try {
    return new URL(t).protocol === "https:";
  } catch {
    return false;
  }
}

export function promoConfirmedText(l: CmsPromoLanguage): string {
  return JSON.stringify({
    title: (l?.title ?? "").trim(),
    summary: (l?.summary ?? "").trim(),
    linkLabel: (l?.linkLabel ?? "").trim(),
    body: (l?.body ?? "").trim(),
  });
}

export function getPromoLangStatus(
  p: CmsPromo,
  locale: ContentLocale,
  ctx: GateContext = {},
): LangReviewStatus {
  const l = p[locale];
  if (!requiredFields(p.type).every((f) => String(l?.[f] ?? "").trim())) return "empty";
  const confirmedHash = reviewRowFor(ctx, p.id)?.[locale]?.hash;
  if (confirmedHash === undefined) return "needs-review";
  if (!reviewInstanceMatches(ctx, p.id)) return "needs-review";
  if (ctx.sha256 && confirmedHash !== ctx.sha256(promoConfirmedText(l))) return "needs-review";
  return "reviewed";
}

export function getPromoPublishBlockers(p: CmsPromo, ctx: GateContext = {}): GateFailure[] {
  const failures: GateFailure[] = [];
  if (!SLUG_RE.test(p.id)) failures.push({ kind: "missing-field", locale: "uk", field: "slug" });
  if (!(["banner", "promo", "news"] as const).includes(p.type)) {
    failures.push({ kind: "missing-field", locale: "uk", field: "promoType" });
  }
  if (!isSafePromoLink(p.linkUrl)) {
    failures.push({ kind: "missing-field", locale: "uk", field: "linkUrl" });
  }
  if (p.date && !DATE_RE.test(p.date)) {
    failures.push({ kind: "missing-field", locale: "uk", field: "promoDate" });
  }
  const req = requiredFields(p.type);
  for (const locale of LOCALES) {
    const l = p[locale];
    for (const field of req) {
      if (!String(l?.[field] ?? "").trim()) {
        failures.push({ kind: "missing-field", locale, field });
      }
    }
    const filled = req.every((f) => String(l?.[f] ?? "").trim());
    if (filled && getPromoLangStatus(p, locale, ctx) !== "reviewed") {
      failures.push({ kind: "needs-review", locale });
    }
  }
  return failures;
}

/** Published but `visible:false` stays in the panel, off the public site. */
export function isPromoRenderable(p: CmsPromo): boolean {
  return p.visible !== false;
}
