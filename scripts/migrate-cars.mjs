/**
 * One-off, re-runnable migration of the three existing car listings into the
 * Keystatic content model.
 *
 *   node scripts/migrate-cars.mjs
 *
 * Source of truth for the copy below: the pre-panel
 *   src/content/carListings.ts
 *   src/content/dictionaries/{uk,ru,en}.ts  -> carsForSale.listings
 * captured verbatim on 2026-09-06 (main @ ce1977af). Prices, mileage, specs
 * and availability are copied unchanged.
 *
 * What it does:
 *  1. moves each car's photos + video from public/images/cars-for-sale/<id>/
 *     into the flat Keystatic upload dir public/images/cms/cars/ (prefixed
 *     with the car id so names stay unique). Existing files already tracked
 *     by git — this is a move, the repo does not grow.
 *  2. writes src/content/cms/cars/<id>.json in the Keystatic shape.
 *  3. writes src/content/cms/translation-locks.json (one level ABOVE the
 *     collection dir so Keystatic does not treat it as a car) — the hash of
 *     the confirmed per-language text, used by `npm run content:check`.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const OLD_DIR = path.join(ROOT, "public/images/cars-for-sale");
const NEW_DIR = path.join(ROOT, "public/images/cms/cars");
const CARS_DIR = path.join(ROOT, "src/content/cms/cars");

/** @type {Array<{id:string, oldFolder:string, year:string, price:string, mileageValue:number, saleStatus:string, publishState:string, photos:string[], video:null|{mode:string,file:string,poster:string}, uk:object, en:object, ru:object}>} */
const CARS = [
  {
    id: "suzuki-sx4-s-cross",
    oldFolder: "suzuki-sx4-s-cross",
    order: 1,
    year: "2020",
    price: "£9,500",
    mileageValue: 47170,
    saleStatus: "for-sale",
    publishState: "published",
    photos: [
      "suzuki-front.jpg", "suzuki-left.jpg", "suzuki-right.jpg", "suzuki-rear.jpg",
      "suzuki-boot.jpg", "suzuki-interior-front.jpg", "suzuki-interior-rear.jpg",
      "suzuki-sunroof-interior.jpg", "suzuki-sunroof-wide.jpg", "suzuki-dashboard.jpg",
    ],
    video: null,
    uk: { title: "Suzuki SX4 S-Cross", specLine: "1.4 Turbo • Бензин • Автомат", description: "", viewGalleryLabel: "Переглянути 10 фото" },
    en: { title: "Suzuki SX4 S-Cross", specLine: "1.4 Turbo • Petrol • Automatic", description: "", viewGalleryLabel: "View 10 photos" },
    ru: { title: "Suzuki SX4 S-Cross", specLine: "1.4 Turbo • Бензин • Автомат", description: "", viewGalleryLabel: "Посмотреть 10 фото" },
  },
  {
    id: "dacia-sandero-2022",
    oldFolder: "dacia-sandero-2022",
    order: 2,
    year: "2022",
    price: "£9,400",
    mileageValue: 6150,
    saleStatus: "for-sale",
    publishState: "published",
    photos: [
      "dacia-front.jpg", "dacia-left.jpg", "dacia-right.jpg", "dacia-rear.jpg",
      "dacia-interior-front.jpg", "dacia-interior-front-right.jpg", "dacia-interior-rear.jpg",
      "dacia-interior-rear-right.jpg", "dacia-dashboard.jpg",
    ],
    video: { mode: "legacy-file", file: "dacia-walkaround.mp4", poster: "dacia-front.jpg" },
    uk: { title: "Dacia Sandero", specLine: "1.0 Turbo • Бензин • Автомат", description: "", viewGalleryLabel: "Переглянути 9 фото і 1 відео" },
    en: { title: "Dacia Sandero", specLine: "1.0 Turbo • Petrol • Automatic", description: "", viewGalleryLabel: "View 9 photos and 1 video" },
    ru: { title: "Dacia Sandero", specLine: "1.0 Turbo • Бензин • Автомат", description: "", viewGalleryLabel: "Посмотреть 9 фото и 1 видео" },
  },
  {
    id: "dacia-sandero-comfort-2019",
    oldFolder: "dacia-sandero-comfort-2019",
    order: 3,
    year: "2019",
    price: "£3,300",
    mileageValue: 42488,
    saleStatus: "for-sale",
    publishState: "published",
    photos: [
      "01-front.jpeg", "02-front-right.jpeg", "03-right-side.jpeg", "04-rear-right.jpeg",
      "05-rear.jpeg", "06-rear-left.jpeg", "07-left-side.jpeg", "08-driver-door.jpeg",
      "09-rear-door.jpeg", "10-front-interior.jpeg", "11-service-book.jpeg",
    ],
    video: { mode: "legacy-file", file: "12-walkaround.mp4", poster: "01-front.jpeg" },
    uk: { title: "Dacia Sandero Comfort", specLine: "1.0 Turbo • Бензин • Механічна • Сірий", description: "", viewGalleryLabel: "Переглянути 11 фото і 1 відео" },
    en: { title: "Dacia Sandero Comfort", specLine: "1.0 Turbo • Petrol • Manual • Grey", description: "", viewGalleryLabel: "View 11 photos and 1 video" },
    ru: { title: "Dacia Sandero Comfort", specLine: "1.0 Turbo • Бензин • Механическая • Серый", description: "", viewGalleryLabel: "Посмотреть 11 фото и 1 видео" },
  },
];

/** Must match src/lib/content/carsGate.ts confirmedText(). */
function confirmedText(lang) {
  return JSON.stringify({
    title: (lang.title ?? "").trim(),
    specLine: (lang.specLine ?? "").trim(),
    description: (lang.description ?? "").trim(),
    viewGalleryLabel: (lang.viewGalleryLabel ?? "").trim(),
  });
}
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function moveIfPresent(from, to) {
  try {
    await fs.access(from);
  } catch {
    return false;
  }
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
  return true;
}

async function main() {
  await fs.mkdir(NEW_DIR, { recursive: true });
  await fs.mkdir(CARS_DIR, { recursive: true });

  const locks = {};

  for (const car of CARS) {
    const prefix = `${car.id}--`;
    const photoEntries = [];
    for (const name of car.photos) {
      const target = `${prefix}${name}`;
      await moveIfPresent(path.join(OLD_DIR, car.oldFolder, name), path.join(NEW_DIR, target));
      photoEntries.push({ image: target, caption: "" });
    }

    let video = { mode: "none", src: "", posterSrc: "" };
    if (car.video) {
      const vTarget = `${prefix}${car.video.file}`;
      await moveIfPresent(
        path.join(OLD_DIR, car.oldFolder, car.video.file),
        path.join(NEW_DIR, vTarget),
      );
      video = {
        mode: car.video.mode,
        src: `/images/cms/cars/${vTarget}`,
        posterSrc: `/images/cms/cars/${prefix}${car.video.poster}`,
      };
    }

    const withReview = (lang) => ({ ...lang, reviewState: "confirmed" });
    const record = {
      order: car.order,
      publishState: car.publishState,
      saleStatus: car.saleStatus,
      year: car.year,
      price: car.price,
      mileageValue: car.mileageValue,
      photos: photoEntries,
      video,
      uk: withReview(car.uk),
      en: withReview(car.en),
      ru: withReview(car.ru),
    };
    await fs.writeFile(
      path.join(CARS_DIR, `${car.id}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );

    locks[car.id] = {
      uk: hash(confirmedText(car.uk)),
      en: hash(confirmedText(car.en)),
      ru: hash(confirmedText(car.ru)),
    };
    console.log(`✓ ${car.id}: ${photoEntries.length} photos${car.video ? " + video" : ""}`);
  }

  await fs.writeFile(
    path.join(ROOT, "src/content/cms/translation-locks.json"),
    `${JSON.stringify(locks, null, 2)}\n`,
    "utf8",
  );

  // Drop the now-empty old folders (files were moved out).
  for (const car of CARS) {
    await fs.rm(path.join(OLD_DIR, car.oldFolder), { recursive: true, force: true });
  }
  console.log("\nMigration complete. Review: git status");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
