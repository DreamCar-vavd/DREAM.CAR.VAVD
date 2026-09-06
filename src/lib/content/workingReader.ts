import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CmsCar } from "./carsGate";
import type { CmsGalleryProject } from "./galleryGate";
import { coerceCar, coerceGalleryProject } from "./coerce";
import { CARS_WORKING_DIR } from "./paths";

/**
 * Reads the WORKING copy for draft preview. Kept in its own module so the
 * dynamic-directory `fs` access is only pulled in when draft mode is actually
 * on (siteContent.ts imports this lazily) and does not affect the static
 * build's file tracing.
 */
const GALLERY_WORKING_DIR = path.join(process.cwd(), "src/content/cms/gallery");

async function readDir<T extends { order: number; id: string }>(
  dir: string,
  coerce: (id: string, raw: Record<string, unknown>) => T,
): Promise<T[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("."));
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const file of files) {
    const raw = JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));
    out.push(coerce(file.replace(/\.json$/, ""), raw));
  }
  return out.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export async function readWorkingContent(): Promise<{
  cars: CmsCar[];
  gallery: CmsGalleryProject[];
}> {
  const [cars, gallery] = await Promise.all([
    readDir(CARS_WORKING_DIR, coerceCar),
    readDir(GALLERY_WORKING_DIR, coerceGalleryProject),
  ]);
  return { cars, gallery };
}
