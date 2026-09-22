import path from "node:path";

/** All panel content lives under here. */
export const CMS_DIR = path.join(process.cwd(), "src/content/cms");

/** Working copy — Keystatic edits these. NOT read by the public site. */
export const CARS_WORKING_DIR = path.join(CMS_DIR, "cars");

/** The published snapshot — the ONLY car data the public site reads. */
export const PUBLISHED_FILE = path.join(CMS_DIR, "published.json");

/** Per-car / per-language review confirmations — written only by the panel. */
export const REVIEW_FILE = path.join(CMS_DIR, "review-state.json");

/** Public URL prefix Keystatic's image field writes for car photos. */
export const CAR_IMAGE_PUBLIC_PREFIX = "/images/cms/cars/";
