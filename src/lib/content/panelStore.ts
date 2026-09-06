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
import {
  ConflictError,
  type DeployStatus,
  type PanelStorage,
  type Snapshot,
} from "./store/adapter";

export const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");

// ---------------------------------------------------------------------------
// dashboard model
// ---------------------------------------------------------------------------

export type CarPublishState = "not-published" | "in-sync" | "modified";

export interface CarPanelRow {
  car: CmsCar;
  langStatus: Record<ContentLocale, LangReviewStatus>;
  blockers: GateFailure[];
  publishState: CarPublishState;
  publiclyVisible: boolean;
  publishedExists: boolean;
}

export interface PanelData {
  rows: CarPanelRow[];
  publishedAt: string;
  deploy: DeployStatus;
  mode: "local" | "github";
  /** opaque version tokens the client echoes back with each action */
  versions: { working: string; review: string; published: string };
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

export async function getPanelData(storage: PanelStorage): Promise<PanelData> {
  const [working, review, published, deploy] = await Promise.all([
    storage.readWorkingCars(),
    storage.readReview(),
    storage.readPublished(),
    storage.deployStatus(),
  ]);
  const publishedById = new Map(published.data.cars.map((c) => [c.id, c]));
  const ctx = { review: review.data, sha256 };

  const rows = working.data.map((car): CarPanelRow => {
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

  return {
    rows,
    publishedAt: published.data.publishedAt,
    deploy,
    mode: storage.mode,
    versions: { working: working.version, review: review.version, published: published.version },
  };
}

// ---------------------------------------------------------------------------
// actions — the server always re-reads the material and re-runs the gate;
// the browser only supplies { carId, locale } and the version tokens it saw.
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; blockers?: GateFailure[]; conflict?: boolean };

function conflict(err: unknown): ActionResult | null {
  return err instanceof ConflictError ? { ok: false, message: err.message, conflict: true } : null;
}

export async function confirmLocale(
  storage: PanelStorage,
  carId: string,
  locale: ContentLocale,
  expected: { review: string; working: string },
): Promise<ActionResult> {
  const [working, review] = await Promise.all([storage.readWorkingCars(), storage.readReview()]);
  if (working.version !== expected.working) {
    return {
      ok: false,
      conflict: true,
      message: new ConflictError("робочі картки авто").message,
    };
  }
  const car = working.data.find((c) => c.id === carId);
  if (!car) return { ok: false, message: `Авто «${carId}» не знайдено.` };

  const status = getLangStatus(car, locale, { review: review.data, sha256 });
  if (status === "empty") {
    return { ok: false, message: `${locale.toUpperCase()}: спершу заповніть назву й характеристики.` };
  }

  const next: ReviewState = {
    ...review.data,
    [carId]: {
      ...review.data[carId],
      [locale]: { hash: sha256(confirmedText(car[locale])), at: new Date().toISOString() },
    },
  };
  try {
    await storage.writeReview(next, expected.review);
  } catch (err) {
    return conflict(err) ?? { ok: false, message: `Не вдалося зберегти: ${(err as Error).message}` };
  }
  return { ok: true, message: `${locale.toUpperCase()}: переклад позначено перевіреним.` };
}

export async function publishCar(
  storage: PanelStorage,
  carId: string,
  expected: { working: string; published: string; review: string },
): Promise<ActionResult> {
  const [working, review, published] = await Promise.all([
    storage.readWorkingCars(),
    storage.readReview(),
    storage.readPublished(),
  ]);

  // §3: the material must not have changed between viewing and publishing.
  if (working.version !== expected.working || review.version !== expected.review) {
    return {
      ok: false,
      conflict: true,
      message: new ConflictError("контент авто").message,
    };
  }

  const car = working.data.find((c) => c.id === carId);
  if (!car) return { ok: false, message: `Авто «${carId}» не знайдено.` };

  // The server builds the snapshot from verified data — never trusts a
  // published.json or flags supplied by the browser.
  const blockers = getPublishBlockers(car, { review: review.data, sha256 });
  if (blockers.length > 0) {
    return { ok: false, message: "Не можна опублікувати — є невирішені пункти.", blockers };
  }

  const alreadyInSync =
    published.data.cars.some((c) => c.id === carId) &&
    stableStringify(published.data.cars.find((c) => c.id === carId)) === stableStringify(car);
  if (alreadyInSync) {
    return { ok: true, message: `Авто «${carId}» вже опубліковане в цій версії.` };
  }

  const cars = published.data.cars.filter((c) => c.id !== carId);
  cars.push(car);
  cars.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const nextSnapshot: Snapshot = { publishedAt: new Date().toISOString(), cars };

  try {
    await storage.writePublished(nextSnapshot, expected.published);
  } catch (err) {
    return conflict(err) ?? { ok: false, message: `Публікація не вдалася: ${(err as Error).message}` };
  }

  return {
    ok: true,
    message: isRenderable(car)
      ? `Опубліковано. ${storage.mode === "github" ? "Очікуйте завершення збірки (1–3 хв)." : "Зміни на сайті."}`
      : `Опубліковано. Авто «${carId}» приховане публічно (статус «${car.saleStatus}»), картка збережена.`,
  };
}

export async function unpublishCar(
  storage: PanelStorage,
  carId: string,
  expectedPublished: string,
): Promise<ActionResult> {
  const published = await storage.readPublished();
  if (published.version !== expectedPublished) {
    return { ok: false, conflict: true, message: new ConflictError("опублікований знімок").message };
  }
  if (!published.data.cars.some((c) => c.id === carId)) {
    return { ok: false, message: `Авто «${carId}» і так не опубліковане.` };
  }
  const nextSnapshot: Snapshot = {
    publishedAt: new Date().toISOString(),
    cars: published.data.cars.filter((c) => c.id !== carId),
  };
  try {
    await storage.writePublished(nextSnapshot, expectedPublished);
  } catch (err) {
    return conflict(err) ?? { ok: false, message: `Не вдалося: ${(err as Error).message}` };
  }
  return { ok: true, message: `Авто «${carId}» прибрано з сайту. Робоча картка збережена.` };
}
