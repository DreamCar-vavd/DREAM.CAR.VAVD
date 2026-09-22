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
 *  1. moves each car's photos + video into the Keystatic image-field layout
 *     public/images/cms/cars/<id>/photos/<N>/image.<ext> (+ video/). The
 *     files are git-mv'd — the repo does not grow, no video is duplicated.
 *  2. writes src/content/cms/cars/<id>.json — the WORKING copy Keystatic edits
 *     (content + shared facts only, no publish/review flags).
 *  3. writes src/content/cms/published.json — the public snapshot. All three
 *     cars are currently live, so all three go in.
 *  4. writes src/content/cms/review-state.json — every locale of every car is
 *     confirmed (the existing copy is what production already ships).
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

const GALLERY_DIR = path.join(ROOT, "src/content/cms/gallery");
const GALLERY_DIR_MEDIA = path.join(ROOT, "public/images/cms/gallery");

/** Gallery TEXT captured verbatim on 2026-09-06 from:
 *   maserati-levante  <- src/content/gallery-project-overrides.json (real, ×3)
 *   volvo-xc60-d5     <- dictionaries/*.ts gallery.projects (uk real; en/ru placeholder — as shipped)
 *   showcase-01..06   <- dictionaries/*.ts (placeholder, kept per owner)
 */
const G = (title, service, clientRequest, completedItems, result) => ({
  title,
  shortDescription: "",
  longDescription: "",
  service,
  clientRequest,
  completedItems,
  result,
});
const PLACEHOLDER = {
  uk: G("Автомобіль", "Послуга уточнюється", "Інформація уточнюється.", ["Інформація уточнюється"], "Інформація уточнюється."),
  en: G("Vehicle", "Service to be confirmed", "Information to be confirmed.", ["Information to be confirmed"], "Information to be confirmed."),
  ru: G("Автомобиль", "Услуга уточняется", "Информация уточняется.", ["Информация уточняется"], "Информация уточняется."),
};
const GALLERY_SRC = path.join(ROOT, "public/images/gallery");
const GALLERY_MEDIA = {
  "maserati-levante": [
    "maserati-levante-front.jpg", "maserati-levante-side-left.jpg",
    "maserati-levante-side-front-right.jpg", "maserati-levante-rear.jpg",
    "maserati-levante-front-interior-left.jpg", "maserati-levante-front-interior-right.jpg",
    "maserati-levante-rear-interior-left.jpg", "maserati-levante-dashboard.jpg",
  ].map((n) => [`maserati-levante/${n}`, n]),
  "volvo-xc60-d5": [
    "volvo-xc60-side-right.jpg", "volvo-xc60-front.jpg", "volvo-xc60-rear.jpg",
    "volvo-xc60-interior-front.jpg", "volvo-xc60-interior-rear.jpg",
  ].map((n) => [`volvo-xc60-d5/${n}`, n]),
  ...Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => {
      const id = `showcase-${String(i + 1).padStart(2, "0")}`;
      return [id, [[`${String(i + 1).padStart(2, "0")}.jpg`, `${String(i + 1).padStart(2, "0")}.jpg`]]];
    }),
  ),
};

const GALLERY = [
  {
    id: "maserati-levante", order: 1, kind: "album", year: "2022",
    uk: G("Мазераті Леванте", "Автопідбір під ключ", "Вибрати надійний, технічно справний, гарний автомобіль відповідно до побажань і бюджету клієнта.", ["Кузов і лакофарбове покриття. Комп'ютерна діагностика. Помилок не виявлено."], "Рекомендовано до купівлі"),
    en: G("Maserati Levante", "Turnkey car sourcing", "Select a reliable, technically sound, attractive car matching the client's preferences and budget.", ["Bodywork and paintwork. Computer diagnostics. No faults found."], "Recommended for purchase"),
    ru: G("Мазерати Леванте", "Подбор автомобиля под ключ", "Выбрать надёжный, технически исправный, красивый автомобиль в соответствии с пожеланиями и бюджетом клиента.", ["Кузов и лакокрасочное покрытие. Компьютерная диагностика. Ошибок не выявлено."], "Рекомендовано к покупке"),
  },
  {
    id: "volvo-xc60-d5", order: 2, kind: "album", year: "2018",
    uk: G("Volvo XC60 D5", "Автопідбір під ключ", "Знайти надійний,технічно справний ,гарний автомобіль відповідно до побажань і бюджету клієнта.", ["Проведено комплексну перевірку автомобіля: комп'ютерну діагностику всіх систем і вузлів, огляд кузова, лакофарбового покриття та зазорів, перевірку рівня й стану мастил і технічних рідин, а також тест-драйв. Помилок, слідів повторного фарбування та суттєвих дефектів не виявлено."], "Рекомендовано до купівлі"),
    en: G("Volvo XC60 D5", "Service to be confirmed", "Information to be confirmed.", ["Information to be confirmed"], "Information to be confirmed."),
    ru: G("Volvo XC60 D5", "Услуга уточняется", "Информация уточняется.", ["Информация уточняется"], "Информация уточняется."),
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `showcase-${String(i + 1).padStart(2, "0")}`,
    order: 10 + i,
    kind: "showcase",
    year: "",
    uk: { ...PLACEHOLDER.uk, title: `Автомобіль — фото ${i + 1}` },
    en: { ...PLACEHOLDER.en, title: `Vehicle — photo ${i + 1}` },
    ru: { ...PLACEHOLDER.ru, title: `Автомобиль — фото ${i + 1}` },
  })),
];

function galleryConfirmedText(l) {
  return JSON.stringify({
    title: (l.title ?? "").trim(),
    shortDescription: (l.shortDescription ?? "").trim(),
    longDescription: (l.longDescription ?? "").trim(),
    service: (l.service ?? "").trim(),
    clientRequest: (l.clientRequest ?? "").trim(),
    completedItems: (l.completedItems ?? []).map((s) => s.trim()).filter(Boolean),
    result: (l.result ?? "").trim(),
  });
}

/**
 * Move a media file to `to`, looking for it wherever a previous run of this
 * script, the pre-panel layout, or a Keystatic save may have left it.
 * Idempotent. `extraCandidates` are extra source paths to try.
 */
async function placeMedia(to, ...extraCandidates) {
  const candidates = [to, ...extraCandidates];
  for (const from of candidates) {
    try {
      await fs.access(from);
    } catch {
      continue;
    }
    if (path.resolve(from) === path.resolve(to)) return true;
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    return true;
  }
  console.warn(`  ! media not found for: ${path.relative(ROOT, to)}`);
  return false;
}

async function main() {
  await fs.mkdir(NEW_DIR, { recursive: true });
  await fs.mkdir(CARS_DIR, { recursive: true });

  const review = {};
  const publishedCars = [];

  for (const car of CARS) {
    const carDir = path.join(NEW_DIR, car.id);
    const photoEntries = [];
    for (let i = 0; i < car.photos.length; i++) {
      const name = car.photos[i];
      const ext = name.split(".").pop();
      // Match exactly the layout Keystatic writes for an array of image
      // fields: <directory>/<slug>/<field>/<index>/image.<ext>. The stored
      // value is the full public path (getSrcPrefix appends the slug). Any
      // save from the panel normalises to this, so migrating straight to it
      // keeps the first edit's diff clean.
      const rel = `photos/${i}/image.${ext}`;
      await placeMedia(
        path.join(carDir, rel),
        path.join(carDir, name),
        path.join(NEW_DIR, `${car.id}--${name}`),
        path.join(OLD_DIR, car.oldFolder, name),
      );
      photoEntries.push({ image: `/images/cms/cars/${car.id}/${rel}` });
    }

    let video = { mode: "none", src: "", posterSrc: "" };
    if (car.video) {
      // video.src is a plain text field (not fields.image) — keep it at a
      // stable path next to the poster it reuses.
      await placeMedia(
        path.join(carDir, "video", car.video.file),
        path.join(carDir, car.video.file),
        path.join(NEW_DIR, `${car.id}--${car.video.file}`),
        path.join(OLD_DIR, car.oldFolder, car.video.file),
      );
      const posterIdx = car.photos.indexOf(car.video.poster);
      const posterExt = car.video.poster.split(".").pop();
      video = {
        mode: car.video.mode,
        src: `/images/cms/cars/${car.id}/video/${car.video.file}`,
        posterSrc:
          posterIdx >= 0
            ? `/images/cms/cars/${car.id}/photos/${posterIdx}/image.${posterExt}`
            : `/images/cms/cars/${car.id}/video/${car.video.poster}`,
      };
    }

    const record = {
      // fields.slug stores its "name" here; the filename is the slug. Keep
      // them identical so the stable id is unambiguous.
      id: car.id,
      order: car.order,
      saleStatus: car.saleStatus,
      year: car.year,
      price: car.price,
      mileageValue: car.mileageValue,
      photos: photoEntries,
      video,
      uk: car.uk,
      en: car.en,
      ru: car.ru,
    };
    await fs.writeFile(
      path.join(CARS_DIR, `${car.id}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );

    // The published snapshot stores the same record shape (frozen at publish).
    publishedCars.push({ ...record, photos: photoEntries, video });

    const at = "2026-09-06T00:00:00.000Z";
    review[car.id] = {
      uk: { hash: hash(confirmedText(car.uk)), at },
      en: { hash: hash(confirmedText(car.en)), at },
      ru: { hash: hash(confirmedText(car.ru)), at },
    };
    console.log(`✓ ${car.id}: ${photoEntries.length} photos${car.video ? " + video" : ""}`);
  }

  // ---- Gallery (text only; photos still resolved from the static media map) ----
  await fs.mkdir(GALLERY_DIR, { recursive: true });
  const publishedGallery = [];
  const at = "2026-09-06T00:00:00.000Z";
  for (const g of GALLERY) {
    // Move photos into the Keystatic image-field layout, same as cars.
    const gDir = path.join(GALLERY_DIR_MEDIA, g.id);
    const photoEntries = [];
    const media = GALLERY_MEDIA[g.id] ?? [];
    for (let i = 0; i < media.length; i++) {
      const [srcRel, origName] = media[i];
      const ext = origName.split(".").pop();
      const rel = `photos/${i}/image.${ext}`;
      await placeMedia(
        path.join(gDir, rel),
        path.join(gDir, origName),
        path.join(GALLERY_SRC, srcRel),
      );
      photoEntries.push({ image: `/images/cms/gallery/${g.id}/${rel}`, caption: "" });
    }

    const record = {
      id: g.id,
      order: g.order,
      kind: g.kind,
      year: g.year,
      photos: photoEntries,
      videoUrl: "",
      showContactCta: true,
      uk: g.uk,
      en: g.en,
      ru: g.ru,
    };
    await fs.writeFile(
      path.join(GALLERY_DIR, `${g.id}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    publishedGallery.push(record);
    review[g.id] = {
      uk: { hash: hash(galleryConfirmedText(g.uk)), at },
      en: { hash: hash(galleryConfirmedText(g.en)), at },
      ru: { hash: hash(galleryConfirmedText(g.ru)), at },
    };
    console.log(`✓ gallery ${g.id}`);
  }

  await fs.writeFile(
    path.join(ROOT, "src/content/cms/published.json"),
    `${JSON.stringify(
      { publishedAt: at, cars: publishedCars, gallery: publishedGallery },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(ROOT, "src/content/cms/review-state.json"),
    `${JSON.stringify(review, null, 2)}\n`,
    "utf8",
  );

  // Drop pre-panel / flat / intermediate leftovers.
  await fs.rm(OLD_DIR, { recursive: true, force: true });
  for (const f of await fs.readdir(NEW_DIR)) {
    const full = path.join(NEW_DIR, f);
    if (f.includes("--")) {
      await fs.rm(full, { force: true });
      continue;
    }
    // Inside each car folder keep only photos/ and video/.
    if ((await fs.stat(full)).isDirectory()) {
      for (const inner of await fs.readdir(full)) {
        if (inner !== "photos" && inner !== "video") {
          await fs.rm(path.join(full, inner), { recursive: true, force: true });
        }
      }
    }
  }
  // Gallery: drop the now-empty pre-panel folders/files that were moved.
  // 07.jpg / 08.jpg were never referenced — keep them (no mass deletion).
  for (const id of Object.keys(GALLERY_MEDIA)) {
    for (const [srcRel] of GALLERY_MEDIA[id]) {
      await fs.rm(path.join(GALLERY_SRC, srcRel), { force: true });
    }
  }
  for (const sub of ["maserati-levante", "volvo-xc60-d5"]) {
    await fs.rm(path.join(GALLERY_SRC, sub), { recursive: true, force: true });
  }

  console.log("\nMigration complete. Review: git status");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
