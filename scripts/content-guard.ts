/**
 * content-guard — the trusted check that must pass before any content-publish
 * commit is merged into `main` (report/37 §2, §4).
 *
 *   npm run content:guard
 *   npm run content:guard -- --published <file> --review <file> --media-root <dir>
 *
 * It validates the PUBLISHED SNAPSHOT itself (not just file names) and prints
 * the exact set of media files a merge is allowed to carry alongside it. The
 * GitHub Action (workflow diff in report/37 §4) runs this and additionally
 * enforces at the git level that the content branch changed NOTHING outside
 * { published.json, review-state.json, public/images/cms/** }.
 *
 * Exit 0 = safe to merge. Exit 1 = do not merge; every reason is printed.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { coerceCar, coerceGalleryProject } from "../src/lib/content/coerce";
import { getPublishBlockers, describeFailure, type ReviewState } from "../src/lib/content/carsGate";
import { getGalleryPublishBlockers } from "../src/lib/content/galleryGate";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PUBLISHED = arg("published", "src/content/cms/published.json");
const REVIEW = arg("review", "src/content/cms/review-state.json");
const MEDIA_ROOT = arg("media-root", "public");

/** Only these media roots + extensions may be referenced by a published item. */
const MEDIA_PREFIX = "/images/cms/";
const MEDIA_RE =
  /^\/images\/cms\/(cars|gallery)\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(jpe?g|png|webp|mp4|webm)$/;

const problems: string[] = [];
const mediaPaths = new Set<string>();

function checkMedia(where: string, raw: unknown) {
  const p = String(raw ?? "").trim();
  if (!p) return;
  if (!p.startsWith(MEDIA_PREFIX)) {
    problems.push(`${where}: медіапосилання «${p}» поза дозволеним коренем ${MEDIA_PREFIX}`);
    return;
  }
  if (p.includes("..") || p.includes("//") || p.includes("\\")) {
    problems.push(`${where}: підозрілий шлях «${p}» (.. / // / \\)`);
    return;
  }
  if (!MEDIA_RE.test(p)) {
    problems.push(`${where}: «${p}» не відповідає дозволеному формату (jpg/png/webp/mp4/webm під /images/cms/{cars,gallery}/)`);
    return;
  }
  mediaPaths.add(p);
}

async function fileIsRegular(p: string): Promise<"ok" | "missing" | "not-regular"> {
  const abs = path.join(process.cwd(), MEDIA_ROOT, p.replace(/^\//, ""));
  // Reject anything that escapes the media root after normalisation.
  const rootAbs = path.join(process.cwd(), MEDIA_ROOT, "images/cms");
  if (!path.resolve(abs).startsWith(path.resolve(rootAbs) + path.sep)) return "not-regular";
  try {
    const st = await fs.lstat(abs);
    if (st.isSymbolicLink()) return "not-regular";
    if (!st.isFile()) return "not-regular";
    return "ok";
  } catch {
    return "missing";
  }
}

async function main() {
  let snapshot: { publishedAt?: unknown; cars?: unknown; gallery?: unknown };
  try {
    snapshot = JSON.parse(await fs.readFile(PUBLISHED, "utf8"));
  } catch (err) {
    console.error(`✗ ${PUBLISHED} не парситься: ${(err as Error).message}`);
    process.exit(1);
  }
  const review: ReviewState = JSON.parse(await fs.readFile(REVIEW, "utf8").catch(() => "{}"));

  if (typeof snapshot.publishedAt !== "string") problems.push("published.json: немає publishedAt");
  const cars = Array.isArray(snapshot.cars) ? (snapshot.cars as Record<string, unknown>[]) : null;
  const gallery = Array.isArray(snapshot.gallery)
    ? (snapshot.gallery as Record<string, unknown>[])
    : null;
  if (!cars) problems.push("published.json: cars не масив");
  if (!gallery) problems.push("published.json: gallery не масив");

  for (const raw of cars ?? []) {
    const car = coerceCar(String(raw.id ?? ""), raw);
    const w = `авто «${car.id || "?"}»`;
    if (!car.id) problems.push(`${w}: немає id`);
    for (const b of getPublishBlockers(car, { review, sha256 })) {
      problems.push(`${w}: ${describeFailure(b)}`);
    }
    car.photos.forEach((ph, i) => checkMedia(`${w} фото ${i}`, ph.image));
    if (car.video?.mode === "legacy-file") checkMedia(`${w} відео`, car.video.src);
    if (car.video?.posterSrc && car.video.mode !== "none") checkMedia(`${w} постер`, car.video.posterSrc);
  }

  for (const raw of gallery ?? []) {
    const p = coerceGalleryProject(String(raw.id ?? ""), raw);
    const w = `галерея «${p.id || "?"}»`;
    if (!p.id) problems.push(`${w}: немає id`);
    for (const b of getGalleryPublishBlockers(p, { review, sha256 })) {
      problems.push(`${w}: ${describeFailure(b)}`);
    }
    p.photos.forEach((ph, i) => checkMedia(`${w} фото ${i}`, ph.image));
  }

  // Every referenced media file must exist as a real (non-symlink) file.
  for (const p of mediaPaths) {
    const state = await fileIsRegular(p);
    if (state === "missing") problems.push(`медіа «${p}»: файл відсутній у цільовому середовищі`);
    if (state === "not-regular") problems.push(`медіа «${p}»: не звичайний файл (symlink / поза коренем)`);
  }

  if (problems.length > 0) {
    console.error("✗ content-guard: НЕ ЗЛИВАТИ\n");
    for (const p of problems) console.error(`  • ${p}`);
    process.exit(1);
  }

  console.log(
    `✓ content-guard: ${(cars ?? []).length} авто + ${(gallery ?? []).length} робіт галереї, ` +
      `${mediaPaths.size} медіафайлів — усі перевірені.`,
  );

  // Manifest of the EXACT files a merge is allowed to carry (repo-relative).
  // The guard workflow checks out only these — never a whole directory, so
  // photos belonging to still-unpublished drafts are not pulled into main.
  const manifest = [
    "src/content/cms/published.json",
    "src/content/cms/review-state.json",
    ...[...mediaPaths].sort().map((p) => `public${p}`),
  ];
  const manifestOut = arg("manifest-out", "");
  if (manifestOut) {
    await fs.writeFile(manifestOut, manifest.join("\n") + "\n", "utf8");
    console.log(`\nМаніфест (${manifest.length} файлів) записано: ${manifestOut}`);
  } else {
    console.log("\nФайли, які merge має перенести (і лише вони):");
    manifest.forEach((p) => console.log(`  ${p}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
