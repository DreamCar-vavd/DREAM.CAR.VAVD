/**
 * The publish gate for cars — the single place that decides whether a car may
 * go public, shared by the panel, the publish API and the site build.
 *
 * Model (see report/34):
 *  - Keystatic edits the WORKING copy (src/content/cms/cars/*.json) — content
 *    only. Editing it never touches the live site.
 *  - The PUBLISHED SNAPSHOT (src/content/cms/published.json) is the only thing
 *    the public site reads. A car reaches it exclusively through the panel's
 *    "Опублікувати зміни" action, which runs `getPublishBlockers` first.
 *  - Per-language review is tracked in src/content/cms/review-state.json,
 *    written only by the panel's "Позначити перевіреним" action; any later
 *    edit to that language's text invalidates it (hash mismatch).
 *
 * Pure, dependency-free, covered by carsGate.test.ts.
 */

export type SaleStatus = "preparing" | "for-sale" | "reserved" | "sold";
export type VideoMode = "none" | "legacy-file" | "external-link" | "uploaded-file";
export const LOCALES = ["uk", "en", "ru"] as const;
export type ContentLocale = (typeof LOCALES)[number];

export interface CmsCarLanguage {
  title: string;
  specLine: string;
  description: string;
  viewGalleryLabel: string;
}

export interface CmsCar {
  id: string;
  order: number;
  saleStatus: SaleStatus;
  year: string;
  price: string;
  mileageValue: number;
  photos: { image: string; caption: string }[];
  video: { mode: VideoMode | string; src: string; posterSrc: string };
  uk: CmsCarLanguage;
  en: CmsCarLanguage;
  ru: CmsCarLanguage;
}

/** review-state.json shape: which text was confirmed reviewed, per car/locale. */
export type ReviewState = Record<
  string,
  Partial<Record<ContentLocale, { hash: string; at: string }>>
>;

/** Sale statuses that keep a *published* car OFF the public site. */
const HIDDEN_SALE_STATUSES: ReadonlySet<SaleStatus> = new Set(["preparing", "sold"]);

/** Per-language fields that must be non-empty (after trim) to publish. */
const REQUIRED_LANG_FIELDS = ["title", "specLine"] as const;

/**
 * Canonical serialisation of the language fields whose change invalidates a
 * prior review. MUST match scripts/*.mjs `confirmedText`.
 */
export function confirmedText(
  lang: Pick<CmsCarLanguage, "title" | "specLine" | "description" | "viewGalleryLabel">,
): string {
  return JSON.stringify({
    title: (lang?.title ?? "").trim(),
    specLine: (lang?.specLine ?? "").trim(),
    description: (lang?.description ?? "").trim(),
    viewGalleryLabel: (lang?.viewGalleryLabel ?? "").trim(),
  });
}

export type LangReviewStatus = "empty" | "needs-review" | "reviewed";

export interface GateContext {
  review?: ReviewState;
  /** Node crypto in callers; without it the review check is skipped. */
  sha256?: (input: string) => string;
}

/** Per-language review status for the panel's badges. */
export function getLangStatus(
  car: CmsCar,
  locale: ContentLocale,
  ctx: GateContext = {},
): LangReviewStatus {
  const lang = car[locale];
  const filled = REQUIRED_LANG_FIELDS.every((f) => String(lang?.[f] ?? "").trim());
  if (!filled) return "empty";
  const confirmedHash = ctx.review?.[car.id]?.[locale]?.hash;
  if (confirmedHash === undefined) return "needs-review";
  if (ctx.sha256 && confirmedHash !== ctx.sha256(confirmedText(lang))) return "needs-review";
  return "reviewed";
}

export type GateFailure =
  | { kind: "missing-field"; locale: ContentLocale; field: string }
  | { kind: "needs-review"; locale: ContentLocale }
  | { kind: "no-photos" }
  | { kind: "video-not-connected" };

/**
 * Reasons this car may NOT be published right now. Empty array = publishable.
 * (`sold` / `preparing` are NOT blockers — a published card for a sold car is
 * fine, the site just doesn't render it.)
 */
export function getPublishBlockers(car: CmsCar, ctx: GateContext = {}): GateFailure[] {
  const failures: GateFailure[] = [];

  const realPhotos = Array.isArray(car.photos)
    ? car.photos.filter((p) => p?.image?.trim())
    : [];
  if (realPhotos.length === 0) failures.push({ kind: "no-photos" });

  if (car.video?.mode === "uploaded-file") failures.push({ kind: "video-not-connected" });

  for (const locale of LOCALES) {
    const lang = car[locale];
    for (const field of REQUIRED_LANG_FIELDS) {
      if (!String(lang?.[field] ?? "").trim()) {
        failures.push({ kind: "missing-field", locale, field });
      }
    }
    if (getLangStatus(car, locale, ctx) !== "reviewed") {
      // Only add needs-review if the fields are present (missing-field already covers empty).
      const filled = REQUIRED_LANG_FIELDS.every((f) => String(lang?.[f] ?? "").trim());
      if (filled) failures.push({ kind: "needs-review", locale });
    }
  }

  return failures;
}

export function isPublishable(car: CmsCar, ctx: GateContext = {}): boolean {
  return getPublishBlockers(car, ctx).length === 0;
}

/**
 * Whether a car that IS in the published snapshot should actually render on
 * the public site. Snapshot entries are already publishable; this only hides
 * sold / preparing cars.
 */
export function isRenderable(car: Pick<CmsCar, "saleStatus">): boolean {
  return !HIDDEN_SALE_STATUSES.has(car.saleStatus as SaleStatus);
}

export function describeFailure(f: GateFailure): string {
  switch (f.kind) {
    case "missing-field":
      return `${f.locale.toUpperCase()}: не заповнено поле «${f.field === "title" ? "назва" : "характеристики"}»`;
    case "needs-review":
      return `${f.locale.toUpperCase()}: текст не позначено перевіреним (або змінено після перевірки)`;
    case "no-photos":
      return "немає жодного фото";
    case "video-not-connected":
      return "обрано «Завантажений файл» для відео — ця функція ще не підключена; приберіть або замініть посиланням";
  }
}
