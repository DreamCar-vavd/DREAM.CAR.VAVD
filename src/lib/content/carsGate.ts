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
 * Pure, dependency-free (aside from the equally pure ../media/youtube),
 * covered by carsGate.test.ts.
 */

import { looksLikeYoutubeUrl, parseYoutubeUrl } from "../media/youtube";

export type SaleStatus = "preparing" | "for-sale" | "reserved" | "sold";
export type VideoMode =
  | "none"
  | "legacy-file"
  | "external-link"
  | "hosted-file" // uploaded via /panel/video to external storage; src is its URL
  | "uploaded-file"; // legacy placeholder for the not-yet-connected mode — a blocker

/**
 * Why a hosted-file / external-link src is not currently playable, or `null`
 * if it's fine. A src that LOOKS like an attempted YouTube link (see
 * `looksLikeYoutubeUrl`) must pass strict YouTube validation — this is what
 * catches a spoofed domain like `youtube.com.evil.example` that would
 * otherwise sail through as "any https URL is fine". A src that is NOT
 * YouTube-shaped at all keeps the original, unrelated behaviour: any https
 * URL (a direct MP4/WebM link, a Blob URL) or a local `/uploads/videos/`
 * path.
 */
export function videoSrcProblem(src: string): string | null {
  const s = (src ?? "").trim();
  if (!s) return "порожнє посилання";
  if (s.startsWith("/uploads/videos/")) {
    return s.includes("..") ? "недопустимий шлях" : null;
  }
  if (looksLikeYoutubeUrl(s)) {
    const parsed = parseYoutubeUrl(s);
    return parsed.ok ? null : `некоректне посилання YouTube — ${parsed.reason}`;
  }
  try {
    return new URL(s).protocol === "https:" ? null : "лише https-посилання";
  } catch {
    return "некоректний URL";
  }
}

/** A hosted-file / external-link src must be https, or (dev) a /uploads/ path. */
export function isPlayableVideoSrc(src: string): boolean {
  return videoSrcProblem(src) === null;
}

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

/**
 * One review-state.json row: the per-locale confirmed-text hashes, plus the
 * card-INSTANCE token (`bornAt`) the row was last confirmed against.
 *
 * `instance` binds the confirmation to the physical card that was reviewed, not
 * just to its slug + text. Keystatic's "Delete entry" leaves the row behind; if
 * the same slug is then re-created (Keystatic mints a fresh `bornAt`), the
 * leftover row's `instance` no longer matches and every locale falls back to
 * "needs-review" — even when the new card's text is byte-identical.
 *
 * Absent `instance` (rows written before this binding, or a card with no
 * `bornAt` yet) is treated as "" and only matches a card that likewise has no
 * token — so pre-existing confirmations are never invalidated wholesale.
 */
export type ReviewRow = Partial<Record<ContentLocale, { hash: string; at: string }>> & {
  instance?: string;
};
/** review-state.json shape: which text was confirmed reviewed, per card/locale. */
export type ReviewState = Record<string, ReviewRow>;

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
  /**
   * The working card's current `bornAt` token, threaded per item by panelStore.
   * "" / undefined when the card has no token (legacy). A review row only counts
   * as "reviewed" when its recorded `instance` equals this.
   */
  instance?: string;
  /**
   * The `kind:slug` review-state key for this card. When set, that row is used
   * (falling back to a legacy bare `slug` row); when unset, the bare `slug`.
   * The panel and the `main` content-guard set it so `cars/foo` and
   * `services/foo` never share a confirmation.
   */
  reviewKey?: string;
}

/** The review row for this card: namespaced `kind:slug` first, then legacy bare. */
export function reviewRowFor(ctx: GateContext, id: string): ReviewRow | undefined {
  return (ctx.reviewKey ? ctx.review?.[ctx.reviewKey] : undefined) ?? ctx.review?.[id];
}

/**
 * Does the stored review row belong to the SAME card instance we are gating?
 *
 * Only enforced when the caller actually tracks instances (`ctx.instance` is a
 * string — the panel threads the working card's `bornAt`, `""` when it has
 * none). Callers that do not — the `main` content-guard and build-time
 * assertions, which see only the published snapshot — leave it `undefined` and
 * fall back to the hash check alone.
 *
 * With a token present: `"" === ""` (legacy row + legacy card) passes; every
 * other mismatch — including a tokened card against a token-less row — fails,
 * so deleting a card and re-creating it under the same slug re-opens review.
 */
export function reviewInstanceMatches(ctx: GateContext, id: string): boolean {
  if (ctx.instance === undefined) return true;
  return (reviewRowFor(ctx, id)?.instance ?? "") === ctx.instance;
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
  const confirmedHash = reviewRowFor(ctx, car.id)?.[locale]?.hash;
  if (confirmedHash === undefined) return "needs-review";
  if (!reviewInstanceMatches(ctx, car.id)) return "needs-review";
  if (ctx.sha256 && confirmedHash !== ctx.sha256(confirmedText(lang))) return "needs-review";
  return "reviewed";
}

export type GateFailure =
  | { kind: "missing-field"; locale: ContentLocale; field: string }
  | { kind: "needs-review"; locale: ContentLocale }
  | { kind: "no-photos" }
  | { kind: "video-not-connected" }
  | { kind: "video-link-invalid"; reason: string };

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
  // A "hosted-file" whose upload never finished (no usable src) must not
  // publish as if it were ready. Its src is machine-generated (the Blob
  // upload response), so a bad one means the connection itself is broken —
  // "video-not-connected" is the right message, not a link-typo message.
  if (car.video?.mode === "hosted-file" && car.video.src?.trim() && !isPlayableVideoSrc(car.video.src)) {
    failures.push({ kind: "video-not-connected" });
  }
  if (car.video?.mode === "hosted-file" && !car.video.src?.trim()) {
    failures.push({ kind: "video-not-connected" });
  }
  // "external-link" (YouTube or a direct https link) is hand-typed by the
  // owner, so a bad one gets a specific reason instead of the generic
  // "not connected" message — e.g. a malformed or spoofed YouTube URL. An
  // EMPTY src is also a blocker here, unlike "hosted-file": choosing
  // "external-link" is an explicit statement of intent to use a link, so a
  // blank field means the step was left unfinished, not "mode unused" —
  // the owner must either paste a link or switch back to "Немає".
  if (car.video?.mode === "external-link") {
    const src = car.video.src?.trim() ?? "";
    const problem = src
      ? videoSrcProblem(src)
      : "порожнє посилання — вставте YouTube-посилання або виберіть режим «Немає»";
    if (problem) failures.push({ kind: "video-link-invalid", reason: problem });
  }

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

const FIELD_LABELS: Record<string, string> = {
  title: "назва",
  specLine: "характеристики",
  shortDescription: "короткий опис",
  longDescription: "повний опис",
  heading: "заголовок",
  subheading: "підзаголовок",
  slug: "ID / slug (лише малі літери, цифри, дефіс)",
  priceAmount: "ціна — сума (лише число, напр. 60 або 60.00)",
  body: "повний текст",
  summary: "короткий текст",
  linkLabel: "підпис кнопки",
  linkUrl: "посилання (внутрішнє «/…» або https)",
  promoType: "тип матеріалу (банер / акція / новина)",
  promoDate: "дата (у форматі РРРР-ММ-ДД)",
  contactId: "ID запису контактів — має бути «site» (єдиний запис)",
  phoneDisplay: "телефон (показ)",
  phoneE164: "телефон (для tel:)",
  email: "email",
  telegramUrl: "посилання Telegram (недопустимий URL)",
  instagramUrl: "посилання Instagram (недопустимий URL)",
  facebookUrl: "посилання Facebook (недопустимий URL)",
  youtubeUrl: "посилання YouTube (недопустимий URL)",
  mapsUrl: "посилання на карту (недопустимий URL)",
};

export function describeFailure(f: GateFailure): string {
  switch (f.kind) {
    case "missing-field":
      return `${f.locale.toUpperCase()}: не заповнено / некоректне поле «${FIELD_LABELS[f.field] ?? f.field}»`;
    case "needs-review":
      return `${f.locale.toUpperCase()}: текст не позначено перевіреним (або змінено після перевірки)`;
    case "no-photos":
      return "немає жодного фото";
    case "video-not-connected":
      return "обрано «Завантажений файл» для відео — ця функція ще не підключена; приберіть або замініть посиланням";
    case "video-link-invalid":
      return `посилання на відео некоректне — ${f.reason}`;
  }
}
