/**
 *   npm run content:check
 *
 * Extra safety layer (report/34 §4). Fails (exit 1) when the PUBLISHED
 * snapshot (src/content/cms/published.json) contains a car that would render
 * broken — no photos, an empty UK/EN/RU title/specLine, or a video set to the
 * not-yet-connected "uploaded-file" mode.
 *
 * The site build (src/lib/content/publishedCars.ts) throws on the same
 * conditions, so a bad snapshot already fails `next build` and Vercel keeps
 * the previous deployment. This script surfaces it earlier / offline.
 *
 * It also WARNS (does not fail) about working cars whose review is stale, so
 * the editor notices before opening /panel.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const CMS = path.join(ROOT, "src/content/cms");
const LOCALES = ["uk", "en", "ru"];
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
const confirmedText = (l) =>
  JSON.stringify({
    title: (l?.title ?? "").trim(),
    specLine: (l?.specLine ?? "").trim(),
    description: (l?.description ?? "").trim(),
    viewGalleryLabel: (l?.viewGalleryLabel ?? "").trim(),
  });

const readJson = async (p, fb) => {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return fb;
  }
};

async function main() {
  const snapshot = await readJson(path.join(CMS, "published.json"), { cars: [] });
  const review = await readJson(path.join(CMS, "review-state.json"), {});
  const errors = [];
  const warnings = [];

  for (const car of snapshot.cars ?? []) {
    const w = `published.json → «${car?.id ?? "?"}»`;
    if (!car?.id) errors.push(`${w}: немає id`);
    const photos = Array.isArray(car.photos) ? car.photos.filter((p) => p?.image?.trim()) : [];
    if (photos.length === 0) errors.push(`${w}: жодного фото`);
    if (car.video?.mode === "uploaded-file") {
      errors.push(`${w}: відео у режимі «завантажений файл» — не підключено`);
    }
    for (const l of LOCALES) {
      if (!String(car[l]?.title ?? "").trim() || !String(car[l]?.specLine ?? "").trim()) {
        errors.push(`${w}: ${l.toUpperCase()} назва/характеристики порожні`);
      }
    }
  }

  // Working cars: warn on stale / missing review.
  let workingFiles = [];
  try {
    workingFiles = (await fs.readdir(path.join(CMS, "cars"))).filter(
      (f) => f.endsWith(".json") && !f.startsWith("."),
    );
  } catch {
    /* none */
  }
  for (const file of workingFiles) {
    const id = file.replace(/\.json$/, "");
    const car = await readJson(path.join(CMS, "cars", file), {});
    for (const l of LOCALES) {
      const filled =
        String(car[l]?.title ?? "").trim() && String(car[l]?.specLine ?? "").trim();
      if (!filled) continue;
      const rec = review[id]?.[l];
      if (!rec) warnings.push(`${id} / ${l.toUpperCase()}: не позначено перевіреним`);
      else if (rec.hash !== hash(confirmedText(car[l]))) {
        warnings.push(`${id} / ${l.toUpperCase()}: текст змінено після перевірки`);
      }
    }
  }

  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  if (errors.length) {
    console.error("\n✗ published.json містить непридатні авто:\n");
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }
  console.log(
    `\n✓ published.json: ${(snapshot.cars ?? []).length} авто, усі придатні.` +
      (warnings.length ? ` (${warnings.length} попереджень у робочих чернетках)` : ""),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
