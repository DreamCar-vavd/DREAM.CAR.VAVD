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
  MediaMissingError,
  PUBLISHED_MEDIA_DIR,
  StorageAuthError,
  StorageBackendError,
  StorageForbiddenError,
  WriteUncertainError,
  type DeployStatus,
  type PanelStorage,
} from "./store/adapter";

export const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");

/** `public/images/cms/<dir>` base per kind; `null` for kinds with no photos. */
const IMAGE_DIR: Record<KindKey, string | null> = {
  car: "cars",
  gallery: "gallery",
  service: "services",
  contact: null,
  promo: "promos",
};

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
 * review-state.json key for a card. Namespaced by kind so `cars/foo` and
 * `services/foo` keep SEPARATE confirmations — confirming one never touches the
 * other. Bare (un-namespaced) keys are legacy: still read as a fallback by the
 * gates, and migrated by scripts/migrate-review-keys.mjs.
 */
export const reviewKeyFor = (kindKey: KindKey, id: string) => `${kindKey}:${id}`;

/**
 * Keystatic's "Delete entry" is a direct GitHub commit that removes the item
 * JSON (and its images) but never `review-state.json`, so deleting a card
 * through the editor leaves its review row behind. Left alone those rows
 * accumulate.
 *
 * A row is stale when NOTHING backs its key: for `kind:slug` — no working card
 * of that kind; for a bare legacy key — no working card of any kind. `liveKeys`
 * holds both forms for every working card. Pure — no I/O.
 */
function staleReviewSlugs(review: ReviewState, liveKeys: ReadonlySet<string>): string[] {
  return Object.keys(review).filter((k) => !liveKeys.has(k));
}
function pruneReview(review: ReviewState, liveKeys: ReadonlySet<string>): ReviewState {
  if (staleReviewSlugs(review, liveKeys).length === 0) return review;
  return Object.fromEntries(
    Object.entries(review).filter(([k]) => liveKeys.has(k)),
  ) as ReviewState;
}

/**
 * Every working card, as BOTH `kind:slug` and bare `slug` — so a namespaced row
 * is live iff its own kind still has the card, while a legacy bare row is live
 * iff any kind does. Best-effort at cleanup call sites (a read failure must not
 * sink the surrounding action).
 */
async function collectWorkingSlugs(storage: PanelStorage): Promise<Set<string>> {
  const dirs = await Promise.all(KIND_ORDER.map((k) => storage.readDir(KINDS[k].dir)));
  const keys = new Set<string>();
  KIND_ORDER.forEach((kindKey, i) => {
    const kind = KINDS[kindKey] as ContentKind<{ id: string; order: number }>;
    for (const w of coerceList(kind, dirs[i].data)) {
      keys.add(w.id);
      keys.add(reviewKeyFor(kindKey, w.id));
    }
  });
  return keys;
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
// published-media freezing
//
// Keystatic edits the WORKING photo files (`…/<slug>/photos/<i>/image.<ext>`) —
// re-ordering renumbers them and a removal deletes one, both as direct commits
// the panel never sees. If published.json still pointed at a working path, the
// NEXT deployment (any commit) would 404 that image even though the material was
// never re-published. So on publish every referenced working image is copied,
// content-addressed, into `…/<slug>/_pub/<hash>.<ext>` — a folder Keystatic does
// not know about — and the snapshot points there instead. The copy lives until
// a later publish of the same slug no longer references it.
// ---------------------------------------------------------------------------

const IMG_EXT_RE = /\.(jpe?g|png|webp)$/i;
const PUB_SEG = `/${PUBLISHED_MEDIA_DIR}/`;

/** Public image URLs a snapshot item points at (photos[] for most kinds; the
 *  single `image` for promos). */
function itemImageUrls(kindKey: KindKey, item: Record<string, unknown>): string[] {
  if (kindKey === "promo") return [String(item.image ?? "")].filter(Boolean);
  const photos = Array.isArray(item.photos) ? (item.photos as Record<string, unknown>[]) : [];
  return photos.map((p) => String(p?.image ?? "")).filter(Boolean);
}
/** A copy of `item` with each image URL swapped per `rewrite` (old -> new). */
function withRewrittenImages(
  kindKey: KindKey,
  item: Record<string, unknown>,
  rewrite: Map<string, string>,
): Record<string, unknown> {
  if (rewrite.size === 0) return item;
  if (kindKey === "promo") {
    const next = rewrite.get(String(item.image ?? ""));
    return next ? { ...item, image: next } : item;
  }
  const photos = Array.isArray(item.photos) ? (item.photos as Record<string, unknown>[]) : [];
  return {
    ...item,
    photos: photos.map((p) => {
      const next = rewrite.get(String(p?.image ?? ""));
      return next ? { ...p, image: next } : p;
    }),
  };
}

const mediaHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex").slice(0, 24);
const frozenRel = (dir: string, slug: string, hash: string, ext: string) =>
  `images/cms/${dir}/${slug}/${PUBLISHED_MEDIA_DIR}/${hash}.${ext}`;

/**
 * Plan the frozen copy of every photo this item references: read each working
 * file, hash it, and return the `_pub/` copies to write plus the item with its
 * URLs rewritten. NOTHING is written here.
 *
 * A card that names a photo whose file is genuinely missing → `MediaMissingError`
 * (publish must abort; the previous published photos stay live). A network /
 * auth / rate-limit failure propagates its own typed error. An OPTIONAL photo
 * that was never filled in never reaches this (empty `image` is dropped by
 * `itemImageUrls`). A URL already under `_pub/`, or one that is not a CMS image
 * path at all, is passed through untouched.
 */
async function planFrozenMedia(
  storage: PanelStorage,
  kindKey: KindKey,
  item: Record<string, unknown>,
): Promise<{ item: Record<string, unknown>; puts: { path: string; bytes: Uint8Array }[] }> {
  const dir = IMAGE_DIR[kindKey];
  if (!dir) return { item, puts: [] };
  const slug = String(item.id ?? "");
  const rewrite = new Map<string, string>();
  const puts: { path: string; bytes: Uint8Array }[] = [];
  for (const url of itemImageUrls(kindKey, item)) {
    if (url.includes(PUB_SEG)) continue; // already frozen
    if (!url.startsWith("/images/cms/") || !IMG_EXT_RE.test(url)) continue; // not our media
    const bytes = await storage.readMedia(`public${url}`); // throws on network/auth/etc.
    if (bytes === null) throw new MediaMissingError(`public${url}`); // named file is gone
    const ext = url.match(IMG_EXT_RE)![1].toLowerCase();
    const rel = frozenRel(dir, slug, mediaHash(bytes), ext);
    puts.push({ path: `public/${rel}`, bytes });
    rewrite.set(url, `/${rel}`);
  }
  return { item: withRewrittenImages(kindKey, item, rewrite), puts };
}

/** Write the planned `_pub/` copies (idempotent — a byte-identical file is skipped). */
async function writeFrozenMedia(
  storage: PanelStorage,
  puts: { path: string; bytes: Uint8Array }[],
): Promise<void> {
  for (const p of puts) await storage.putPublishedMedia(p.path, p.bytes);
}

const FROZEN_HASH_RE = /\/_pub\/([a-f0-9]{8,64})\.\w+$/;

/**
 * Is the published snapshot entry `pub` still in sync with working card `item`,
 * accounting for frozen photos?
 *
 * Non-photo fields, and photo COUNT / ORDER / CAPTIONS, are compared exactly. A
 * photo slot is in sync only when its published image is the ACTUAL current
 * version of the working file: a frozen `_pub/<hash>` matches when
 * `sha256(working bytes)` still equals `<hash>`; a plain path matches only when
 * identical. So replacing photo A with B at the same path, or re-ordering
 * photos, now reads as an unpublished change. A working file that cannot be read
 * (network / missing) also reads as changed — we cannot prove it is the same.
 *
 * Cost: one image read per still-frozen photo slot (parallel), only for items
 * that are otherwise unchanged. The panel is an admin page, not a public route.
 */
async function inSyncIgnoringFrozenPhotos(
  storage: PanelStorage,
  kindKey: KindKey,
  pub: Record<string, unknown>,
  item: Record<string, unknown>,
): Promise<boolean> {
  const stripPhotoUrls = (o: Record<string, unknown>) => {
    if (kindKey === "promo") return { ...o, image: "" };
    const photos = Array.isArray(o.photos) ? (o.photos as Record<string, unknown>[]) : [];
    return { ...o, photos: photos.map((p) => ({ ...p, image: "" })) };
  };
  if (stable(stripPhotoUrls(pub)) !== stable(stripPhotoUrls(item))) return false;

  const pu = itemImageUrls(kindKey, pub);
  const iu = itemImageUrls(kindKey, item);
  if (pu.length !== iu.length) return false;

  const slotChanged = await Promise.all(
    pu.map(async (pubUrl, i): Promise<boolean> => {
      const wantHash = pubUrl.match(FROZEN_HASH_RE)?.[1];
      if (wantHash === undefined) return pubUrl !== iu[i]; // plain path — must match exactly
      if (iu[i].includes(PUB_SEG)) return iu[i].match(FROZEN_HASH_RE)?.[1] !== wantHash;
      if (!iu[i].startsWith("/images/cms/") || !IMG_EXT_RE.test(iu[i])) return true;
      const bytes = await storage.readMedia(`public${iu[i]}`).catch(() => null);
      return !bytes || mediaHash(bytes) !== wantHash;
    }),
  );
  return !slotChanged.some(Boolean);
}

/** Every `_pub/` file path referenced anywhere in `snapshot` (public URLs). */
function referencedFrozenPaths(snapshot: Snapshot): Set<string> {
  const refs = new Set<string>();
  JSON.stringify(snapshot, (_k, v) => {
    if (typeof v === "string" && v.includes(PUB_SEG) && /\/_pub\/[a-f0-9]+\.\w+$/.test(v)) {
      refs.add(v);
    }
    return v;
  });
  return refs;
}
/** `public/images/cms/<dir>/<slug>/_pub` for every (dir, slug) that appears in the snapshot. */
function frozenDirsInSnapshot(snapshot: Snapshot): Set<string> {
  const dirs = new Set<string>();
  for (const ref of referencedFrozenPaths(snapshot)) {
    const m = ref.match(/^\/images\/cms\/([^/]+)\/([^/]+)\/_pub\//);
    if (m) dirs.add(`public/images/cms/${m[1]}/${m[2]}/${PUBLISHED_MEDIA_DIR}`);
  }
  return dirs;
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
  const liveKeys = new Set<string>();
  KIND_ORDER.forEach((kindKey, i) => {
    for (const w of workingLists[i]) {
      liveKeys.add(w.id);
      liveKeys.add(reviewKeyFor(kindKey, w.id));
    }
  });
  // A review row whose key nothing backs is stale (Keystatic delete). Don't let
  // it gate or badge anything; report it so it can be tidied.
  const stale = staleReviewSlugs(review, liveKeys);
  const ctx = { review: pruneReview(review, liveKeys), sha256 };
  const instances = KIND_ORDER.map((_, i) => instanceMap(dirs[i].data));

  const groups: PanelGroup[] = await Promise.all(
    KIND_ORDER.map(async (kindKey, i): Promise<PanelGroup> => {
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

      const rows = await Promise.all(
        working.map(async (item): Promise<PanelRow> => {
          const pub = publishedById.get(item.id);
          const itemCtx = {
            ...ctx,
            instance: instanceOf(item.id),
            reviewKey: reviewKeyFor(kindKey, item.id),
          };
          const langStatus = Object.fromEntries(
            LOCALES.map((l) => [l, kind.langStatus(item, l, itemCtx)]),
          ) as Record<ContentLocale, LangReviewStatus>;
          let publishState: ItemPublishState = "not-published";
          if (pub) {
            publishState = (await inSyncIgnoringFrozenPhotos(
              storage,
              kindKey,
              pub as unknown as Record<string, unknown>,
              item as unknown as Record<string, unknown>,
            ))
              ? "in-sync"
              : "modified";
          }
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
        }),
      );

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
    }),
  );

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
  if (err instanceof MediaMissingError) return { ok: false, message: err.message };
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
    const rkey = reviewKeyFor(kindKey, id);
    if (
      kind.langStatus(item, locale, { review, sha256, instance: cardInstance, reviewKey: rkey }) ===
      "empty"
    ) {
      return { ok: false, message: `${locale.toUpperCase()}: спершу заповніть обов'язкові поля.` };
    }
    // This is the only action that writes review-state, so it is also the only
    // place that can garbage-collect rows left behind by a Keystatic "Delete
    // entry" (which never touches this file). Best-effort: if the extra reads
    // fail we still write the confirmation, just without the tidy-up.
    let base = review;
    const liveKeys = await collectWorkingSlugs(storage).catch(() => null);
    if (liveKeys) {
      liveKeys.add(id).add(rkey); // the card we just re-read is live by definition
      base = pruneReview(review, liveKeys);
    }
    // This row is keyed by kind — start it from the namespaced row, falling back
    // to a legacy bare row once (and dropping that bare row, so `cars/foo` and
    // `services/foo` stop sharing it). If the row was last confirmed against a
    // DIFFERENT card instance (deleted + re-created), drop the sibling locales
    // so confirming one language never silently revives the others.
    const legacyRow = base[id];
    const priorRow = base[rkey] ?? legacyRow;
    const prevRow = (priorRow?.instance ?? "") === cardInstance ? priorRow : undefined;
    const next: ReviewState = { ...base };
    delete next[id]; // consolidate any legacy bare key into the namespaced one
    next[rkey] = {
      ...prevRow,
      instance: cardInstance,
      [locale]: { hash: sha256(kind.confirmedText(item, locale)), at: new Date().toISOString() },
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

    const blockers = kind.publishBlockers(item, {
      review,
      sha256,
      instance: instances.get(id) ?? "",
      reviewKey: reviewKeyFor(kindKey, id),
    });
    if (blockers.length > 0) {
      return { ok: false, message: "Не можна опублікувати — є невирішені пункти.", blockers };
    }

    const snapshot = parseSnapshot(publishedF.data);
    const current = coerceSnapshotList(kind, snapshot[KEY_FOR_KIND[kindKey]]);
    const existing = current.find((p) => p.id === id);
    if (existing && stable(existing) === stable(item)) {
      return { ok: true, message: `«${id}» вже опубліковано в цій версії.` };
    }

    // Plan the frozen copy of every referenced photo (reads + hashes only — no
    // write). A named photo whose file is missing, or a network / auth failure,
    // throws here → the publish aborts and the previous published.json (and its
    // photos) stay exactly as they were.
    const { item: frozenRaw, puts } = await planFrozenMedia(
      storage,
      kindKey,
      item as unknown as Record<string, unknown>,
    );
    const frozen = frozenRaw as typeof item;
    // Re-freezing an unchanged photo set produces the exact same `_pub/` URLs,
    // so re-publishing an item that only DIFFERED by working-vs-frozen photo
    // paths (e.g. straight after the freeze migration) is a clean no-op.
    if (existing && stable(existing) === stable(frozen)) {
      return { ok: true, message: `«${id}» вже опубліковано в цій версії.` };
    }

    const nextList = [...current.filter((p) => p.id !== id), frozen].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
    const nextSnapshot = rebuildSnapshot(snapshot, kindKey, nextList as unknown[]);

    // Close the read→verify→write TOCTOU window: re-read working + review right
    // before committing; abort on any drift (parallel Keystatic save / confirm).
    const recheck = await loadKind(storage, kindKey);
    if (recheck.workingVersion !== expected.working || recheck.reviewVersion !== expected.review) {
      return { ok: false, conflict: true, message: new ConflictError("контент").message };
    }

    // Write the frozen copies, then the snapshot (version-guarded), then write
    // the copies ONCE MORE: if a manual "прибрати старі копії фото" ran in the
    // gap and deleted one, this restores it, and after the snapshot write no
    // cleanup will touch a file the current published.json points at.
    await writeFrozenMedia(storage, puts);
    await storage.writeFile(PUBLISHED, `${JSON.stringify(nextSnapshot, null, 2)}\n`, expected.published);
    await writeFrozenMedia(storage, puts).catch(() => {});
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
    // The slug's `_pub/` copies are now unreferenced, but deleting them here
    // could race a parallel re-publish — the owner sweeps them with
    // "прибрати старі копії фото" (cleanupFrozenMedia).
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
    // A slug that is now neither a working card nor in the published snapshot is
    // gone for good — its `_pub/` copies are unreachable by the normal cleanup
    // (which only scans published + working dirs), so drop them here. Best-effort.
    try {
      const referenced = referencedFrozenPaths(parseSnapshot((await storage.readFile(PUBLISHED)).data));
      for (const key of stale) {
        const [kindKey, ...rest] = key.split(":");
        const slug = rest.join(":");
        const dir = slug && IMAGE_DIR[kindKey as KindKey];
        if (!dir) continue;
        const pubDir = `public/images/cms/${dir}/${slug}/${PUBLISHED_MEDIA_DIR}`;
        for (const name of await storage.listPublishedMedia(pubDir)) {
          if (!referenced.has(`/images/cms/${dir}/${slug}/${PUBLISHED_MEDIA_DIR}/${name}`)) {
            await storage.deletePublishedMedia(`${pubDir}/${name}`);
          }
        }
      }
    } catch {
      /* media sweep is best-effort — the review rows are already pruned */
    }
    return {
      ok: true,
      message: `Готово — прибрано рядки підтверджень: ${stale.join(", ")}.`,
    };
  });
}

/**
 * Freeze EVERY item already in published.json: copy each still-working image it
 * references into the slug's `_pub/` folder and repoint the snapshot there.
 * Idempotent — an item already fully frozen produces byte-identical paths and is
 * skipped. Used by scripts/migrate-freeze-published-photos.mjs to close the gap
 * for items published before this pipeline existed; a no-op afterwards.
 * Returns the number of items whose paths changed.
 */
export async function freezePublishedMedia(storage: PanelStorage): Promise<{ changed: number }> {
  const publishedF = await storage.readFile(PUBLISHED);
  const snapshot = parseSnapshot(publishedF.data);
  const allPuts: { path: string; bytes: Uint8Array }[] = [];
  let changed = 0;
  for (const kindKey of KIND_ORDER) {
    const list = snapshot[KEY_FOR_KIND[kindKey]];
    for (let i = 0; i < list.length; i += 1) {
      const before = stable(list[i]);
      const { item, puts } = await planFrozenMedia(
        storage,
        kindKey,
        list[i] as Record<string, unknown>,
      );
      list[i] = item;
      allPuts.push(...puts);
      if (stable(list[i]) !== before) changed += 1;
    }
  }
  if (changed === 0) return { changed: 0 };
  await writeFrozenMedia(storage, allPuts);
  await storage.writeFile(PUBLISHED, `${JSON.stringify(snapshot, null, 2)}\n`, publishedF.version);
  return { changed };
}

/**
 * Explicit, guarded sweep of `_pub/` copies no longer referenced by the CURRENT
 * published.json — the deferred replacement for the old auto-GC, which could
 * race a parallel re-publish and delete a photo it needed. Version-guarded on
 * published.json: if it moved since the caller loaded the page, abort so we
 * never act on a stale view. Only deletes; never writes published.json.
 */
export async function cleanupFrozenMedia(
  storage: PanelStorage,
  expected: { published: string },
): Promise<ActionResult> {
  return runAction("Не вдалося прибрати старі копії", async () => {
    const publishedF = await storage.readFile(PUBLISHED);
    if ((publishedF.version || "") !== expected.published) {
      return { ok: false, conflict: true, message: new ConflictError("знімок").message };
    }
    const snapshot = parseSnapshot(publishedF.data);
    const referenced = referencedFrozenPaths(snapshot); // full public URLs kept by the live site

    // Every `_pub/` folder we can reach: those the snapshot points into, plus
    // every working card's (a card whose photos were edited down still has old
    // copies). A slug that is neither published nor a working card is invisible
    // here — that residue is swept by re-running the migration script.
    const dirs = new Set(frozenDirsInSnapshot(snapshot));
    const kindDirs = await Promise.all(KIND_ORDER.map((k) => storage.readDir(KINDS[k].dir)));
    KIND_ORDER.forEach((kindKey, i) => {
      const imgDir = IMAGE_DIR[kindKey];
      if (!imgDir) return;
      for (const e of kindDirs[i].data) {
        const slug = e.name.replace(/\.json$/, "");
        dirs.add(`public/images/cms/${imgDir}/${slug}/${PUBLISHED_MEDIA_DIR}`);
      }
    });

    let removed = 0;
    for (const pubDir of dirs) {
      const urlBase = `/${pubDir.replace(/^public\//, "")}`;
      for (const name of await storage.listPublishedMedia(pubDir)) {
        if (!referenced.has(`${urlBase}/${name}`)) {
          await storage.deletePublishedMedia(`${pubDir}/${name}`);
          removed += 1;
        }
      }
    }
    return {
      ok: true,
      message:
        removed === 0 ? "Зайвих копій фото немає." : `Прибрано зайвих копій фото: ${removed}.`,
    };
  });
}
