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

/**
 * The card-instance token stored on a working card JSON as `bornAt`. Keystatic
 * mints a fresh one on every "create" (schema default), so a delete + re-create
 * under the same slug yields a different token even with identical text. "" when
 * the card predates the field (legacy) or the JSON is unreadable — a legacy
 * card only ever matches a legacy (token-less) review row.
 */
function instanceToken(text: string): string {
  try {
    return String((JSON.parse(text || "{}") as { bornAt?: unknown }).bornAt ?? "");
  } catch {
    return "";
  }
}
/** slug -> instance token, for one kind's raw directory entries. */
function instanceMap(entries: { name: string; text: string }[]): Map<string, string> {
  return new Map(entries.map((e) => [e.name.replace(/\.json$/, ""), instanceToken(e.text)]));
}

/**
 * review-state.json is a flat `slug -> { locale: {hash, at} }` map shared by
 * every kind. Keystatic's "Delete entry" is a direct GitHub commit that removes
 * the item JSON (and its images) but never touches this file, so deleting a
 * card through the editor leaves its review row behind. Left alone those rows
 * accumulate, and — worse — if the same slug is re-created later a leftover hash
 * could briefly show a language as "перевірено" that was never re-confirmed.
 *
 * A row is stale when its slug backs no working card in ANY kind. This is the
 * one place that decides it; callers pass the union of every kind's working
 * ids. Pure — no I/O.
 */
function staleReviewSlugs(review: ReviewState, workingSlugs: ReadonlySet<string>): string[] {
  return Object.keys(review).filter((slug) => !workingSlugs.has(slug));
}
function pruneReview(review: ReviewState, workingSlugs: ReadonlySet<string>): ReviewState {
  if (staleReviewSlugs(review, workingSlugs).length === 0) return review;
  return Object.fromEntries(
    Object.entries(review).filter(([slug]) => workingSlugs.has(slug)),
  ) as ReviewState;
}

/**
 * Every working-card id across every kind, in one set. Used to spot stale
 * review-state rows. Best-effort at the call sites that only need it for
 * cleanup — a read failure here must never sink the surrounding action.
 */
async function collectWorkingSlugs(storage: PanelStorage): Promise<Set<string>> {
  const dirs = await Promise.all(KIND_ORDER.map((k) => storage.readDir(KINDS[k].dir)));
  const slugs = new Set<string>();
  KIND_ORDER.forEach((kindKey, i) => {
    const kind = KINDS[kindKey] as ContentKind<{ id: string; order: number }>;
    for (const w of coerceList(kind, dirs[i].data)) slugs.add(w.id);
  });
  return slugs;
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
  /**
   * review-state.json rows whose slug no longer backs any working card (a card
   * deleted straight from Keystatic — its delete never touches review-state).
   * They do not colour the dashboard; the next panel write drops them.
   */
  staleReviewSlugs: string[];
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

  const workingLists = KIND_ORDER.map((kindKey, i) =>
    coerceList(KINDS[kindKey] as ContentKind<{ id: string; order: number }>, dirs[i].data),
  );
  const workingSlugs = new Set(workingLists.flat().map((w) => w.id));
  // A review row for a slug with no working card is stale (Keystatic delete).
  // Don't let it gate or badge anything; report it so it can be tidied.
  const stale = staleReviewSlugs(review, workingSlugs);
  const ctx = { review: pruneReview(review, workingSlugs), sha256 };
  const instances = KIND_ORDER.map((_, i) => instanceMap(dirs[i].data));

  const groups: PanelGroup[] = KIND_ORDER.map((kindKey, i) => {
    const kind = KINDS[kindKey] as ContentKind<{ id: string; order: number }>;
    const working = workingLists[i];
    const instanceOf = (id: string) => instances[i].get(id) ?? "";
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
      const itemCtx = { ...ctx, instance: instanceOf(item.id) };
      const langStatus = Object.fromEntries(
        LOCALES.map((l) => [l, kind.langStatus(item, l, itemCtx)]),
      ) as Record<ContentLocale, LangReviewStatus>;
      let publishState: ItemPublishState = "not-published";
      if (pub) publishState = stable(pub) === stable(item) ? "in-sync" : "modified";
      return {
        id: item.id,
        title: kind.displayTitle(item),
        subtitle: subtitleFor(kindKey, item as never),
        editHref: editHrefFor(kindKey, item.id, storage.branch),
        langStatus,
        blockers: kind.publishBlockers(item, itemCtx),
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
    staleReviewSlugs: stale,
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
    instances: instanceMap(dir.data),
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
    const { kind, working, workingVersion, instances, review, reviewVersion } = await loadKind(
      storage,
      kindKey,
    );
    if (workingVersion !== expected.working || reviewVersion !== expected.review) {
      return { ok: false, conflict: true, message: new ConflictError("робочі картки").message };
    }
    const item = working.find((w) => w.id === id);
    if (!item) return { ok: false, message: `«${id}» не знайдено.` };
    const cardInstance = instances.get(id) ?? "";
    if (kind.langStatus(item, locale, { review, sha256, instance: cardInstance }) === "empty") {
      return { ok: false, message: `${locale.toUpperCase()}: спершу заповніть обов'язкові поля.` };
    }
    // This is the only action that writes review-state, so it is also the only
    // place that can garbage-collect rows left behind by a Keystatic "Delete
    // entry" (which never touches this file). Best-effort: if the extra reads
    // fail we still write the confirmation, just without the tidy-up.
    let base = review;
    const workingSlugs = await collectWorkingSlugs(storage).catch(() => null);
    if (workingSlugs) {
      workingSlugs.add(id); // the card we just re-read is live by definition
      base = pruneReview(review, workingSlugs);
    }
    // If the row was last confirmed against a DIFFERENT card instance (the slug
    // was deleted and re-created), the sibling locales' hashes belong to a card
    // that no longer exists — start the row fresh so confirming one language
    // never silently revives the others. Same instance -> keep them.
    const prevRow = (base[id]?.instance ?? "") === cardInstance ? base[id] : undefined;
    const next: ReviewState = {
      ...base,
      [id]: {
        ...prevRow,
        instance: cardInstance,
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
    const { kind, working, workingVersion, instances, review, reviewVersion } = await loadKind(
      storage,
      kindKey,
    );
    const publishedF = await storage.readFile(PUBLISHED);
    if (workingVersion !== expected.working || reviewVersion !== expected.review) {
      return { ok: false, conflict: true, message: new ConflictError("контент").message };
    }
    const item = working.find((w) => w.id === id);
    if (!item) return { ok: false, message: `«${id}» не знайдено.` };

    const blockers = kind.publishBlockers(item, { review, sha256, instance: instances.get(id) ?? "" });
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

/**
 * Finish a Keystatic "Delete entry": drop every review-state.json row whose slug
 * no longer backs a working card in ANY kind. Keystatic's delete is a direct
 * commit that never touches review-state, and until now those rows were only
 * swept as a side-effect of the next `confirmLocale` on some other item — this
 * is the on-demand button for it (task 2026-09-09 §4). An orphan still in the
 * published snapshot is removed separately with "Прибрати з сайту".
 *
 * Safety:
 *  - GET never calls this; nothing is removed by opening the page.
 *  - The working set is re-read fresh from every kind here — a read failure
 *    rejects (transient), so "GitHub unreachable" is never mistaken for
 *    "the card is gone". A slug that has re-appeared as a working card (owner
 *    re-created it) is kept, and even if it weren't the row's `instance` no
 *    longer matches the new card so its languages still need review.
 *  - One version-guarded write; idempotent — a second click finds nothing
 *    stale and writes nothing.
 */
export async function completeDeletion(
  storage: PanelStorage,
  expected: { review: string },
): Promise<ActionResult> {
  return runAction("Не вдалося завершити видалення", async () => {
    const workingSlugs = await collectWorkingSlugs(storage);
    const reviewF = await storage.readFile(REVIEW);
    if (reviewF.version !== expected.review) {
      return { ok: false, conflict: true, message: new ConflictError("перевірки перекладів").message };
    }
    const review = parseReview(reviewF.data);
    const stale = staleReviewSlugs(review, workingSlugs);
    if (stale.length === 0) {
      return { ok: true, message: "Незавершених видалень немає — рядки підтверджень уже прибрані." };
    }
    await storage.writeFile(
      REVIEW,
      `${JSON.stringify(pruneReview(review, workingSlugs), null, 2)}\n`,
      expected.review,
    );
    return {
      ok: true,
      message: `Готово — прибрано рядки підтверджень: ${stale.join(", ")}.`,
    };
  });
}
