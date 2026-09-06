/**
 * The publish gate for cars. This is the *trusted boundary*: the static site
 * build calls `isCarPubliclyVisible` for every car and simply does not emit
 * anything it rejects — no page, no sitemap entry, no listing. There is no
 * runtime endpoint that can be tricked into publishing a car; "publishing" is
 * a git merge followed by a rebuild, and the rebuild re-runs this gate.
 *
 * `npm run content:check` (and CI) run the same checks earlier so a mistake is
 * visible on the PR instead of silently dropping a car.
 *
 * Pure, dependency-free, and covered by src/lib/content/carsGate.test.ts.
 */

export type SaleStatus = "preparing" | "for-sale" | "reserved" | "sold";
export type PublishState = "draft" | "published";
export type ReviewState = "draft" | "confirmed";
export const LOCALES = ["uk", "en", "ru"] as const;
export type ContentLocale = (typeof LOCALES)[number];

export interface CmsCarLanguage {
  title: string;
  specLine: string;
  description: string;
  viewGalleryLabel: string;
  reviewState: ReviewState;
}

export interface CmsCar {
  id: string;
  order: number;
  publishState: PublishState;
  saleStatus: SaleStatus;
  year: string;
  price: string;
  mileageValue: number;
  photos: { image: string; caption: string }[];
  video: { mode: string; src: string; posterSrc: string };
  uk: CmsCarLanguage;
  en: CmsCarLanguage;
  ru: CmsCarLanguage;
}

/** Sale statuses that keep the car OFF the public site (kept in the panel). */
const HIDDEN_SALE_STATUSES: ReadonlySet<SaleStatus> = new Set(["preparing", "sold"]);

/** Required per-language fields that must be non-empty (after trim). */
const REQUIRED_LANG_FIELDS = ["title", "specLine"] as const;

/**
 * Canonical serialisation of the language fields whose change should
 * invalidate a prior "confirmed". MUST stay in sync with
 * scripts/migrate-cars.mjs and scripts/content-check.mjs `confirmedText`.
 */
export function confirmedText(lang: Pick<CmsCarLanguage, "title" | "specLine" | "description" | "viewGalleryLabel">): string {
  return JSON.stringify({
    title: (lang.title ?? "").trim(),
    specLine: (lang.specLine ?? "").trim(),
    description: (lang.description ?? "").trim(),
    viewGalleryLabel: (lang.viewGalleryLabel ?? "").trim(),
  });
}

export type TranslationLocks = Record<string, Partial<Record<ContentLocale, string>>>;

export interface GateContext {
  /** sha256(confirmedText) captured when each locale was last confirmed. */
  locks?: TranslationLocks;
  /**
   * Hash function used for the "text changed after confirmation" check.
   * Supplied by the caller (Node `crypto` in the reader/CI) so this module
   * stays pure and dependency-free. Without it the stale-confirmation check
   * is skipped.
   */
  sha256?: (input: string) => string;
}

export type GateFailure =
  | { kind: "draft" }
  | { kind: "sale-status-hidden"; saleStatus: SaleStatus }
  | { kind: "missing-field"; locale: ContentLocale; field: string }
  | { kind: "not-confirmed"; locale: ContentLocale }
  | { kind: "confirmation-stale"; locale: ContentLocale }
  | { kind: "no-photos" };

/**
 * Every reason this car must NOT appear publicly. Empty array = safe to show.
 * `draft` / `sale-status-hidden` are normal states, not errors; the other
 * kinds are content mistakes worth surfacing on the PR.
 */
export function getCarGateFailures(car: CmsCar, ctx: GateContext = {}): GateFailure[] {
  const failures: GateFailure[] = [];

  if (car.publishState !== "published") failures.push({ kind: "draft" });
  if (HIDDEN_SALE_STATUSES.has(car.saleStatus)) {
    failures.push({ kind: "sale-status-hidden", saleStatus: car.saleStatus });
  }
  if (!Array.isArray(car.photos) || car.photos.filter((p) => p?.image?.trim()).length === 0) {
    failures.push({ kind: "no-photos" });
  }

  for (const locale of LOCALES) {
    const lang = car[locale];
    if (!lang) {
      failures.push({ kind: "not-confirmed", locale });
      REQUIRED_LANG_FIELDS.forEach((field) => failures.push({ kind: "missing-field", locale, field }));
      continue;
    }
    for (const field of REQUIRED_LANG_FIELDS) {
      if (!String(lang[field] ?? "").trim()) failures.push({ kind: "missing-field", locale, field });
    }
    if (lang.reviewState !== "confirmed") {
      failures.push({ kind: "not-confirmed", locale });
      continue;
    }
    const lockedHash = ctx.locks?.[car.id]?.[locale];
    if (
      lockedHash !== undefined &&
      ctx.sha256 &&
      lockedHash !== ctx.sha256(confirmedText(lang))
    ) {
      failures.push({ kind: "confirmation-stale", locale });
    }
  }

  return failures;
}

/** True only when the car passes every check — safe for the public build. */
export function isCarPubliclyVisible(car: CmsCar, ctx: GateContext = {}): boolean {
  return getCarGateFailures(car, ctx).length === 0;
}

/**
 * Failures that indicate a *content mistake* (as opposed to the deliberate
 * `draft` / `sold` states). `content:check` fails the build on these when the
 * car is marked `published`.
 */
export function getPublishBlockers(car: CmsCar, ctx: GateContext = {}): GateFailure[] {
  return getCarGateFailures(car, ctx).filter(
    (f) => f.kind !== "draft" && f.kind !== "sale-status-hidden",
  );
}

export function describeFailure(f: GateFailure): string {
  switch (f.kind) {
    case "draft":
      return "стан публікації = чернетка";
    case "sale-status-hidden":
      return `статус продажу «${f.saleStatus}» ховає авто публічно`;
    case "missing-field":
      return `${f.locale.toUpperCase()}: не заповнено поле «${f.field}»`;
    case "not-confirmed":
      return `${f.locale.toUpperCase()}: мову не позначено як перевірену`;
    case "confirmation-stale":
      return `${f.locale.toUpperCase()}: текст змінено після перевірки — потрібно перевірити знову`;
    case "no-photos":
      return "немає жодного фото";
  }
}
