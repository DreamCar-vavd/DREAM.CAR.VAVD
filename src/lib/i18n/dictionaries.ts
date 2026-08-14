import "server-only";
import type { Dictionary } from "@/content/types";
import type { Locale } from "./config";
import { readGalleryProjectOverrides } from "@/lib/galleryProjectOverrides";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  uk: () => import("@/content/dictionaries/uk").then((m) => m.default),
  ru: () => import("@/content/dictionaries/ru").then((m) => m.default),
  en: () => import("@/content/dictionaries/en").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const base = await dictionaries[locale]();
  const overrides = await readGalleryProjectOverrides();

  const overriddenProjects = { ...base.gallery.projects };
  for (const [id, byLocale] of Object.entries(overrides)) {
    const override = byLocale[locale];
    if (override && id in overriddenProjects) {
      overriddenProjects[id as keyof typeof overriddenProjects] = override;
    }
  }

  return {
    ...base,
    gallery: { ...base.gallery, projects: overriddenProjects },
  };
}
