import "server-only";
import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";
import type { Locale } from "./i18n/config";
import type { GalleryProjectCopy } from "@/content/types";

const overridesPath = path.join(process.cwd(), "src/content/gallery-project-overrides.json");

export type GalleryProjectOverrides = Record<string, Partial<Record<Locale, GalleryProjectCopy>>>;

// Deduplicates the disk read across the multiple getDictionary() calls (layout + page)
// that happen within a single request. Scoped per-request by React, so writes made
// via writeGalleryProjectOverride are always visible on the next request — never stale.
export const readGalleryProjectOverrides = cache(async (): Promise<GalleryProjectOverrides> => {
  try {
    const raw = await fs.readFile(overridesPath, "utf-8");
    return JSON.parse(raw) as GalleryProjectOverrides;
  } catch {
    return {};
  }
});

export async function writeGalleryProjectOverride(
  id: string,
  locale: Locale,
  data: GalleryProjectCopy,
): Promise<void> {
  const overrides = await readGalleryProjectOverrides();
  overrides[id] = { ...overrides[id], [locale]: data };
  await fs.writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf-8");
}
