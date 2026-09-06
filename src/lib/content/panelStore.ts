import { createHash } from "node:crypto";
import {
  LOCALES,
  type ContentLocale,
  type GateFailure,
  type LangReviewStatus,
  type ReviewState,
} from "./carsGate";
import { KINDS, type ContentKind, type KindKey } from "./kinds";
import {
  ConflictError,
  type DeployStatus,
  type PanelStorage,
} from "./store/adapter";

export const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");

const PUBLISHED = "src/content/cms/published.json" as const;
const REVIEW = "src/content/cms/review-state.json" as const;

// deep, key-sorted JSON so "modified" detection sees nested text edits
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

// ---------------------------------------------------------------------------
// snapshot / review parsing
// ---------------------------------------------------------------------------

export interface Snapshot {
  publishedAt: string;
  cars: unknown[];
  gallery: unknown[];
}
function parseSnapshot(text: string | null): Snapshot {
  const o = (text ? JSON.parse(text) : {}) as Partial<Snapshot>;
  return {
    publishedAt: String(o.publishedAt ?? ""),
    cars: Array.isArray(o.cars) ? o.cars : [],
    gallery: Array.isArray(o.gallery) ? o.gallery : [],
  };
}
function parseReview(text: string | null): ReviewState {
  return text ? (JSON.parse(text) as ReviewState) : {};
}

function coerceList<W extends { id: string; order: number }>(
  kind: ContentKind<W>,
  entries: { name: string; text: string }[],
): W[] {
  return entries
    .map((e) => kind.coerce(e.name.replace(/\.json$/, ""), JSON.parse(e.text || "{}")))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
function coerceSnapshotList<W extends { id: string; order: number }>(
  kind: ContentKind<W>,
  raw: unknown[],
): W[] {
  return raw
    .map((r) => kind.coerce(String((r as { id?: unknown }).id ?? ""), r as Record<string, unknown>))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// dashboard model
// ---------------------------------------------------------------------------

export type ItemPublishState = "not-published" | "in-sync" | "modified";

export interface PanelRow {
  id: string;
  title: string;
  subtitle: string;
  editHref: string;
  langStatus: Record<ContentLocale, LangReviewStatus>;
  blockers: GateFailure[];
  publishState: ItemPublishState;
  publiclyVisible: boolean;
  publishedExists: boolean;
}
export interface PanelGroup {
  kind: KindKey;
  label: string;
  rows: PanelRow[];
}
export interface PanelData {
  groups: PanelGroup[];
  publishedAt: string;
  deploy: DeployStatus;
  mode: "local" | "github";
  versions: { car: string; gallery: string; review: string; published: string };
}

function subtitleFor(kind: KindKey, item: { id: string; order: number } & Record<string, unknown>) {
  return kind === "car"
    ? `${item.id} · ${item.price ?? ""} · порядок ${item.order}`
    : `${item.id} · порядок ${item.order}`;
}
function editHrefFor(kind: KindKey, id: string) {
  return kind === "car"
    ? `/keystatic/collection/cars/item/${id}`
    : `/keystatic/collection/galleryProjects/item/${id}`;
}

export async function getPanelData(storage: PanelStorage): Promise<PanelData> {
  const [carsDir, galleryDir, publishedF, reviewF, deploy] = await Promise.all([
    storage.readDir(KINDS.car.dir),
    storage.readDir(KINDS.gallery.dir),
    storage.readFile(PUBLISHED),
    storage.readFile(REVIEW),
    storage.deployStatus(),
  ]);
  const snapshot = parseSnapshot(publishedF.data);
  const review = parseReview(reviewF.data);
  const ctx = { review, sha256 };

  const groups: PanelGroup[] = ([KINDS.car, KINDS.gallery] as ContentKind<{ id: string; order: number }>[]).map(
    (kind) => {
      const working = coerceList(kind, (kind.key === "car" ? carsDir : galleryDir).data);
      const publishedById = new Map(
        coerceSnapshotList(kind, kind.key === "car" ? snapshot.cars : snapshot.gallery).map((p) => [
          p.id,
          p,
        ]),
      );

      const rows = working.map((item): PanelRow => {
        const pub = publishedById.get(item.id);
        const langStatus = Object.fromEntries(
          LOCALES.map((l) => [l, kind.langStatus(item, l, ctx)]),
        ) as Record<ContentLocale, LangReviewStatus>;
        let publishState: ItemPublishState = "not-published";
        if (pub) publishState = stable(pub) === stable(item) ? "in-sync" : "modified";
        return {
          id: item.id,
          title: kind.displayTitle(item),
          subtitle: subtitleFor(kind.key, item as never),
          editHref: editHrefFor(kind.key, item.id),
          langStatus,
          blockers: kind.publishBlockers(item, ctx),
          publishState,
          publiclyVisible: Boolean(pub) && kind.isRenderable(pub!),
          publishedExists: Boolean(pub),
        };
      });
      return { kind: kind.key, label: kind.label, rows };
    },
  );

  return {
    groups,
    publishedAt: snapshot.publishedAt,
    deploy,
    mode: storage.mode,
    versions: {
      car: carsDir.version,
      gallery: galleryDir.version,
      review: reviewF.version,
      published: publishedF.version,
    },
  };
}

// ---------------------------------------------------------------------------
// actions — server re-reads + re-gates every time; the browser supplies only
// { kind, id, locale } and the version tokens it last saw.
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; blockers?: GateFailure[]; conflict?: boolean };

const asConflict = (err: unknown): ActionResult | null =>
  err instanceof ConflictError ? { ok: false, message: err.message, conflict: true } : null;

async function loadKind<W extends { id: string; order: number }>(
  storage: PanelStorage,
  kindKey: KindKey,
) {
  const kind = KINDS[kindKey] as ContentKind<W>;
  const [dir, reviewF] = await Promise.all([storage.readDir(kind.dir), storage.readFile(REVIEW)]);
  return {
    kind,
    working: coerceList(kind, dir.data),
    workingVersion: dir.version,
    review: parseReview(reviewF.data),
    reviewVersion: reviewF.version,
  };
}

export async function confirmLocale(
  storage: PanelStorage,
  kindKey: KindKey,
  id: string,
  locale: ContentLocale,
  expected: { working: string; review: string },
): Promise<ActionResult> {
  const { kind, working, workingVersion, review, reviewVersion } = await loadKind(storage, kindKey);
  if (workingVersion !== expected.working || reviewVersion !== expected.review) {
    return { ok: false, conflict: true, message: new ConflictError("робочі картки").message };
  }
  const item = working.find((w) => w.id === id);
  if (!item) return { ok: false, message: `«${id}» не знайдено.` };
  if (kind.langStatus(item, locale, { review, sha256 }) === "empty") {
    return { ok: false, message: `${locale.toUpperCase()}: спершу заповніть обов'язкові поля.` };
  }
  const next: ReviewState = {
    ...review,
    [id]: {
      ...review[id],
      [locale]: { hash: sha256(kind.confirmedText(item, locale)), at: new Date().toISOString() },
    },
  };
  try {
    await storage.writeFile(REVIEW, `${JSON.stringify(next, null, 2)}\n`, expected.review);
  } catch (err) {
    return asConflict(err) ?? { ok: false, message: `Не збережено: ${(err as Error).message}` };
  }
  return { ok: true, message: `${locale.toUpperCase()}: позначено перевіреним.` };
}

export async function publishItem(
  storage: PanelStorage,
  kindKey: KindKey,
  id: string,
  expected: { working: string; review: string; published: string },
): Promise<ActionResult> {
  const { kind, working, workingVersion, review, reviewVersion } = await loadKind(storage, kindKey);
  const publishedF = await storage.readFile(PUBLISHED);
  if (workingVersion !== expected.working || reviewVersion !== expected.review) {
    return { ok: false, conflict: true, message: new ConflictError("контент").message };
  }
  const item = working.find((w) => w.id === id);
  if (!item) return { ok: false, message: `«${id}» не знайдено.` };

  const blockers = kind.publishBlockers(item, { review, sha256 });
  if (blockers.length > 0) {
    return { ok: false, message: "Не можна опублікувати — є невирішені пункти.", blockers };
  }

  const snapshot = parseSnapshot(publishedF.data);
  const listRaw = kind.snapshotKey === "cars" ? snapshot.cars : snapshot.gallery;
  const current = coerceSnapshotList(kind, listRaw);
  const existing = current.find((p) => p.id === id);
  if (existing && stable(existing) === stable(item)) {
    return { ok: true, message: `«${id}» вже опубліковано в цій версії.` };
  }

  const nextList = [...current.filter((p) => p.id !== id), item].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  const nextSnapshot: Snapshot = {
    publishedAt: new Date().toISOString(),
    cars: kind.snapshotKey === "cars" ? nextList : coerceSnapshotList(KINDS.car, snapshot.cars),
    gallery:
      kind.snapshotKey === "gallery"
        ? nextList
        : coerceSnapshotList(KINDS.gallery, snapshot.gallery),
  };
  try {
    await storage.writeFile(
      PUBLISHED,
      `${JSON.stringify(nextSnapshot, null, 2)}\n`,
      expected.published,
    );
  } catch (err) {
    return asConflict(err) ?? { ok: false, message: `Публікація не вдалася: ${(err as Error).message}` };
  }
  return {
    ok: true,
    message: kind.isRenderable(item)
      ? `Опубліковано.${storage.mode === "github" ? " Очікуйте завершення збірки (1–3 хв)." : " Зміни на сайті."}`
      : `Опубліковано. «${id}» приховане публічно, картка збережена.`,
  };
}

export async function unpublishItem(
  storage: PanelStorage,
  kindKey: KindKey,
  id: string,
  expected: { published: string },
): Promise<ActionResult> {
  const kind = KINDS[kindKey];
  const publishedF = await storage.readFile(PUBLISHED);
  if (publishedF.version !== expected.published) {
    return { ok: false, conflict: true, message: new ConflictError("знімок").message };
  }
  const snapshot = parseSnapshot(publishedF.data);
  const listRaw = kind.snapshotKey === "cars" ? snapshot.cars : snapshot.gallery;
  const current = coerceSnapshotList(kind, listRaw);
  if (!current.some((p) => p.id === id)) {
    return { ok: false, message: `«${id}» і так не опубліковане.` };
  }
  const nextList = current.filter((p) => p.id !== id);
  const nextSnapshot: Snapshot = {
    publishedAt: new Date().toISOString(),
    cars: kind.snapshotKey === "cars" ? nextList : coerceSnapshotList(KINDS.car, snapshot.cars),
    gallery:
      kind.snapshotKey === "gallery"
        ? nextList
        : coerceSnapshotList(KINDS.gallery, snapshot.gallery),
  };
  try {
    await storage.writeFile(
      PUBLISHED,
      `${JSON.stringify(nextSnapshot, null, 2)}\n`,
      expected.published,
    );
  } catch (err) {
    return asConflict(err) ?? { ok: false, message: `Не вдалося: ${(err as Error).message}` };
  }
  return { ok: true, message: `«${id}» прибрано з сайту. Робоча картка збережена.` };
}
