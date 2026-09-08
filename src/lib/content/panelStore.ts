import { createHash } from "node:crypto";
import {
  LOCALES,
  type ContentLocale,
  type GateFailure,
  type LangReviewStatus,
  type ReviewState,
} from "./carsGate";
import { KINDS, KIND_ORDER, type ContentKind, type KindKey } from "./kinds";
import {
  ConflictError,
  StorageAuthError,
  StorageBackendError,
  StorageForbiddenError,
  WriteUncertainError,
  type DeployStatus,
  type PanelStorage,
} from "./store/adapter";

export const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");

const PUBLISHED = "src/content/cms/published.json" as const;
const REVIEW = "src/content/cms/review-state.json" as const;

/** keys inside published.json, one per kind, in a fixed order. */
const SNAPSHOT_KEYS = ["cars", "gallery", "services", "contact", "promos"] as const;
type SnapshotKey = (typeof SNAPSHOT_KEYS)[number];
const KEY_FOR_KIND: Record<KindKey, SnapshotKey> = {
  car: "cars",
  gallery: "gallery",
  service: "services",
  contact: "contact",
  promo: "promos",
};

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

export type Snapshot = { publishedAt: string } & Record<SnapshotKey, unknown[]>;

function parseSnapshot(text: string | null): Snapshot {
  const o = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  const out = { publishedAt: String(o.publishedAt ?? "") } as Snapshot;
  for (const k of SNAPSHOT_KEYS) out[k] = Array.isArray(o[k]) ? (o[k] as unknown[]) : [];
  return out;
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

/** Rebuild published.json replacing exactly one kind's list. */
function rebuildSnapshot(prev: Snapshot, kindKey: KindKey, nextList: unknown[]): Snapshot {
  const next = { publishedAt: new Date().toISOString() } as Snapshot;
  for (const k of SNAPSHOT_KEYS) {
    if (k === KEY_FOR_KIND[kindKey]) {
      next[k] = nextList;
    } else {
      const kind = KINDS[
        (Object.keys(KEY_FOR_KIND) as KindKey[]).find((kk) => KEY_FOR_KIND[kk] === k)!
      ];
      next[k] = coerceSnapshotList(kind, prev[k]) as unknown[];
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// dashboard model
// ---------------------------------------------------------------------------

export type ItemPublishState = "not-published" | "in-sync" | "modified" | "orphan-published";

export interface PanelRow {
  id: string;
  title: string;
  subtitle: string;
  /** `null` when the working card is gone (orphan-published row). */
  editHref: string | null;
  langStatus: Record<ContentLocale, LangReviewStatus>;
  blockers: GateFailure[];
  publishState: ItemPublishState;
  publiclyVisible: boolean;
  publishedExists: boolean;
  /**
   * Whether a working (Keystatic) card backs this row. `false` means the card
   * was deleted but a published copy still lives in the snapshot — the row is
   * shown read-only with only "прибрати з сайті".
   */
  workingExists: boolean;
}
export interface PanelGroup {
  kind: KindKey;
  label: string;
  singleEntry: boolean;
  createHref: string | null;
  rows: PanelRow[];
}
export type Versions = Record<KindKey, string> & { review: string; published: string };
export interface PanelData {
  groups: PanelGroup[];
  publishedAt: string;
  deploy: DeployStatus;
  mode: "local" | "github";
  /** Working branch in github mode; `null` for local files. */
  branch: string | null;
  versions: Versions;
}

const COLLECTION_SLUG: Record<KindKey, string> = {
  car: "cars",
  gallery: "galleryProjects",
  service: "services",
  contact: "siteContact",
  promo: "promos",
};
function subtitleFor(kind: KindKey, item: { id: string; order: number } & Record<string, unknown>) {
  if (kind === "car") return `${item.id} · ${item.price ?? ""} · порядок ${item.order}`;
  if (kind === "contact") return "телефон, email, соцмережі, графік — трьома мовами";
  if (kind === "promo") {
    return `${item.id} · ${item.visible === false ? "прихований" : "видимий"} · порядок ${item.order}`;
  }
  return `${item.id} · порядок ${item.order}`;
}
/**
 * Keystatic URL base. In github mode the panel and the editor MUST agree on the
 * branch, so every link is branch-scoped; otherwise Keystatic would open its own
 * last/default branch (main) and show different content than /panel.
 */
const keystaticBase = (branch: string | null) =>
  branch ? `/keystatic/branch/${encodeURIComponent(branch)}` : "/keystatic";

const editHrefFor = (kind: KindKey, id: string, branch: string | null) =>
  kind === "contact"
    ? `${keystaticBase(branch)}/singleton/siteContact` // singleton — one edit page, no "Add"
    : `${keystaticBase(branch)}/collection/${COLLECTION_SLUG[kind]}/item/${id}`;

const createHrefFor = (kind: KindKey, branch: string | null) =>
  `${keystaticBase(branch)}/collection/${COLLECTION_SLUG[kind]}/create`;

export async function getPanelData(storage: PanelStorage): Promise<PanelData> {
  // Content reads (readDir / readFile) are NOT wrapped: a failure there must
  // reject so the page shows a retry state — it is never turned into an empty
  // dashboard. ONLY the deploy-status probe is caught here: it is
  // non-essential, so if the backend gives no usable answer the content still
  // renders and the banner shows "unknown" (which the banner never styles as a
  // successful build).
  const dirs = await Promise.all(KIND_ORDER.map((k) => storage.readDir(KINDS[k].dir)));
  const [publishedF, reviewF, deploy] = await Promise.all([
    storage.readFile(PUBLISHED),
    storage.readFile(REVIEW),
    storage.deployStatus().catch((err): DeployStatus => {
      if (err instanceof StorageBackendError) {
        return { state: "unknown", reason: "не вдалося перевірити стан збірки" };
      }
      throw err;
    }),
  ]);
  const snapshot = parseSnapshot(publishedF.data);
  const review = parseReview(reviewF.data);
  const ctx = { review, sha256 };

  const groups: PanelGroup[] = KIND_ORDER.map((kindKey, i) => {
    const kind = KINDS[kindKey] as ContentKind<{ id: string; order: number }>;
    const working = coerceList(kind, dirs[i].data);
    const publishedList = coerceSnapshotList(kind, snapshot[KEY_FOR_KIND[kindKey]]);
    const publishedById = new Map(publishedList.map((p) => [p.id, p]));
    const workingIds = new Set(working.map((w) => w.id));

    const emptyLangStatus = () =>
      Object.fromEntries(LOCALES.map((l) => [l, "empty" as LangReviewStatus])) as Record<
        ContentLocale,
        LangReviewStatus
      >;

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
        subtitle: subtitleFor(kindKey, item as never),
        editHref: editHrefFor(kindKey, item.id, storage.branch),
        langStatus,
        blockers: kind.publishBlockers(item, ctx),
        publishState,
        publiclyVisible: Boolean(pub) && kind.isRenderable(pub!),
        publishedExists: Boolean(pub),
        workingExists: true,
      };
    });

    // Entries still in the published snapshot whose working card was deleted.
    // They keep rendering on the public site, so the panel MUST keep a way to
    // take them down. Read-only: no edit link (nothing to edit), no publish /
    // confirm actions, and getPanelData never recreates the working file.
    const orphanRows = publishedList
      .filter((pub) => !workingIds.has(pub.id))
      .map((pub): PanelRow => ({
        id: pub.id,
        title: kind.displayTitle(pub),
        subtitle: subtitleFor(kindKey, pub as never),
        editHref: null,
        langStatus: emptyLangStatus(),
        blockers: [],
        publishState: "orphan-published",
        publiclyVisible: kind.isRenderable(pub),
        publishedExists: true,
        workingExists: false,
      }));

    return {
      kind: kindKey,
      label: kind.label,
      singleEntry: Boolean(kind.singleEntry),
      createHref: kind.singleEntry ? null : createHrefFor(kindKey, storage.branch),
      rows: [...rows, ...orphanRows],
    };
  });

  const versions = { review: reviewF.version, published: publishedF.version } as Versions;
  KIND_ORDER.forEach((k, i) => {
    versions[k] = dirs[i].version;
  });

  return {
    groups,
    publishedAt: snapshot.publishedAt,
    deploy,
    mode: storage.mode,
    branch: storage.branch,
    versions,
  };
}

// ---------------------------------------------------------------------------
// actions — server re-reads + re-gates every time; the browser supplies only
// { kind, id, locale } and the version tokens it last saw.
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      message: string;
      blockers?: GateFailure[];
      conflict?: boolean;
      /** GitHub unreachable / rate-limited / a write's outcome is unknown — a
       *  transient backend problem, not bad input. Trying again later is fine. */
      transient?: boolean;
      /** 401 — the GitHub session ended; the user must sign in again. */
      auth?: boolean;
      /** 403 — access was refused (permissions narrowed / repo access lost);
       *  signing in again will not fix it. */
      forbidden?: boolean;
    };

const asConflict = (err: unknown): ActionResult | null =>
  err instanceof ConflictError ? { ok: false, message: err.message, conflict: true } : null;

/**
 * Turn any storage error into a user-facing ActionResult. Never leaks a token,
 * a raw GitHub body or a stack trace — only the error's own message text.
 *  - ConflictError         -> {conflict:true}, offer refresh
 *  - StorageAuthError (401) -> {auth:true}; message says sign in again
 *  - StorageForbiddenError (403) -> {forbidden:true}; access changed, re-login won't help
 *  - StorageRateLimitedError / StorageUnavailableError / WriteUncertainError
 *      -> {transient:true}; safe to try again (write-uncertain: reload & check first)
 *  - anything else         -> generic failure with the message prefixed
 */
function toActionError(err: unknown, prefix: string): ActionResult {
  const conflict = asConflict(err);
  if (conflict) return conflict;
  if (err instanceof StorageAuthError) return { ok: false, message: err.message, auth: true };
  if (err instanceof StorageForbiddenError) {
    return { ok: false, message: err.message, forbidden: true };
  }
  if (err instanceof WriteUncertainError) {
    return { ok: false, message: err.message, transient: true };
  }
  if (err instanceof StorageBackendError) {
    // StorageUnavailableError / StorageRateLimitedError — both retriable.
    return { ok: false, message: err.message, transient: true };
  }
  return { ok: false, message: `${prefix}: ${(err as Error).message}` };
}

/** Run an action body; map storage failures (incl. the load phase) to a result. */
async function runAction(prefix: string, body: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await body();
  } catch (err) {
    return toActionError(err, prefix);
  }
}

async function loadKind(storage: PanelStorage, kindKey: KindKey) {
  const kind = KINDS[kindKey] as ContentKind<{ id: string; order: number }>;
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
  return runAction("Не збережено", async () => {
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
    await storage.writeFile(REVIEW, `${JSON.stringify(next, null, 2)}\n`, expected.review);
    return { ok: true, message: `${locale.toUpperCase()}: позначено перевіреним.` };
  });
}

export async function publishItem(
  storage: PanelStorage,
  kindKey: KindKey,
  id: string,
  expected: { working: string; review: string; published: string },
): Promise<ActionResult> {
  return runAction("Публікація не вдалася", async () => {
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
    const current = coerceSnapshotList(kind, snapshot[KEY_FOR_KIND[kindKey]]);
    const existing = current.find((p) => p.id === id);
    if (existing && stable(existing) === stable(item)) {
      return { ok: true, message: `«${id}» вже опубліковано в цій версії.` };
    }

    const nextList = [...current.filter((p) => p.id !== id), item].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
    const nextSnapshot = rebuildSnapshot(snapshot, kindKey, nextList as unknown[]);

    // Close the read→verify→write TOCTOU window: re-read working + review right
    // before committing; abort on any drift (parallel Keystatic save / confirm).
    const recheck = await loadKind(storage, kindKey);
    if (recheck.workingVersion !== expected.working || recheck.reviewVersion !== expected.review) {
      return { ok: false, conflict: true, message: new ConflictError("контент").message };
    }

    await storage.writeFile(PUBLISHED, `${JSON.stringify(nextSnapshot, null, 2)}\n`, expected.published);
    const tail =
      storage.mode === "github"
        ? " Очікуйте завершення збірки (1–3 хв), стан — угорі сторінки."
        : " Зміни на сайті.";
    return {
      ok: true,
      message: kind.isRenderable(item)
        ? `Опубліковано.${tail}`
        : `Опубліковано. «${id}» приховане публічно.`,
    };
  });
}

export async function unpublishItem(
  storage: PanelStorage,
  kindKey: KindKey,
  id: string,
  expected: { published: string },
): Promise<ActionResult> {
  return runAction("Не вдалося прибрати з сайту", async () => {
    const kind = KINDS[kindKey] as ContentKind<{ id: string; order: number }>;
    const publishedF = await storage.readFile(PUBLISHED);
    if (publishedF.version !== expected.published) {
      return { ok: false, conflict: true, message: new ConflictError("знімок").message };
    }
    const snapshot = parseSnapshot(publishedF.data);
    const current = coerceSnapshotList(kind, snapshot[KEY_FOR_KIND[kindKey]]);
    if (!current.some((p) => p.id === id)) {
      return { ok: false, message: `«${id}» і так не опубліковане.` };
    }
    const nextSnapshot = rebuildSnapshot(
      snapshot,
      kindKey,
      current.filter((p) => p.id !== id) as unknown[],
    );
    await storage.writeFile(PUBLISHED, `${JSON.stringify(nextSnapshot, null, 2)}\n`, expected.published);
    const tail = storage.mode === "github" ? " Опубліковану версію буде знято після наступної збірки." : "";
    return {
      ok: true,
      message: `«${id}» прибрано з опублікованого знімка.${tail}`,
    };
  });
}
