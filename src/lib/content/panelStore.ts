import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  LOCALES,
  confirmedText,
  getLangStatus,
  getPublishBlockers,
  isRenderable,
  type CmsCar,
  type ContentLocale,
  type GateFailure,
  type LangReviewStatus,
  type ReviewState,
} from "./carsGate";
import { CARS_WORKING_DIR, PUBLISHED_FILE, REVIEW_FILE } from "./paths";

export const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");

// ---------------------------------------------------------------------------
// low-level file IO
// ---------------------------------------------------------------------------

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}
async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function coerceLang(v: unknown) {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    title: String(o.title ?? ""),
    specLine: String(o.specLine ?? ""),
    description: String(o.description ?? ""),
    viewGalleryLabel: String(o.viewGalleryLabel ?? ""),
  };
}
function coerceCar(id: string, raw: Record<string, unknown>): CmsCar {
  const v = (raw.video ?? {}) as Record<string, unknown>;
  return {
    id,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 100,
    saleStatus: (["preparing", "for-sale", "reserved", "sold"].includes(String(raw.saleStatus))
      ? raw.saleStatus
      : "for-sale") as CmsCar["saleStatus"],
    year: String(raw.year ?? ""),
    price: String(raw.price ?? ""),
    mileageValue: Number(raw.mileageValue ?? 0),
    photos: Array.isArray(raw.photos)
      ? (raw.photos as Record<string, unknown>[]).map((p) => ({
          image: String(p?.image ?? ""),
          caption: String(p?.caption ?? ""),
        }))
      : [],
    video: {
      mode: String(v.mode ?? "none"),
      src: String(v.src ?? ""),
      posterSrc: String(v.posterSrc ?? ""),
    },
    uk: coerceLang(raw.uk),
    en: coerceLang(raw.en),
    ru: coerceLang(raw.ru),
  };
}

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------

export async function readWorkingCars(): Promise<CmsCar[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(CARS_WORKING_DIR)).filter(
      (f) => f.endsWith(".json") && !f.startsWith("."),
    );
  } catch {
    return [];
  }
  const cars: CmsCar[] = [];
  for (const file of files) {
    const raw = await readJson<Record<string, unknown>>(path.join(CARS_WORKING_DIR, file), {});
    cars.push(coerceCar(file.replace(/\.json$/, ""), raw));
  }
  return cars.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export const readReview = () => readJson<ReviewState>(REVIEW_FILE, {});

interface Snapshot {
  publishedAt: string;
  cars: CmsCar[];
}
export async function readPublished(): Promise<Snapshot> {
  const raw = await readJson<{ publishedAt?: string; cars?: Record<string, unknown>[] }>(
    PUBLISHED_FILE,
    { publishedAt: "", cars: [] },
  );
  return {
    publishedAt: raw.publishedAt ?? "",
    // Coerce through the same shape as the working copy so "modified"
    // detection is not confused by Keystatic's empty-field trimming.
    cars: (raw.cars ?? []).map((c) => coerceCar(String(c.id ?? ""), c)),
  };
}

// ---------------------------------------------------------------------------
// panel dashboard model
// ---------------------------------------------------------------------------

export type CarPublishState = "not-published" | "in-sync" | "modified";

export interface CarPanelRow {
  car: CmsCar;
  langStatus: Record<ContentLocale, LangReviewStatus>;
  blockers: GateFailure[];
  publishState: CarPublishState;
  publiclyVisible: boolean;
  /** true if the working record equals the published one byte-for-byte */
  publishedExists: boolean;
}

/** Deep, key-sorted JSON — so "modified" detection sees nested text edits. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export async function getPanelRows(): Promise<{ rows: CarPanelRow[]; publishedAt: string }> {
  const [working, review, published] = await Promise.all([
    readWorkingCars(),
    readReview(),
    readPublished(),
  ]);
  const publishedById = new Map(published.cars.map((c) => [c.id, c]));
  const ctx = { review, sha256 };

  const rows = working.map((car): CarPanelRow => {
    const pub = publishedById.get(car.id);
    const langStatus = Object.fromEntries(
      LOCALES.map((l) => [l, getLangStatus(car, l, ctx)]),
    ) as Record<ContentLocale, LangReviewStatus>;

    let publishState: CarPublishState = "not-published";
    if (pub) {
      publishState = stableStringify(pub) === stableStringify(car) ? "in-sync" : "modified";
    }
    return {
      car,
      langStatus,
      blockers: getPublishBlockers(car, ctx),
      publishState,
      publiclyVisible: Boolean(pub) && isRenderable(pub as CmsCar),
      publishedExists: Boolean(pub),
    };
  });

  return { rows, publishedAt: published.publishedAt };
}

// ---------------------------------------------------------------------------
// panel actions (local file mode)
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; blockers?: GateFailure[] };

/** "Позначити переклад перевіреним" — locks the current text for one locale. */
export async function confirmLocale(carId: string, locale: ContentLocale): Promise<ActionResult> {
  const working = await readWorkingCars();
  const car = working.find((c) => c.id === carId);
  if (!car) return { ok: false, message: `Авто «${carId}» не знайдено.` };
  const status = getLangStatus(car, locale, { review: await readReview(), sha256 });
  if (status === "empty") {
    return { ok: false, message: `${locale.toUpperCase()}: спершу заповніть назву й характеристики.` };
  }
  const review = await readReview();
  review[carId] = {
    ...review[carId],
    [locale]: { hash: sha256(confirmedText(car[locale])), at: new Date().toISOString() },
  };
  await writeJson(REVIEW_FILE, review);
  return { ok: true, message: `${locale.toUpperCase()}: переклад позначено перевіреним.` };
}

/** "Опублікувати зміни" — freeze the working car into the public snapshot. */
export async function publishCar(carId: string): Promise<ActionResult> {
  const [working, review, published] = await Promise.all([
    readWorkingCars(),
    readReview(),
    readPublished(),
  ]);
  const car = working.find((c) => c.id === carId);
  if (!car) return { ok: false, message: `Авто «${carId}» не знайдено.` };

  const blockers = getPublishBlockers(car, { review, sha256 });
  if (blockers.length > 0) {
    return { ok: false, message: "Не можна опублікувати — є невирішені пункти.", blockers };
  }

  const cars = published.cars.filter((c) => c.id !== carId);
  cars.push(car);
  cars.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  await writeJson(PUBLISHED_FILE, { publishedAt: new Date().toISOString(), cars });

  const visible = isRenderable(car);
  return {
    ok: true,
    message: visible
      ? `Опубліковано. Зміни в авто «${carId}» тепер на сайті.`
      : `Опубліковано. Авто «${carId}» приховане публічно (статус «${car.saleStatus}»), картка збережена.`,
  };
}

/** "Прибрати з сайту" — remove the car from the public snapshot (kept in the panel). */
export async function unpublishCar(carId: string): Promise<ActionResult> {
  const published = await readPublished();
  if (!published.cars.some((c) => c.id === carId)) {
    return { ok: false, message: `Авто «${carId}» і так не опубліковане.` };
  }
  await writeJson(PUBLISHED_FILE, {
    publishedAt: new Date().toISOString(),
    cars: published.cars.filter((c) => c.id !== carId),
  });
  return { ok: true, message: `Авто «${carId}» прибрано з сайту. Робоча картка збережена.` };
}
