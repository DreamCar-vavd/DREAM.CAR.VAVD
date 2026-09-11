import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { confirmedText } from "./carsGate";
import { galleryConfirmedText } from "./galleryGate";
import { serviceConfirmedText } from "./serviceGate";
import { promoConfirmedText } from "./promoGate";
import {
  ConflictError,
  StorageAuthError,
  StorageForbiddenError,
  StorageRateLimitedError,
  StorageUnavailableError,
  WriteUncertainError,
  assertAllowedDir,
  assertAllowedFile,
  type AllowedDir,
  type AllowedFile,
  type DeployStatus,
  type DirEntry,
  type PanelStorage,
  type Versioned,
} from "./store/adapter";
import {
  checkActionResult,
  cleanupFrozenMedia,
  completeDeletion,
  confirmLocale,
  getPanelData,
  publishItem,
  unpublishItem,
  type ActionResult,
} from "./panelStore";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

const CAR_L = { title: "T", specLine: "S", description: "", viewGalleryLabel: "" };
const carJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "c1",
    order: 1,
    saleStatus: "for-sale",
    year: "2020",
    price: "£1",
    mileageValue: 1,
    photos: [{ image: "/x.jpg" }],
    video: { mode: "none" },
    uk: CAR_L,
    en: CAR_L,
    ru: CAR_L,
    ...over,
  });

const GAL_L = {
  title: "G",
  shortDescription: "",
  longDescription: "",
  service: "",
  clientRequest: "",
  completedItems: [],
  result: "",
};
const galJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "g1",
    order: 1,
    kind: "album",
    year: "",
    photos: [{ image: "/g.jpg" }],
    uk: GAL_L,
    en: GAL_L,
    ru: GAL_L,
    ...over,
  });

const gitBlobId = (bytes: Uint8Array) =>
  createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
    .update(bytes)
    .digest("hex");

/** In-memory file store with real version bumps + conflict checks. */
class FakeStorage implements PanelStorage {
  readonly mode = "github" as const;
  branch: string | null = null;
  files = new Map<string, string>();
  dirs = new Map<string, DirEntry[]>();
  media = new Map<string, Uint8Array>();
  deploy: DeployStatus = { state: "ready" };
  /** stand-in for the branch HEAD; every write bumps it. */
  head = "head-0";
  /** state as of each PAST head — so a read pinned to an old sha sees old data. */
  private history = new Map<
    string,
    { files: Map<string, string>; dirs: Map<string, DirEntry[]>; media: Map<string, Uint8Array> }
  >();
  /** Snapshot the CURRENT state under the current head, then advance. Call
   *  BEFORE mutating, so `head-N` in history is the state at head-N. */
  private bump() {
    this.history.set(this.head, {
      files: new Map(this.files),
      dirs: new Map([...this.dirs].map(([k, v]) => [k, v.map((e) => ({ ...e }))])),
      media: new Map(this.media),
    });
    this.head = `head-${Number(this.head.slice(5)) + 1}`;
  }
  /** The maps to read from for a given pin (current live state when unpinned or
   *  pinned to a head with no recorded history — e.g. the current head). */
  private viewAt(atSha?: string) {
    const h = atSha ? this.history.get(atSha) : undefined;
    return h ?? { files: this.files, dirs: this.dirs, media: this.media };
  }

  seedDir(dir: AllowedDir, entries: DirEntry[]) {
    this.dirs.set(dir, entries);
  }
  seedFile(file: AllowedFile, text: string) {
    this.files.set(file, text);
  }
  /** Seed a working image (path like "public/images/cms/services/x/photos/0/image.jpg"). */
  seedMedia(repoPath: string, bytes: Uint8Array) {
    this.media.set(repoPath, bytes);
  }

  async headSha() {
    return this.head;
  }
  async mediaIndex(atSha?: string) {
    const out = new Map<string, { id: string; size: number }>();
    for (const [p, b] of this.viewAt(atSha).media) {
      if (p.startsWith("public/images/cms/")) out.set(p, { id: gitBlobId(b), size: b.length });
    }
    return out;
  }
  async readMedia(repoPath: string) {
    return this.media.get(repoPath) ?? null;
  }
  async putPublishedMedia(repoPath: string, bytes: Uint8Array) {
    const cur = this.media.get(repoPath);
    if (cur && gitBlobId(cur) === gitBlobId(bytes)) return; // content-addressed no-op
    this.bump();
    this.media.set(repoPath, bytes);
  }
  async listPublishedMedia(dirPath: string) {
    return [...this.media.keys()]
      .filter((k) => k.startsWith(`${dirPath}/`) && !k.slice(dirPath.length + 1).includes("/"))
      .map((k) => k.slice(dirPath.length + 1))
      .sort();
  }
  async deletePublishedMediaBatch(paths: string[], expectedHeadSha: string | null) {
    if (expectedHeadSha !== null && expectedHeadSha !== this.head) {
      throw new ConflictError("гілка"); // branch moved since the plan
    }
    const willDelete = paths.some((p) => this.media.has(p));
    if (willDelete) this.bump(); // snapshot pre-delete state under the old head
    const out: { path: string; outcome: "deleted" | "already-absent" }[] = [];
    for (const p of paths) {
      const existed = this.media.delete(p);
      out.push({ path: p, outcome: existed ? "deleted" : "already-absent" });
    }
    return out;
  }

  async readDir(dir: AllowedDir, atSha?: string): Promise<Versioned<DirEntry[]>> {
    assertAllowedDir(dir);
    const entries = this.viewAt(atSha).dirs.get(dir) ?? [];
    return {
      data: entries,
      version: entries.length ? hash(entries.map((e) => `${e.name}:${e.text}`).join("\n")) : "",
    };
  }
  async readFile(file: AllowedFile, atSha?: string): Promise<Versioned<string | null>> {
    assertAllowedFile(file);
    const text = this.viewAt(atSha).files.get(file) ?? null;
    return { data: text, version: text ? hash(text) : "" };
  }
  async writeFile(file: AllowedFile, text: string, expected: string): Promise<Versioned<string>> {
    assertAllowedFile(file);
    const cur = this.files.get(file) ?? null;
    if ((cur ? hash(cur) : "") !== expected) throw new ConflictError("файл");
    this.bump();
    this.files.set(file, text);
    return { data: text, version: hash(text) };
  }
  async deployStatus() {
    return this.deploy;
  }
}

const SVC_L = {
  title: "T",
  shortDescription: "S",
  longDescription: "L",
  cardDescription: "",
  bullets: [],
  modalLead: "",
  modalDescription: "",
  modalSections: [],
  priceNote: "",
  seoTitle: "",
  seoDescription: "",
};
const svcJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "s1",
    order: 10,
    status: "available",
    iconSrc: "/images/services/premium-3d/01-car-selection-premium-3d.png",
    priceAmount: "",
    priceCurrency: "£",
    photos: [],
    uk: SVC_L,
    en: SVC_L,
    ru: SVC_L,
    ...over,
  });
const svcReviewAll = {
  s1: {
    uk: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
    en: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
    ru: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
  },
};

function baseStore() {
  const s = new FakeStorage();
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson() }]);
  s.seedDir("src/content/cms/gallery", [{ name: "g1.json", text: galJson() }]);
  return s;
}
const carReviewAll = {
  c1: {
    uk: { hash: sha(confirmedText(CAR_L)), at: "t" },
    en: { hash: sha(confirmedText(CAR_L)), at: "t" },
    ru: { hash: sha(confirmedText(CAR_L)), at: "t" },
  },
};
const galReviewAll = {
  g1: {
    uk: { hash: sha(galleryConfirmedText(GAL_L)), at: "t" },
    en: { hash: sha(galleryConfirmedText(GAL_L)), at: "t" },
    ru: { hash: sha(galleryConfirmedText(GAL_L)), at: "t" },
  },
};

async function versions(s: FakeStorage) {
  const d = await getPanelData(s);
  return d.versions;
}

test("adapter allowlist rejects arbitrary paths", () => {
  assert.throws(() => assertAllowedFile("src/proxy.ts" as never), /allowlist/);
  assert.throws(() => assertAllowedDir("node_modules" as never), /allowlist/);
});

test("confirmLocale writes the review hash, version-guarded", async () => {
  const s = baseStore();
  const v = await versions(s);
  const r = await confirmLocale(s, "car", "c1", "uk", { working: v.car, review: v.review });
  assert.equal(r.ok, true);
  // review-state keys are namespaced by kind (car:c1, not c1).
  assert.ok(JSON.parse(s.files.get("src/content/cms/review-state.json")!)["car:c1"].uk.hash);
});

test("confirmLocale conflicts when the working set moved since page load", async () => {
  const s = baseStore();
  const v = await versions(s);
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ price: "£999" }) }]);
  const r = await confirmLocale(s, "car", "c1", "uk", { working: v.car, review: v.review });
  assert.equal((r as { conflict?: boolean }).conflict, true);
});

test("publishItem is blocked by the gate and never writes", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/cars", [
    { name: "c1.json", text: carJson({ ru: { title: "", specLine: "" } }) },
  ]);
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const v = await versions(s);
  const r = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal(r.ok, false);
  assert.ok((r as { blockers?: unknown[] }).blockers!.length > 0);
  assert.equal(s.files.has("src/content/cms/published.json"), false);
});

test("publishItem re-checks working+review right before the write (TOCTOU) and aborts if they moved", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const v = await versions(s);
  // Wrap readDir so the SECOND read (the pre-write re-check) sees a changed set.
  const realReadDir = s.readDir.bind(s);
  let calls = 0;
  s.readDir = async (dir) => {
    calls += 1;
    if (calls > 1 && dir === "src/content/cms/cars") {
      s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ price: "£777" }) }]);
    }
    return realReadDir(dir);
  };
  const r = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal((r as { conflict?: boolean }).conflict, true);
  assert.equal(s.files.has("src/content/cms/published.json"), false);
});

test("publishItem conflicts (no write) when the snapshot moved between view and publish", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const v = await versions(s);
  s.seedFile("src/content/cms/published.json", JSON.stringify({ publishedAt: "x", cars: [], gallery: [] }));
  const r = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal((r as { conflict?: boolean }).conflict, true);
});

test("publishItem freezes the car into snapshot; a second identical publish is a no-op success", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  let v = await versions(s);
  const r1 = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal(r1.ok, true);
  assert.equal(JSON.parse(s.files.get("src/content/cms/published.json")!).cars.length, 1);
  v = await versions(s);
  const r2 = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal(r2.ok, true);
  assert.match(r2.message, /вже опубліков/);
});

test("publishing a gallery item does not disturb the cars array and vice-versa", async () => {
  const s = baseStore();
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({ ...carReviewAll, ...galReviewAll }),
  );
  let v = await versions(s);
  await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  v = await versions(s);
  await publishItem(s, "gallery", "g1", {
    working: v.gallery,
    review: v.review,
    published: v.published,
  });
  const snap = JSON.parse(s.files.get("src/content/cms/published.json")!);
  assert.deepEqual(snap.cars.map((c: { id: string }) => c.id), ["c1"]);
  assert.deepEqual(snap.gallery.map((g: { id: string }) => g.id), ["g1"]);
});

test("unpublishItem removes from the snapshot, version-guarded", async () => {
  const s = baseStore();
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({ publishedAt: "t", cars: [JSON.parse(carJson())], gallery: [] }),
  );
  const bad = await unpublishItem(s, "car", "c1", { published: "wrong" });
  assert.equal((bad as { conflict?: boolean }).conflict, true);
  const v = await versions(s);
  const ok = await unpublishItem(s, "car", "c1", { published: v.published });
  assert.equal(ok.ok, true);
  assert.equal(JSON.parse(s.files.get("src/content/cms/published.json")!).cars.length, 0);
});

test("getPanelData groups cars + gallery and reports modified vs in-sync + deploy state", async () => {
  const s = baseStore();
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({ publishedAt: "t", cars: [JSON.parse(carJson())], gallery: [] }),
  );
  let d = await getPanelData(s);
  assert.deepEqual(d.groups.map((g) => g.kind), [
    "car",
    "gallery",
    "service",
    "contact",
    "promo",
  ]);
  assert.equal(d.groups[0].rows[0].publishState, "in-sync");
  assert.equal(d.groups[1].rows[0].publishState, "not-published");
  assert.equal(d.deploy.state, "ready");

  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ price: "£999" }) }]);
  d = await getPanelData(s);
  assert.equal(d.groups[0].rows[0].publishState, "modified");
});

// ---------------------------------------------------------------------------
// Services through the shared pipeline
// ---------------------------------------------------------------------------

test("a new service: appears in its group, is gated, then publishes to the snapshot", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcJson() }]);

  // Unreviewed -> shows up but is blocked.
  const d = await getPanelData(s);
  const grp = d.groups.find((g) => g.kind === "service")!;
  assert.equal(grp.rows[0].id, "s1");
  assert.equal(grp.rows[0].editHref, "/keystatic/collection/services/item/s1");
  assert.ok(grp.rows[0].blockers.length > 0);
  assert.equal(grp.createHref, "/keystatic/collection/services/create");

  // In github mode with a working branch, every Keystatic link is branch-scoped
  // so /panel and the editor never diverge onto different branches.
  s.branch = "codex/admin-panel-spike";
  const scoped = await getPanelData(s);
  const sg = scoped.groups.find((g) => g.kind === "service")!;
  assert.equal(scoped.branch, "codex/admin-panel-spike");
  assert.equal(
    sg.rows[0].editHref,
    "/keystatic/branch/codex%2Fadmin-panel-spike/collection/services/item/s1",
  );
  assert.equal(
    sg.createHref,
    "/keystatic/branch/codex%2Fadmin-panel-spike/collection/services/create",
  );

  // Reviewed -> publishes; lands only in services[].
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(svcReviewAll));
  const v = await versions(s);
  const r = await publishItem(s, "service", "s1", {
    working: v.service,
    review: v.review,
    published: v.published,
  });
  assert.equal(r.ok, true);
  const snap = JSON.parse(s.files.get("src/content/cms/published.json")!);
  assert.deepEqual(snap.services.map((x: { id: string }) => x.id), ["s1"]);
  assert.deepEqual(snap.cars, []);
});

test("a bad service slug blocks publish and never writes the snapshot", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/services", [{ name: "Bad_Slug.json", text: svcJson({ id: "Bad_Slug" }) }]);
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      Bad_Slug: {
        uk: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        en: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        ru: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
      },
    }),
  );
  const v = await versions(s);
  const r = await publishItem(s, "service", "Bad_Slug", {
    working: v.service,
    review: v.review,
    published: v.published,
  });
  assert.equal(r.ok, false);
  assert.ok((r as { blockers?: { field?: string }[] }).blockers!.some((b) => b.field === "slug"));
  assert.equal(s.files.has("src/content/cms/published.json"), false);
});

test("changing only a shared service price does not require re-confirming any language", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcJson() }]);
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(svcReviewAll));
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });

  // Editor sets a shared numeric price. No text changed.
  s.seedDir("src/content/cms/services", [
    { name: "s1.json", text: svcJson({ priceAmount: "60", priceCurrency: "£" }) },
  ]);
  const d = await getPanelData(s);
  const row = d.groups.find((g) => g.kind === "service")!.rows[0];
  assert.equal(row.publishState, "modified");
  assert.deepEqual(row.blockers, []); // still publishable — no re-review
  assert.ok(row.langStatus.uk === "reviewed" && row.langStatus.en === "reviewed");

  v = await versions(s);
  const r = await publishItem(s, "service", "s1", {
    working: v.service,
    review: v.review,
    published: v.published,
  });
  assert.equal(r.ok, true);
  assert.equal(
    JSON.parse(s.files.get("src/content/cms/published.json")!).services[0].priceAmount,
    "60",
  );
});

// ---------------------------------------------------------------------------
// Published entries whose working card was deleted (orphan-published rows)
// ---------------------------------------------------------------------------

test("orphan published: working card gone, snapshot entry stays -> a read-only row is shown", async () => {
  const s = baseStore(); // services dir stays empty
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({
      publishedAt: "t",
      cars: [],
      gallery: [],
      services: [JSON.parse(svcJson({ id: "zzz1" }))],
    }),
  );
  const grp = (await getPanelData(s)).groups.find((g) => g.kind === "service")!;
  assert.equal(grp.rows.length, 1);
  const row = grp.rows[0];
  assert.equal(row.id, "zzz1");
  assert.equal(row.workingExists, false);
  assert.equal(row.publishedExists, true);
  assert.equal(row.publishState, "orphan-published");
  assert.equal(row.editHref, null); // nothing to edit
  assert.deepEqual(row.blockers, []); // no publish/confirm affordance implied
});

test("a deleted-but-published card shows BOTH an orphan row and a stale review slug (so /panel can point at each leftover)", async () => {
  const s = baseStore(); // services dir empty
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({
      publishedAt: "t",
      cars: [],
      gallery: [],
      services: [JSON.parse(svcJson({ id: "zzz-gone" }))],
    }),
  );
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({ "zzz-gone": { uk: { hash: "x", at: "t" } } }),
  );
  const d = await getPanelData(s);
  assert.deepEqual(d.staleReviewSlugs, ["zzz-gone"]);
  const row = d.groups.find((g) => g.kind === "service")!.rows.find((r) => r.id === "zzz-gone")!;
  assert.equal(row.publishState, "orphan-published");
});

test("working card + published entry for the same id -> one row, not a duplicate orphan", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcJson() }]);
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({ publishedAt: "t", cars: [], gallery: [], services: [JSON.parse(svcJson())] }),
  );
  const grp = (await getPanelData(s)).groups.find((g) => g.kind === "service")!;
  assert.equal(grp.rows.length, 1);
  assert.equal(grp.rows[0].workingExists, true);
});

test("unpublishing an orphan removes exactly that snapshot entry and leaves the rest", async () => {
  const s = baseStore();
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({
      publishedAt: "t",
      cars: [],
      gallery: [],
      services: [JSON.parse(svcJson({ id: "keep" })), JSON.parse(svcJson({ id: "gone" }))],
    }),
  );
  const v = await versions(s);

  const stale = await unpublishItem(s, "service", "gone", { published: "stale-token" });
  assert.equal((stale as { conflict?: boolean }).conflict, true); // version-guarded

  const r = await unpublishItem(s, "service", "gone", { published: v.published });
  assert.equal(r.ok, true);
  const snap = JSON.parse(s.files.get("src/content/cms/published.json")!);
  assert.deepEqual(
    snap.services.map((x: { id: string }) => x.id),
    ["keep"],
  );
  // The other kinds' arrays are untouched.
  assert.deepEqual(snap.cars, []);
});

// ---------------------------------------------------------------------------
// Published-media freezing on publish (task §5–6)
// ---------------------------------------------------------------------------

const jpgBytes = (marker: string) =>
  new Uint8Array([0xff, 0xd8, 0xff, ...Buffer.from(`fake-jpeg:${marker}`), 0xff, 0xd9]);

/** Run the two-phase cleanup: dry run, then confirm against its reported head. */
async function cleanup(s: FakeStorage): Promise<ActionResult> {
  const dry = await cleanupFrozenMedia(s, {});
  if (!dry.ok || !dry.cleanup) return dry; // nothing to do
  return cleanupFrozenMedia(s, { confirm: true, headSha: dry.cleanup.headSha });
}
const svcWithPhoto = (over: Record<string, unknown> = {}) =>
  svcJson({
    photos: [{ image: "/images/cms/services/s1/photos/0/image.jpg", caption: "" }],
    ...over,
  });

function photoStore() {
  const s = baseStore();
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto() }]);
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(svcReviewAll));
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("A"));
  return s;
}
const snap = (s: FakeStorage) => JSON.parse(s.files.get("src/content/cms/published.json")!);
const svcPhotoUrls = (s: FakeStorage) =>
  snap(s).services[0].photos.map((p: { image: string }) => p.image);

test("publish copies working photos into the slug's content-addressed _pub/ folder", async () => {
  const s = photoStore();
  const v = await versions(s);
  const r = await publishItem(s, "service", "s1", {
    working: v.service,
    review: v.review,
    published: v.published,
  });
  assert.equal(r.ok, true, r.message);
  const [url] = svcPhotoUrls(s);
  assert.match(url, /^\/images\/cms\/services\/s1\/_pub\/[a-f0-9]{24}\.jpg$/);
  assert.ok(s.media.has(`public${url}`)); // the frozen copy exists
  assert.ok(s.media.has("public/images/cms/services/s1/photos/0/image.jpg")); // working file untouched
});

test("after publishing, the dashboard reads 'in-sync' — a frozen _pub/ path is not a phantom change", async () => {
  const s = photoStore();
  const v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const grp = (await getPanelData(s)).groups.find((g) => g.kind === "service")!;
  assert.equal(grp.rows[0].publishState, "in-sync"); // NOT "modified"
});

test("editing text on an already-frozen item still shows 'modified'", async () => {
  const s = photoStore();
  const v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  s.seedDir("src/content/cms/services", [
    { name: "s1.json", text: svcWithPhoto({ uk: { ...SVC_L, title: "changed" } }) },
  ]);
  const grp = (await getPanelData(s)).groups.find((g) => g.kind === "service")!;
  assert.equal(grp.rows[0].publishState, "modified");
});

test("adding a photo to an already-frozen item shows 'modified'", async () => {
  const s = photoStore();
  const v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  s.seedDir("src/content/cms/services", [
    {
      name: "s1.json",
      text: svcJson({
        photos: [
          { image: "/images/cms/services/s1/photos/0/image.jpg", caption: "" },
          { image: "/images/cms/services/s1/photos/1/image.jpg", caption: "" },
        ],
      }),
    },
  ]);
  const grp = (await getPanelData(s)).groups.find((g) => g.kind === "service")!;
  assert.equal(grp.rows[0].publishState, "modified");
});

test("re-ordering two photos (Keystatic renumbers the files) reads as 'modified'", async () => {
  const s = photoStore();
  s.seedDir("src/content/cms/services", [
    {
      name: "s1.json",
      text: svcJson({
        photos: [
          { image: "/images/cms/services/s1/photos/0/image.jpg", caption: "" },
          { image: "/images/cms/services/s1/photos/1/image.jpg", caption: "" },
        ],
      }),
    },
  ]);
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("A"));
  s.seedMedia("public/images/cms/services/s1/photos/1/image.jpg", jpgBytes("B"));
  const v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  assert.equal(
    (await getPanelData(s)).groups.find((g) => g.kind === "service")!.rows[0].publishState,
    "in-sync",
  );
  // Keystatic swap: same two paths, bytes at each slot exchanged.
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
  s.seedMedia("public/images/cms/services/s1/photos/1/image.jpg", jpgBytes("A"));
  assert.equal(
    (await getPanelData(s)).groups.find((g) => g.kind === "service")!.rows[0].publishState,
    "modified",
  );
});

// ---------------------------------------------------------------------------
// Two collections, same slug — SEPARATE confirmations (task §3)
// ---------------------------------------------------------------------------

test("cars/foo and services/foo keep separate confirmations — confirming one never clears the other", async () => {
  const s = new FakeStorage();
  s.seedDir("src/content/cms/cars", [{ name: "foo.json", text: carJson({ id: "foo", bornAt: "car-foo" }) }]);
  s.seedDir("src/content/cms/services", [
    { name: "foo.json", text: svcJson({ id: "foo", bornAt: "svc-foo" }) },
  ]);

  // Confirm all three languages of the SERVICE foo.
  for (const l of ["uk", "en", "ru"] as const) {
    const v = await versions(s);
    const r = await confirmLocale(s, "service", "foo", l, { working: v.service, review: v.review });
    assert.equal(r.ok, true, r.message);
  }
  let d = await getPanelData(s);
  const svcRow = () => d.groups.find((g) => g.kind === "service")!.rows[0];
  const carRow = () => d.groups.find((g) => g.kind === "car")!.rows[0];
  assert.equal(svcRow().langStatus.uk, "reviewed");
  assert.equal(carRow().langStatus.uk, "needs-review"); // the car was never confirmed

  // Now confirm the CAR foo's uk — the service's confirmations must survive.
  const v = await versions(s);
  const r = await confirmLocale(s, "car", "foo", "uk", { working: v.car, review: v.review });
  assert.equal(r.ok, true, r.message);
  d = await getPanelData(s);
  assert.equal(carRow().langStatus.uk, "reviewed");
  assert.equal(svcRow().langStatus.uk, "reviewed"); // untouched
  assert.equal(svcRow().langStatus.en, "reviewed");

  const review = JSON.parse(s.files.get("src/content/cms/review-state.json")!);
  assert.ok(review["service:foo"].uk.hash && review["service:foo"].en.hash);
  assert.ok(review["car:foo"].uk.hash);
  assert.equal(review["car:foo"].instance, "car-foo");
  assert.equal(review["service:foo"].instance, "svc-foo");
});

test("a legacy bare review key is honoured until the card is re-confirmed", async () => {
  const s = new FakeStorage();
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcJson() }]);
  // Pre-namespace row, keyed by the bare slug.
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      s1: {
        uk: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        en: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        ru: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
      },
    }),
  );
  const d = await getPanelData(s);
  assert.equal(d.groups.find((g) => g.kind === "service")!.rows[0].langStatus.uk, "reviewed");

  // Re-confirming uk migrates the row to `service:s1` and drops the bare key.
  const v = await versions(s);
  await confirmLocale(s, "service", "s1", "uk", { working: v.service, review: v.review });
  const review = JSON.parse(s.files.get("src/content/cms/review-state.json")!);
  assert.equal(review["s1"], undefined);
  assert.ok(review["service:s1"].uk.hash && review["service:s1"].en.hash); // en/ru carried over
});

test("a draft photo edit after publishing does NOT change the published image", async () => {
  const s = photoStore();
  const v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const publishedUrl = svcPhotoUrls(s)[0];
  const publishedBytes = s.media.get(`public${publishedUrl}`)!;

  // Owner edits the photo in Keystatic (new bytes at the same working path) but
  // does NOT re-publish.
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));

  // The published snapshot still points at the frozen A copy, and its bytes are
  // unchanged — a new deployment would serve exactly what was published.
  assert.equal(svcPhotoUrls(s)[0], publishedUrl);
  assert.deepEqual([...s.media.get(`public${publishedUrl}`)!], [...publishedBytes]);
});

test("replacing a photo with new bytes reads as 'modified', re-publishes, and the old copy stays until cleanup", async () => {
  const s = photoStore();
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const oldUrl = svcPhotoUrls(s)[0];
  assert.equal((await getPanelData(s)).groups.find((g) => g.kind === "service")!.rows[0].publishState, "in-sync");

  // Same path, same caption, same count — only the BYTES change.
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
  assert.equal(
    (await getPanelData(s)).groups.find((g) => g.kind === "service")!.rows[0].publishState,
    "modified", // content comparison catches the swap
  );

  v = await versions(s);
  const r = await publishItem(s, "service", "s1", {
    working: v.service,
    review: v.review,
    published: v.published,
  });
  assert.equal(r.ok, true, r.message);
  const newUrl = svcPhotoUrls(s)[0];
  assert.notEqual(newUrl, oldUrl);
  assert.ok(s.media.has(`public${newUrl}`));
  assert.ok(s.media.has(`public${oldUrl}`)); // deferred — NOT auto-deleted by publish

  // The explicit sweep removes the now-unreferenced old copy, keeps the new one.
  const c = await cleanup(s);
  assert.equal(c.ok, true, c.message);
  assert.equal(s.media.has(`public${oldUrl}`), false);
  assert.ok(s.media.has(`public${newUrl}`));
});

test("re-publishing an unchanged photo set is a no-op — no churn", async () => {
  const s = photoStore();
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const url = svcPhotoUrls(s)[0];
  v = await versions(s);
  const r = await publishItem(s, "service", "s1", {
    working: v.service,
    review: v.review,
    published: v.published,
  });
  assert.equal(r.ok, true);
  assert.match(r.message, /вже опубліков/);
  assert.equal(svcPhotoUrls(s)[0], url);
});

test("a card that names a photo whose file is missing does NOT publish — the previous published state is kept", async () => {
  const s = photoStore();
  // First publish A so there is a previous published state to protect.
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const publishedBefore = s.files.get("src/content/cms/published.json")!;
  const frozenUrl = svcPhotoUrls(s)[0];

  // Keystatic removed the working file but the card still lists it; owner edits
  // text and re-publishes.
  s.media.delete("public/images/cms/services/s1/photos/0/image.jpg");
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "1" }) }]);
  v = await versions(s);
  const r = await publishItem(s, "service", "s1", {
    working: v.service,
    review: v.review,
    published: v.published,
  });
  assert.equal(r.ok, false);
  assert.match(r.message, /фото|Фото/);
  assert.notEqual((r as { transient?: boolean }).transient, true); // retrying won't fix it
  // published.json untouched; the previous frozen photo still there.
  assert.equal(s.files.get("src/content/cms/published.json"), publishedBefore);
  assert.ok(s.media.has(`public${frozenUrl}`));
});

for (const [name, err, expectTransient] of [
  ["a network error", new StorageUnavailableError("тест"), true],
  ["a permission refusal", new StorageForbiddenError("тест"), false],
] as const) {
  test(`publish aborts (no snapshot write) on ${name} while freezing a photo`, async () => {
    const s = photoStore();
    let v = await versions(s);
    await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
    const publishedBefore = s.files.get("src/content/cms/published.json")!;

    s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "1" }) }]);
    s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
    s.readMedia = async () => {
      throw err;
    };
    v = await versions(s);
    const r = await publishItem(s, "service", "s1", {
      working: v.service,
      review: v.review,
      published: v.published,
    });
    assert.equal(r.ok, false);
    assert.equal((r as { transient?: boolean }).transient === true, expectTransient);
    assert.equal(s.files.get("src/content/cms/published.json"), publishedBefore);
  });
}

test("unpublishing a slug leaves its _pub copies for the explicit cleanup (no publish-time race)", async () => {
  const s = photoStore();
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const url = svcPhotoUrls(s)[0];
  assert.ok(s.media.has(`public${url}`));

  v = await versions(s);
  const r = await unpublishItem(s, "service", "s1", { published: v.published });
  assert.equal(r.ok, true, r.message);
  assert.ok(s.media.has(`public${url}`)); // still there — deferred

  const c = await cleanup(s);
  assert.equal(c.ok, true, c.message);
  assert.equal(s.media.has(`public${url}`), false); // swept — nothing references it
});

// Task 2026-09-09 §1 — the controlled cleanup↔publish sequence:
//   A. cleanup dry-run reads published.json (photo A published; a stale _pub copy exists)
//      and records the branch head it was computed against.
//   B. cleanup pauses (we hold its dry result).
//   C. an INDEPENDENT request fully re-publishes the item — writeFile(published.json)
//      then writeFrozenMedia — so the branch head advances.
//   D. the old cleanup resumes and confirms against its OLD head.
// Expected: the confirm is rejected (head moved); the just-published photo is intact.
test("§1 cleanup confirmed against a stale branch head deletes nothing; the fresh publish is intact", async () => {
  const s = photoStore();
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });

  // Replace the photo and publish B so a stale _pub/<A> copy now exists.
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "1" }) }]);
  v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const urlB = svcPhotoUrls(s)[0];

  // A. dry run — plans to remove the stale _pub/<A>, pinned to the current head.
  const dry = await cleanupFrozenMedia(s, {});
  assert.equal(dry.ok, true);
  assert.ok(dry.cleanup && dry.cleanup.count >= 1);
  const staleHead = dry.cleanup!.headSha;

  // C. an independent request fully publishes C — head advances.
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("C"));
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "2" }) }]);
  v = await versions(s);
  const rc = await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  assert.equal(rc.ok, true, rc.message);
  const urlC = svcPhotoUrls(s)[0];
  assert.notEqual(urlC, urlB);

  // D. the stale cleanup resumes and confirms against the OLD head.
  const late = await cleanupFrozenMedia(s, { confirm: true, headSha: staleHead });
  assert.equal((late as { conflict?: boolean }).conflict, true);

  // The freshly published photo is untouched and still resolvable.
  assert.ok(s.media.has(`public${urlC}`));
  assert.equal(svcPhotoUrls(s)[0], urlC);
});

test("cleanupFrozenMedia confirm is a conflict (deletes nothing) when the branch head moved", async () => {
  const s = photoStore();
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "1" }) }]);
  v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const url = svcPhotoUrls(s)[0];

  const c = await cleanupFrozenMedia(s, { confirm: true, headSha: "head-does-not-match" });
  assert.equal((c as { conflict?: boolean }).conflict, true);
  assert.ok(s.media.has(`public${url}`)); // untouched
});

test("§1 cleanup reads its plan from ONE pinned commit — a publish mid-read cannot strand the current photo", async () => {
  const s = photoStore();
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  // Replace A -> B and publish B, so a stale _pub/<A> now exists.
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "1" }) }]);
  v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const urlB = svcPhotoUrls(s)[0];

  // Between cleanup's headSha() and its pinned reads, an INDEPENDENT request
  // fully publishes C (writeFrozenMedia + published.json) — head advances.
  const realIndex = s.mediaIndex.bind(s);
  let fired = false;
  s.mediaIndex = async (atSha?: string) => {
    if (!fired) {
      fired = true;
      s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("C"));
      s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "2" }) }]);
      const vv = await versions(s);
      const rc = await publishItem(s, "service", "s1", { working: vv.service, review: vv.review, published: vv.published });
      assert.equal(rc.ok, true, rc.message);
    }
    return realIndex(atSha);
  };
  const urlC0 = svcPhotoUrls(s)[0];

  let batchPaths: string[] | null = null;
  const realBatch = s.deletePublishedMediaBatch.bind(s);
  s.deletePublishedMediaBatch = async (paths, sha) => {
    batchPaths = paths;
    return realBatch(paths, sha);
  };

  const c = await cleanupFrozenMedia(s, { confirm: true, headSha: await s.headSha() });
  // The plan was built entirely from the pinned commit, so it NEVER lists the
  // photo the (newer) published version needs...
  if (batchPaths) assert.ok(!(batchPaths as string[]).some((p) => p === `public${svcPhotoUrls(s)[0]}`));
  // ...and the branch-guarded batch refuses because head moved.
  assert.equal((c as { conflict?: boolean }).conflict, true);
  // The freshly published photo is intact.
  assert.ok(s.media.has(`public${svcPhotoUrls(s)[0]}`));
  assert.notEqual(svcPhotoUrls(s)[0], urlB);
  void urlC0;
});

test("§1 completeDeletion media sweep is a fresh pinned snapshot — a concurrent publish is never clobbered", async () => {
  const s = photoStore();
  // Publish s1, then a second service s2 that we will delete.
  s.seedDir("src/content/cms/services", [
    { name: "s1.json", text: svcWithPhoto() },
    { name: "s2.json", text: svcJson({ id: "s2", photos: [{ image: "/images/cms/services/s2/photos/0/image.jpg", caption: "" }] }) },
  ]);
  s.seedMedia("public/images/cms/services/s2/photos/0/image.jpg", jpgBytes("S2"));
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      ...svcReviewAll,
      "service:s2": {
        uk: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        en: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        ru: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
      },
    }),
  );
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  v = await versions(s);
  await publishItem(s, "service", "s2", { working: v.service, review: v.review, published: v.published });

  // Keystatic deletes s2 (working card + its published entry gone).
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto() }]);
  v = await versions(s);
  await unpublishItem(s, "service", "s2", { published: v.published });
  const s1Url = svcPhotoUrls(s)[0];

  // Right after completeDeletion writes review-state, a concurrent request
  // re-publishes s1 with a new photo — head moves again before the media sweep.
  const realIndex = s.mediaIndex.bind(s);
  let fired = false;
  s.mediaIndex = async (atSha?: string) => {
    if (!fired) {
      fired = true;
      s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("S1v2"));
      s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "9" }) }]);
      const vv = await versions(s);
      await publishItem(s, "service", "s1", { working: vv.service, review: vv.review, published: vv.published });
    }
    return realIndex(atSha);
  };

  v = await versions(s);
  const r = await completeDeletion(s, { review: v.review });
  assert.equal(r.ok, true, r.message);
  // review rows pruned regardless...
  assert.ok(!("service:s2" in JSON.parse(s.files.get("src/content/cms/review-state.json")!)));
  // ...and s1's freshly published photo is untouched (the sweep either used a
  // consistent snapshot or backed off on the version conflict).
  assert.ok(s.media.has(`public${svcPhotoUrls(s)[0]}`));
  void s1Url;
});

test("§2 github-mode: a confirm with NO headSha does not bypass the version check", async () => {
  const s = photoStore(); // FakeStorage.mode === "github"
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "1" }) }]);
  v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const staleUrl = [...s.media.keys()].find(
    (k) => k.includes("/_pub/") && !svcPhotoUrls(s).some((u: string) => `public${u}` === k),
  )!;

  const c = await cleanupFrozenMedia(s, { confirm: true }); // no headSha at all
  assert.equal((c as { conflict?: boolean }).conflict, true);
  assert.ok(s.media.has(staleUrl)); // nothing deleted
});

test("§4 cleanup surfaces a delete-batch failure as transient — never a false 'прибрано N'", async () => {
  const s = photoStore();
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "1" }) }]);
  v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const staleUrl = /* _pub/<A> */ [...s.media.keys()].find((k) => k.includes("/_pub/") && !svcPhotoUrls(s).some((u: string) => `public${u}` === k))!;

  s.deletePublishedMediaBatch = async () => {
    throw new StorageUnavailableError("GitHub недоступний");
  };
  const dry = await cleanupFrozenMedia(s, {});
  assert.ok(dry.ok && dry.cleanup);
  const c = await cleanupFrozenMedia(s, { confirm: true, headSha: dry.cleanup!.headSha });
  assert.equal(c.ok, false);
  assert.equal((c as { transient?: boolean }).transient, true);
  assert.doesNotMatch(c.message, /[Пп]рибрано \d/);
  assert.ok(s.media.has(staleUrl)); // nothing deleted
});

test("§4 cleanup reports the candidate count and size before deleting anything (dry run)", async () => {
  const s = photoStore();
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcWithPhoto({ priceAmount: "1" }) }]);
  v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });

  const dry = await cleanupFrozenMedia(s, {});
  assert.ok(dry.ok && dry.cleanup);
  assert.equal(dry.cleanup!.count, 1);
  assert.ok(dry.cleanup!.totalBytes > 0);
  assert.match(dry.message, /\d+.*(КБ|МБ)/); // count + human size shown
  // Dry run deleted nothing.
  assert.equal([...s.media.keys()].filter((k) => k.includes("/_pub/")).length, 2);
});

test("§4 getPanelData does NOT fall back to 'in-sync' when the media index read fails", async () => {
  const s = photoStore();
  const v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  // A byte change that a working index WOULD flag as 'modified'.
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", jpgBytes("B"));
  s.mediaIndex = async () => {
    throw new StorageUnavailableError("дерево медіафайлів");
  };
  await assert.rejects(() => getPanelData(s), /недоступн|дерев|GitHub/i);
});

test("§4 a photo over 1 MB freezes byte-identically, reads back 'in-sync', and a byte change is caught", async () => {
  const big = (marker: number) => {
    const b = new Uint8Array(1_400_000);
    b[0] = 0xff;
    b[1] = 0xd8;
    b[2] = 0xff;
    b.fill(marker, 3, b.length - 2);
    b[b.length - 2] = 0xff;
    b[b.length - 1] = 0xd9;
    return b;
  };
  const s = photoStore();
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", big(0x41));
  const v = await versions(s);
  const r = await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  assert.equal(r.ok, true, r.message);
  const frozen = svcPhotoUrls(s)[0];
  assert.deepEqual([...s.media.get(`public${frozen}`)!], [...big(0x41)]); // full bytes, not truncated
  assert.equal(
    (await getPanelData(s)).groups.find((g) => g.kind === "service")!.rows[0].publishState,
    "in-sync",
  );
  // Same path, new >1 MB bytes -> modified.
  s.seedMedia("public/images/cms/services/s1/photos/0/image.jpg", big(0x42));
  assert.equal(
    (await getPanelData(s)).groups.find((g) => g.kind === "service")!.rows[0].publishState,
    "modified",
  );
});

// ---------------------------------------------------------------------------
// Car video poster (task 2026-09-10 §4) — a published image like any photo
// ---------------------------------------------------------------------------

const carWithPoster = (over: Record<string, unknown> = {}) =>
  carJson({
    id: "c1",
    photos: [{ image: "/images/cms/cars/c1/photos/0/image.jpg", caption: "" }],
    video: { mode: "legacy-file", src: "/images/cms/cars/c1/video/x.mp4", posterSrc: "/images/cms/cars/c1/photos/1/image.jpg" },
    ...over,
  });

function carPosterStore() {
  const s = baseStore();
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carWithPoster() }]);
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  s.seedMedia("public/images/cms/cars/c1/photos/0/image.jpg", jpgBytes("photo0"));
  s.seedMedia("public/images/cms/cars/c1/photos/1/image.jpg", jpgBytes("poster"));
  return s;
}
const carSnap = (s: FakeStorage) => JSON.parse(s.files.get("src/content/cms/published.json")!).cars[0];
const carRow = async (s: FakeStorage) =>
  (await getPanelData(s)).groups.find((g) => g.kind === "car")!.rows[0].publishState;

test("§4 poster: publish freezes the car video poster into _pub/ (a new frozen path appears)", async () => {
  const s = carPosterStore();
  const v = await versions(s);
  const r = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal(r.ok, true, r.message);
  const poster = carSnap(s).video.posterSrc;
  assert.match(poster, /^\/images\/cms\/cars\/c1\/_pub\/[a-f0-9]{24}\.jpg$/);
  assert.ok(s.media.has(`public${poster}`));
  assert.ok(s.media.has("public/images/cms/cars/c1/photos/1/image.jpg")); // working file kept
  assert.equal(await carRow(s), "in-sync"); // no phantom change
});

test("§4 poster: replacing the poster in a draft reads as 'modified'", async () => {
  const s = carPosterStore();
  const v = await versions(s);
  await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal(await carRow(s), "in-sync");
  // Same path, new bytes (Keystatic re-upload).
  s.seedMedia("public/images/cms/cars/c1/photos/1/image.jpg", jpgBytes("poster-v2"));
  assert.equal(await carRow(s), "modified");
});

test("§4 poster: a draft poster edit does NOT change the published poster until re-publish", async () => {
  const s = carPosterStore();
  let v = await versions(s);
  await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  const publishedPoster = carSnap(s).video.posterSrc;
  const frozenBytes = [...s.media.get(`public${publishedPoster}`)!];

  s.seedMedia("public/images/cms/cars/c1/photos/1/image.jpg", jpgBytes("poster-v2"));
  // The published snapshot still points at the OLD frozen copy, bytes intact.
  assert.equal(carSnap(s).video.posterSrc, publishedPoster);
  assert.deepEqual([...s.media.get(`public${publishedPoster}`)!], frozenBytes);

  // Re-publish: the new poster is frozen and the snapshot moves to it.
  v = await versions(s);
  const r = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal(r.ok, true, r.message);
  assert.notEqual(carSnap(s).video.posterSrc, publishedPoster);
});

test("§4 poster: a poster naming a missing file blocks publish; the previous published poster stays", async () => {
  const s = carPosterStore();
  let v = await versions(s);
  await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  const publishedBefore = s.files.get("src/content/cms/published.json")!;

  s.media.delete("public/images/cms/cars/c1/photos/1/image.jpg"); // poster file gone
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carWithPoster({ price: "£2" }) }]);
  v = await versions(s);
  const r = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal(r.ok, false);
  assert.match(r.message, /фото|Фото/);
  assert.notEqual((r as { transient?: boolean }).transient, true);
  assert.equal(s.files.get("src/content/cms/published.json"), publishedBefore);
});

test("§4 poster: an empty optional poster is fine — no error, nothing frozen for it", async () => {
  const s = carPosterStore();
  s.seedDir("src/content/cms/cars", [
    { name: "c1.json", text: carWithPoster({ video: { mode: "none", src: "", posterSrc: "" } }) },
  ]);
  const v = await versions(s);
  const r = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal(r.ok, true, r.message);
  assert.equal(carSnap(s).video.posterSrc, "");
  // Only the one photo got a frozen copy.
  assert.equal([...s.media.keys()].filter((k) => k.includes("/_pub/")).length, 1);
});

test("§4 poster: the frozen poster is protected from cleanup (still referenced)", async () => {
  const s = carPosterStore();
  const v = await versions(s);
  await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  const poster = carSnap(s).video.posterSrc;
  const c = await cleanupFrozenMedia(s, {}); // dry run
  assert.equal(c.ok, true);
  assert.equal((c as { cleanup?: unknown }).cleanup, undefined); // nothing to remove
  assert.ok(s.media.has(`public${poster}`));
});

test("§4 poster: a poster pointing at photo 0 shares one frozen copy (no double freeze)", async () => {
  const s = carPosterStore();
  s.seedDir("src/content/cms/cars", [
    {
      name: "c1.json",
      text: carWithPoster({
        video: { mode: "legacy-file", src: "/images/cms/cars/c1/video/x.mp4", posterSrc: "/images/cms/cars/c1/photos/0/image.jpg" },
      }),
    },
  ]);
  const v = await versions(s);
  await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  const car = carSnap(s);
  assert.equal(car.photos[0].image, car.video.posterSrc); // same frozen path
  assert.equal([...s.media.keys()].filter((k) => k.includes("/_pub/")).length, 1);
});

test("publishing one slug never touches another slug's frozen _pub folder", async () => {
  const s = photoStore();
  // s1 already published with a frozen photo.
  let v = await versions(s);
  await publishItem(s, "service", "s1", { working: v.service, review: v.review, published: v.published });
  const s1Url = svcPhotoUrls(s)[0];

  // A second service s2 with its own photo.
  s.seedDir("src/content/cms/services", [
    { name: "s1.json", text: svcWithPhoto() },
    {
      name: "s2.json",
      text: svcJson({ id: "s2", photos: [{ image: "/images/cms/services/s2/photos/0/image.jpg", caption: "" }] }),
    },
  ]);
  s.seedMedia("public/images/cms/services/s2/photos/0/image.jpg", jpgBytes("S2"));
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      ...svcReviewAll,
      s2: {
        uk: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        en: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        ru: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
      },
    }),
  );
  v = await versions(s);
  await publishItem(s, "service", "s2", { working: v.service, review: v.review, published: v.published });
  assert.ok(s.media.has(`public${s1Url}`)); // s1's frozen photo survived
});

test("adapter rejects a media write outside a _pub folder / with traversal", async () => {
  const { assertPublishedMediaPath, assertReadableMediaPath } = await import("./store/adapter");
  assert.throws(
    () => assertPublishedMediaPath("public/images/cms/services/s1/photos/0/image.jpg"),
    /published-media/,
  );
  assert.throws(
    () => assertPublishedMediaPath("public/images/cms/services/s1/_pub/../../evil.jpg"),
    /published-media/,
  );
  assert.throws(() => assertReadableMediaPath("public/proxy.ts"), /media path/);
  assert.doesNotThrow(() =>
    assertPublishedMediaPath("public/images/cms/gallery/x/_pub/abcdef01.webp"),
  );
});

// ---------------------------------------------------------------------------
// Stale review-state rows left by a Keystatic "Delete entry" (П36)
// ---------------------------------------------------------------------------

test("a review-state row with no working card does not gate or badge the dashboard, and is reported", async () => {
  const s = baseStore(); // working cars: c1
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      ...carReviewAll, // c1 — real, keep
      "ghost-service": {
        uk: { hash: "dead", at: "t" },
        en: { hash: "dead", at: "t" },
        ru: { hash: "dead", at: "t" },
      },
    }),
  );
  const d = await getPanelData(s);
  assert.deepEqual(d.staleReviewSlugs, ["ghost-service"]);
  // c1's genuine row is untouched.
  assert.equal(d.groups[0].rows[0].langStatus.uk, "reviewed");
});

test("confirmLocale garbage-collects stale review-state rows in its single write", async () => {
  const s = baseStore();
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      "ghost-service": { uk: { hash: "dead", at: "t" } },
    }),
  );
  const v = await versions(s);
  const r = await confirmLocale(s, "car", "c1", "uk", { working: v.car, review: v.review });
  assert.equal(r.ok, true, r.message);
  const review = JSON.parse(s.files.get("src/content/cms/review-state.json")!);
  assert.equal(review["ghost-service"], undefined); // pruned
  assert.ok(review["car:c1"].uk.hash); // the confirmation still landed
});

test("a re-created slug does not inherit the deleted card's review status", async () => {
  const s = baseStore(); // cars: c1, gallery: g1
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({ ...carReviewAll, ...galReviewAll }),
  );

  // c1 is deleted straight from Keystatic — card gone, review row stays behind.
  s.seedDir("src/content/cms/cars", []);
  let d = await getPanelData(s);
  assert.deepEqual(d.staleReviewSlugs, ["c1"]);

  // An unrelated confirm (gallery) triggers the on-disk prune.
  const v = await versions(s);
  const r = await confirmLocale(s, "gallery", "g1", "uk", { working: v.gallery, review: v.review });
  assert.equal(r.ok, true, r.message);
  assert.equal(JSON.parse(s.files.get("src/content/cms/review-state.json")!).c1, undefined);

  // c1 re-created under the same id with byte-identical text: still needs review.
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson() }]);
  d = await getPanelData(s);
  assert.equal(d.groups[0].rows[0].id, "c1");
  assert.equal(d.groups[0].rows[0].langStatus.uk, "needs-review");
  assert.deepEqual(d.staleReviewSlugs, []);
});

// ---------------------------------------------------------------------------
// completeDeletion — the on-demand "Завершити видалення" button (task §4)
// ---------------------------------------------------------------------------

test("completeDeletion sweeps every orphaned review row in one version-guarded write", async () => {
  const s = baseStore(); // working: cars c1, gallery g1
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      ...carReviewAll, // c1 — real, keep
      "ghost-a": { uk: { hash: "x", at: "t" } },
      "ghost-b": { en: { hash: "y", at: "t" } },
    }),
  );
  let writes = 0;
  const realWrite = s.writeFile.bind(s);
  s.writeFile = (f, t, e) => {
    writes += 1;
    return realWrite(f, t, e);
  };

  const stale = await versions(s); // just to read versions
  const r = await completeDeletion(s, { review: stale.review });
  assert.equal(r.ok, true, r.message);
  assert.match(r.message, /ghost-a/);
  assert.match(r.message, /ghost-b/);
  assert.ok(writes <= 1, `wrote ${writes} times`);
  const review = JSON.parse(s.files.get("src/content/cms/review-state.json")!);
  assert.equal(review["ghost-a"], undefined);
  assert.equal(review["ghost-b"], undefined);
  assert.ok(review.c1); // the real row is untouched
});

test("completeDeletion also drops the _pub copies of a slug that is gone from both working AND published", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/services", []); // no working card
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({ publishedAt: "t", cars: [], gallery: [], services: [], contact: [], promos: [] }),
  );
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({ "service:ghost": { uk: { hash: "x", at: "t" } } }),
  );
  s.seedMedia("public/images/cms/services/ghost/_pub/deadbeef12345678.jpg", jpgBytes("ghost"));
  const v = await versions(s);
  const r = await completeDeletion(s, { review: v.review });
  assert.equal(r.ok, true, r.message);
  assert.equal(JSON.parse(s.files.get("src/content/cms/review-state.json")!)["service:ghost"], undefined);
  assert.equal(s.media.has("public/images/cms/services/ghost/_pub/deadbeef12345678.jpg"), false);
});

test("completeDeletion does NOT drop _pub copies a still-published orphan needs", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/services", []);
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({
      publishedAt: "t",
      cars: [],
      gallery: [],
      services: [
        JSON.parse(
          svcJson({ id: "orph", photos: [{ image: "/images/cms/services/orph/_pub/abcdef01.jpg", caption: "" }] }),
        ),
      ],
      contact: [],
      promos: [],
    }),
  );
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({ "service:orph": { uk: { hash: "x", at: "t" } } }),
  );
  s.seedMedia("public/images/cms/services/orph/_pub/abcdef01.jpg", jpgBytes("orph"));
  const v = await versions(s);
  await completeDeletion(s, { review: v.review });
  assert.ok(s.media.has("public/images/cms/services/orph/_pub/abcdef01.jpg")); // still referenced by the orphan
});

test("completeDeletion is idempotent — a second click finds nothing and writes nothing", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll)); // c1 real, no ghosts
  let writes = 0;
  const realWrite = s.writeFile.bind(s);
  s.writeFile = (f, t, e) => {
    writes += 1;
    return realWrite(f, t, e);
  };
  const v = await versions(s);
  const r = await completeDeletion(s, { review: v.review });
  assert.equal(r.ok, true);
  assert.match(r.message, /немає/i);
  assert.equal(writes, 0);
});

test("completeDeletion keeps a row whose slug re-appeared as a working card", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/cars", []); // c1 deleted
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const staleV = await versions(s);
  // Owner re-creates c1 before clicking the button.
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ bornAt: "fresh" }) }]);
  const r = await completeDeletion(s, { review: staleV.review });
  assert.equal(r.ok, true);
  assert.match(r.message, /немає/i); // nothing stale — c1 is a working card again
  assert.ok(JSON.parse(s.files.get("src/content/cms/review-state.json")!).c1); // row kept
});

test("completeDeletion rejects (transient, no write) when a working-dir read fails — never a false 'gone'", async () => {
  const s = baseStore();
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({ ...carReviewAll, ghost: { uk: { hash: "x", at: "t" } } }),
  );
  const v = await versions(s);
  s.readDir = async () => {
    throw new StorageUnavailableError("тест: GitHub не відповів");
  };
  const r = await completeDeletion(s, { review: v.review });
  assert.equal(r.ok, false);
  assert.equal((r as { transient?: boolean }).transient, true);
  assert.ok(JSON.parse(s.files.get("src/content/cms/review-state.json")!).ghost); // nothing removed
});

test("completeDeletion conflicts (no write) when review-state moved since page load", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/cars", []);
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const r = await completeDeletion(s, { review: "stale-token" });
  assert.equal((r as { conflict?: boolean }).conflict, true);
  assert.ok(JSON.parse(s.files.get("src/content/cms/review-state.json")!).c1);
});

// task 14:51 item 8 — CLOSED by per-instance review binding. A card deleted
// straight from Keystatic and re-created under the SAME slug with BYTE-IDENTICAL
// confirmed text, BEFORE any other confirm fires the stale-row prune: the
// leftover row's `instance` no longer matches the freshly-minted `bornAt`, so
// every language falls back to "needs-review" even though the slug is live
// again and the text hash still matches.
test("delete + immediate re-create (new instance) re-opens review even with byte-identical text", async () => {
  const s = baseStore();
  // c1 was confirmed while it carried instance "inst-A".
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      c1: {
        instance: "inst-A",
        uk: { hash: sha(confirmedText(CAR_L)), at: "t" },
        en: { hash: sha(confirmedText(CAR_L)), at: "t" },
        ru: { hash: sha(confirmedText(CAR_L)), at: "t" },
      },
    }),
  );
  // Delete, then immediately re-create c1 — same bytes, fresh Keystatic instance.
  s.seedDir("src/content/cms/cars", []);
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ bornAt: "inst-B" }) }]);
  const d = await getPanelData(s);
  assert.equal(d.groups[0].rows[0].langStatus.uk, "needs-review");
  assert.equal(d.groups[0].rows[0].langStatus.en, "needs-review");
  assert.equal(d.groups[0].rows[0].langStatus.ru, "needs-review");
  // The slug is live again, so the row is NOT stale — the instance mismatch is
  // what re-opens it.
  assert.deepEqual(d.staleReviewSlugs, []);
});

test("a legacy row (no instance) still trusts a legacy card (no bornAt) by hash alone", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll)); // no `instance`
  const d = await getPanelData(s); // c1 has no bornAt
  assert.equal(d.groups[0].rows[0].langStatus.uk, "reviewed");
});

test("editing one language on a re-created instance never revives the other languages", async () => {
  const s = baseStore();
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      c1: {
        instance: "inst-A",
        uk: { hash: sha(confirmedText(CAR_L)), at: "t" },
        en: { hash: sha(confirmedText(CAR_L)), at: "t" },
        ru: { hash: sha(confirmedText(CAR_L)), at: "t" },
      },
    }),
  );
  // Re-created as inst-B with identical text.
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ bornAt: "inst-B" }) }]);
  const v = await versions(s);
  const r = await confirmLocale(s, "car", "c1", "uk", { working: v.car, review: v.review });
  assert.equal(r.ok, true, r.message);

  const review = JSON.parse(s.files.get("src/content/cms/review-state.json")!);
  assert.equal(review["c1"], undefined); // legacy bare key consolidated away
  assert.equal(review["car:c1"].instance, "inst-B"); // row re-bound to the new card
  assert.ok(review["car:c1"].uk.hash); // uk confirmed
  assert.equal(review["car:c1"].en, undefined); // en/ru dropped — they were inst-A's
  assert.equal(review["car:c1"].ru, undefined);

  const d = await getPanelData(s);
  assert.equal(d.groups[0].rows[0].langStatus.uk, "reviewed");
  assert.equal(d.groups[0].rows[0].langStatus.en, "needs-review");
});

test("re-confirming the SAME instance keeps the other languages", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ bornAt: "inst-A" }) }]);
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      c1: {
        instance: "inst-A",
        en: { hash: sha(confirmedText(CAR_L)), at: "t" },
      },
    }),
  );
  const v = await versions(s);
  const r = await confirmLocale(s, "car", "c1", "uk", { working: v.car, review: v.review });
  assert.equal(r.ok, true, r.message);
  const review = JSON.parse(s.files.get("src/content/cms/review-state.json")!);
  assert.ok(review["car:c1"].uk.hash);
  assert.ok(review["car:c1"].en.hash); // untouched — same instance
  assert.equal(review["car:c1"].instance, "inst-A");
});

test("publish is blocked while a re-created card still carries a stale-instance review row", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/services", [
    { name: "s1.json", text: svcJson({ bornAt: "inst-B" }) },
  ]);
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({
      s1: {
        instance: "inst-A", // confirmed against the deleted card
        uk: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        en: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
        ru: { hash: sha(serviceConfirmedText(SVC_L)), at: "t" },
      },
    }),
  );
  const v = await versions(s);
  const r = await publishItem(s, "service", "s1", {
    working: v.service,
    review: v.review,
    published: v.published,
  });
  assert.equal(r.ok, false);
  assert.ok(
    (r as { blockers?: { kind: string }[] }).blockers!.some((b) => b.kind === "needs-review"),
  );
  assert.equal(s.files.has("src/content/cms/published.json"), false);
});

test("confirmLocale still writes the confirmation when the cleanup reads fail", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify({ "ghost": { uk: { hash: "d", at: "t" } } }));
  const v = await versions(s);
  // Fail every readDir AFTER loadKind's first two (cars + review already read).
  const realReadDir = s.readDir.bind(s);
  let calls = 0;
  s.readDir = async (dir) => {
    calls += 1;
    if (calls > 1) throw new StorageUnavailableError("тест: GitHub не відповів");
    return realReadDir(dir);
  };
  const r = await confirmLocale(s, "car", "c1", "uk", { working: v.car, review: v.review });
  assert.equal(r.ok, true, r.message);
  const review = JSON.parse(s.files.get("src/content/cms/review-state.json")!);
  assert.ok(review["car:c1"].uk.hash); // confirmation landed
  assert.ok(review["ghost"]); // cleanup skipped (reads unavailable) — not lost
});

test("a storage read failure surfaces as an error — never an empty dashboard or a false 'card deleted'", async () => {
  const s = baseStore();
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({ publishedAt: "t", cars: [], gallery: [], services: [JSON.parse(svcJson())] }),
  );
  s.readDir = async () => {
    throw new StorageUnavailableError("тест: GitHub не відповів");
  };
  // Must reject — not resolve with the published service turned into an orphan row.
  await assert.rejects(() => getPanelData(s), StorageUnavailableError);
});

// ---------------------------------------------------------------------------
// The full error path to the user: a panel ACTION result, not just the adapter
// ---------------------------------------------------------------------------

test("getPanelData still renders content when only the deploy-status probe fails", async () => {
  const s = baseStore();
  s.deployStatus = async () => {
    throw new StorageUnavailableError("GitHub");
  };
  const d = await getPanelData(s);
  assert.equal(d.deploy.state, "unknown"); // "не вдалося перевірити стан збірки"
  assert.equal(d.groups.length, 5); // the content loaded fine
});

test("a panel action reports a TRANSIENT failure (not bad input) when a read hits GitHub-unreachable", async () => {
  const s = baseStore();
  s.readDir = async () => {
    throw new StorageUnavailableError("GitHub не відповів");
  };
  const r = await publishItem(s, "car", "c1", { working: "x", review: "y", published: "z" });
  assert.equal(r.ok, false);
  assert.equal((r as { transient?: boolean }).transient, true);
});

test("a panel action says the write outcome is UNKNOWN (no retry) when the response is lost", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const v = await versions(s);
  s.writeFile = async () => {
    throw new WriteUncertainError("знімок");
  };
  const r = await publishItem(s, "car", "c1", {
    working: v.car,
    review: v.review,
    published: v.published,
  });
  assert.equal(r.ok, false);
  // The machine flag — NOT `transient` (which would mean "provably not written").
  assert.equal((r as { outcome?: string }).outcome, "unknown");
  assert.notEqual((r as { transient?: boolean }).transient, true);
  assert.match(r.message, /невідомо|перевірте|перш ніж повторюв/i);
});

test("a panel action surfaces a sign-in-again message (auth flag) when access is revoked mid-session", async () => {
  const s = baseStore();
  s.readDir = async () => {
    throw new StorageAuthError();
  };
  const r = await confirmLocale(s, "car", "c1", "uk", { working: "x", review: "y" });
  assert.equal(r.ok, false);
  assert.equal((r as { auth?: boolean }).auth, true);
  assert.match(r.message, /keystatic|увійд/i);
  // No token / raw body / stack trace leaked — just the guidance text.
  assert.doesNotMatch(r.message, /Bearer|token|\bat \/|\.ts:\d+/i);
});

test("a panel action distinguishes 403-forbidden (no retry) from 429-rate-limit (retry ok)", async () => {
  const forbidden = baseStore();
  forbidden.readDir = async () => {
    throw new StorageForbiddenError("недостатньо прав доступу");
  };
  const rf = await confirmLocale(forbidden, "car", "c1", "uk", { working: "x", review: "y" });
  assert.equal((rf as { forbidden?: boolean }).forbidden, true);
  assert.notEqual((rf as { transient?: boolean }).transient, true); // retrying won't help

  const limited = baseStore();
  limited.readDir = async () => {
    throw new StorageRateLimitedError();
  };
  const rl = await confirmLocale(limited, "car", "c1", "uk", { working: "x", review: "y" });
  assert.equal((rl as { transient?: boolean }).transient, true); // wait & retry
  assert.notEqual((rl as { forbidden?: boolean }).forbidden, true);
});

// Each action must perform AT MOST ONE writeFile: there is no "first write ok,
// second write fails" sequence inside a single action, so a lost final PUT
// means the whole action wrote nothing — retrying the action stays version-safe.
for (const [name, run] of [
  [
    "confirmLocale",
    async (s: FakeStorage) => {
      const v = await versions(s);
      return confirmLocale(s, "car", "c1", "uk", { working: v.car, review: v.review });
    },
  ],
  [
    "publishItem",
    async (s: FakeStorage) => {
      s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
      const v = await versions(s);
      return publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
    },
  ],
  [
    "unpublishItem",
    async (s: FakeStorage) => {
      s.seedFile(
        "src/content/cms/published.json",
        JSON.stringify({ publishedAt: "t", cars: [JSON.parse(carJson())], gallery: [] }),
      );
      const v = await versions(s);
      return unpublishItem(s, "car", "c1", { published: v.published });
    },
  ],
] as const) {
  test(`${name} performs at most one write (no partial-success sequence)`, async () => {
    const s = baseStore();
    let writes = 0;
    const realWrite = s.writeFile.bind(s);
    s.writeFile = (f, t, e) => {
      writes += 1;
      return realWrite(f, t, e);
    };
    const r = await run(s);
    assert.equal(r.ok, true, r.message);
    assert.ok(writes <= 1, `${name} wrote ${writes} times`);
  });
}

// ---------------------------------------------------------------------------
// Two-editor simulation (no real GitHub accounts — the version-token contract)
// ---------------------------------------------------------------------------

test("two editors, same version: the first save wins, the second gets a conflict — not a silent overwrite", async () => {
  const s = baseStore(); // no review-state.json yet

  // Both open the dashboard and read the same version tokens.
  const vA = await versions(s);
  const vB = await versions(s);
  assert.deepEqual(vA, vB);
  assert.equal(vA.review, "");

  // Editor A confirms UK — this creates review-state.json (version moves).
  const rA = await confirmLocale(s, "car", "c1", "uk", { working: vA.car, review: vA.review });
  assert.equal(rA.ok, true);

  // Editor B, still holding the stale (empty) review token, tries to confirm EN.
  const rB = await confirmLocale(s, "car", "c1", "en", { working: vB.car, review: vB.review });
  assert.equal((rB as { conflict?: boolean }).conflict, true);
  assert.match(rB.message, /онов|заново|перезавантаж/i); // message points at recovery

  // A's write survived; B's did not clobber it.
  const review = JSON.parse(s.files.get("src/content/cms/review-state.json")!);
  assert.ok(review["car:c1"].uk.hash);
  assert.equal(review["car:c1"].en, undefined);
});

test("two editors publishing DIFFERENT items: both land, neither drops the other's work", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcJson() }]);
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({ ...carReviewAll, ...svcReviewAll }),
  );

  let v = await versions(s);
  const rCar = await publishItem(s, "car", "c1", {
    working: v.car,
    review: v.review,
    published: v.published,
  });
  assert.equal(rCar.ok, true);

  // Second editor refreshes (new published token) then publishes the service.
  v = await versions(s);
  const rSvc = await publishItem(s, "service", "s1", {
    working: v.service,
    review: v.review,
    published: v.published,
  });
  assert.equal(rSvc.ok, true);

  const snap = JSON.parse(s.files.get("src/content/cms/published.json")!);
  assert.deepEqual(snap.cars.map((x: { id: string }) => x.id), ["c1"]);
  assert.deepEqual(snap.services.map((x: { id: string }) => x.id), ["s1"]);
});

test("editor B publishes against a snapshot editor A already moved: conflict, no write", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const vB = await versions(s); // B loads

  // A publishes first (bumps the published token).
  const vA = await versions(s);
  await publishItem(s, "car", "c1", { working: vA.car, review: vA.review, published: vA.published });

  // B, holding the stale published token, publishes the same card.
  const rB = await publishItem(s, "car", "c1", {
    working: vB.car,
    review: vB.review,
    published: vB.published,
  });
  // Either a clean "already published in this version" no-op, or a conflict —
  // never a lossy overwrite. Here the content is identical => no-op success.
  assert.equal(rB.ok, true);
  assert.match(rB.message, /вже опубліков/);
});

test("retry after a lost response: the repeated publish is an idempotent no-op success", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  let v = await versions(s);
  const first = await publishItem(s, "car", "c1", {
    working: v.car,
    review: v.review,
    published: v.published,
  });
  assert.equal(first.ok, true);

  // Client never saw the response and retries with a refreshed token.
  v = await versions(s);
  const retry = await publishItem(s, "car", "c1", {
    working: v.car,
    review: v.review,
    published: v.published,
  });
  assert.equal(retry.ok, true);
  assert.match(retry.message, /вже опубліков/);
  assert.equal(JSON.parse(s.files.get("src/content/cms/published.json")!).cars.length, 1);
});

test("one editor viewing (getPanelData) never blocks or loses another's concurrent write", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const viewer = await getPanelData(s); // viewer holds a snapshot of state
  const v = await versions(s);
  const w = await confirmLocale(s, "car", "c1", "uk", { working: v.car, review: v.review });
  assert.equal(w.ok, true);
  // Viewer's in-memory data is simply stale; a refresh shows the write.
  const after = await getPanelData(s);
  assert.notEqual(viewer.versions.review, after.versions.review);
});

// ===========================================================================
// Stage 6 (task 14:51 item 6) — the same panel actions across the other
// collections, on synthetic data. confirmLocale / publishItem / unpublishItem
// are kind-generic (they dispatch through KINDS[kindKey]); these check the
// promo, contact and gallery paths and that one kind's publish never disturbs
// another kind's snapshot. Local synthetic fixtures only — no GitHub writes.
// ===========================================================================

const PROMO_L = { title: "P", summary: "", linkLabel: "", body: "" };
const promoJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "p1",
    order: 1,
    type: "promo",
    visible: true,
    image: "/p.jpg",
    linkUrl: "",
    date: "",
    uk: PROMO_L,
    en: PROMO_L,
    ru: PROMO_L,
    ...over,
  });
const promoReviewAll = {
  p1: {
    uk: { hash: sha(promoConfirmedText(PROMO_L)), at: "t" },
    en: { hash: sha(promoConfirmedText(PROMO_L)), at: "t" },
    ru: { hash: sha(promoConfirmedText(PROMO_L)), at: "t" },
  },
};

const CONTACT_L = { heading: "H", subheading: "S", hoursLabel: "", addressLabel: "" };
const contactJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "site",
    order: 0,
    phoneDisplay: "",
    phoneE164: "",
    email: "",
    whatsappNumber: "",
    telegramUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    youtubeUrl: "",
    addressText: "",
    mapsUrl: "",
    hours: "",
    uk: CONTACT_L,
    en: CONTACT_L,
    ru: CONTACT_L,
    ...over,
  });

function stage6Store() {
  const s = baseStore(); // cars: c1, gallery: g1
  s.seedDir("src/content/cms/services", [{ name: "s1.json", text: svcJson() }]);
  s.seedDir("src/content/cms/promos", [{ name: "p1.json", text: promoJson() }]);
  s.seedDir("src/content/cms/contact", [{ name: "site.json", text: contactJson() }]);
  return s;
}

test("promo: confirmLocale flips one language to reviewed and gates publish", async () => {
  const s = stage6Store();
  let d = await getPanelData(s);
  const promoRow = d.groups.find((g) => g.rows.some((r) => r.id === "p1"))!.rows.find((r) => r.id === "p1")!;
  assert.equal(promoRow.langStatus.uk, "needs-review");
  assert.ok(promoRow.blockers.length > 0); // can't publish yet

  const v = await getPanelData(s).then((x) => x.versions);
  for (const l of ["uk", "en", "ru"] as const) {
    const r = await confirmLocale(s, "promo", "p1", l, {
      working: v.promo,
      review: (await getPanelData(s)).versions.review,
    });
    assert.equal(r.ok, true, r.message);
  }
  d = await getPanelData(s);
  const after = d.groups.flatMap((g) => g.rows).find((r) => r.id === "p1")!;
  assert.equal(after.langStatus.uk, "reviewed");
  assert.deepEqual(after.blockers, []);
  // cars / gallery / services / contact review rows are untouched by the promo confirms.
  const review = JSON.parse(s.files.get("src/content/cms/review-state.json")!);
  assert.equal(review.c1, undefined); // c1 was never confirmed in this store
});

test("promo: publish then unpublish moves exactly the promo snapshot entry", async () => {
  const s = stage6Store();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(promoReviewAll));
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({ publishedAt: "t", cars: [], gallery: [], services: [], contact: [], promos: [] }),
  );
  let v = await getPanelData(s).then((x) => x.versions);
  const pub = await publishItem(s, "promo", "p1", { working: v.promo, review: v.review, published: v.published });
  assert.equal(pub.ok, true, pub.message);
  let snap = JSON.parse(s.files.get("src/content/cms/published.json")!);
  assert.deepEqual(snap.promos.map((p: { id: string }) => p.id), ["p1"]);
  assert.deepEqual(snap.cars, []); // other kinds untouched

  v = await getPanelData(s).then((x) => x.versions);
  const un = await unpublishItem(s, "promo", "p1", { published: v.published });
  assert.equal(un.ok, true, un.message);
  snap = JSON.parse(s.files.get("src/content/cms/published.json")!);
  assert.deepEqual(snap.promos, []);
});

test("promo: a stale version token is rejected (no write) — conflict", async () => {
  const s = stage6Store();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(promoReviewAll));
  const stale = await getPanelData(s).then((x) => x.versions);
  // someone else confirms in between, bumping the review version
  await confirmLocale(s, "promo", "p1", "uk", {
    working: stale.promo,
    review: stale.review,
  });
  const r = await confirmLocale(s, "promo", "p1", "en", { working: stale.promo, review: stale.review });
  assert.equal((r as { conflict?: boolean }).conflict, true);
});

test("contact (singleton): confirmLocale + publish work through the same path", async () => {
  const s = stage6Store();
  const v0 = await getPanelData(s).then((x) => x.versions);
  const c = await confirmLocale(s, "contact", "site", "uk", { working: v0.contact, review: v0.review });
  assert.equal(c.ok, true, c.message);
  for (const l of ["en", "ru"] as const) {
    const rv = (await getPanelData(s)).versions;
    const r = await confirmLocale(s, "contact", "site", l, { working: rv.contact, review: rv.review });
    assert.equal(r.ok, true, r.message);
  }
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({ publishedAt: "t", cars: [], gallery: [], services: [], contact: [], promos: [] }),
  );
  const v = await getPanelData(s).then((x) => x.versions);
  const pub = await publishItem(s, "contact", "site", {
    working: v.contact,
    review: v.review,
    published: v.published,
  });
  assert.equal(pub.ok, true, pub.message);
  const snap = JSON.parse(s.files.get("src/content/cms/published.json")!);
  assert.deepEqual(snap.contact.map((c2: { id: string }) => c2.id), ["site"]);
});

test("gallery: confirm then a stale confirm on another language conflicts", async () => {
  const s = stage6Store();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(galReviewAll));
  const stale = await getPanelData(s).then((x) => x.versions);
  await confirmLocale(s, "gallery", "g1", "uk", { working: stale.gallery, review: stale.review });
  const r = await confirmLocale(s, "gallery", "g1", "en", { working: stale.gallery, review: stale.review });
  assert.equal((r as { conflict?: boolean }).conflict, true);
});

test("cross-kind: publishing a car does not disturb an already-published gallery section", async () => {
  const s = stage6Store();
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({ ...carReviewAll, ...galReviewAll }),
  );
  s.seedFile(
    "src/content/cms/published.json",
    JSON.stringify({ publishedAt: "t", cars: [], gallery: [], services: [], contact: [], promos: [] }),
  );
  // Step 1: publish the gallery item -> a real, fully-coerced gallery section.
  let v = await getPanelData(s).then((x) => x.versions);
  const g = await publishItem(s, "gallery", "g1", {
    working: v.gallery,
    review: v.review,
    published: v.published,
  });
  assert.equal(g.ok, true, g.message);
  const galleryAfterStep1 = JSON.parse(s.files.get("src/content/cms/published.json")!).gallery;

  // Step 2: publish the car item.
  v = await getPanelData(s).then((x) => x.versions);
  const c = await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  assert.equal(c.ok, true, c.message);
  const snap = JSON.parse(s.files.get("src/content/cms/published.json")!);

  // The gallery section is byte-identical to what step 1 produced; the car
  // section now has c1; nothing else was touched.
  assert.deepEqual(snap.gallery, galleryAfterStep1);
  assert.deepEqual(
    snap.cars.map((car: { id: string }) => car.id),
    ["c1"],
  );
  assert.deepEqual(snap.services, []);
  assert.deepEqual(snap.promos, []);
});

// ---------------------------------------------------------------------------
// checkActionResult — the read-only "Перевірити результат". Verifies the
// SPECIFIC expected effect of each action: true / false / null (keep locked).
// ---------------------------------------------------------------------------

const rowOf = async (s: FakeStorage, kind: string, id: string) => {
  const d = await getPanelData(s);
  return d.groups.find((g) => g.kind === kind)!.rows.find((r) => r.id === id)!;
};

test("check publish: true ONLY when the exact captured version is what got published", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const before = await versions(s);
  const token = (await rowOf(s, "car", "c1")).publishTargetToken;

  // Not published yet -> false (retry ok), never a false "applied".
  const no = await checkActionResult(
    s,
    { action: "publish", kind: "car", id: "c1", expectToken: token },
    before,
  );
  assert.equal(no.applied, false);

  await publishItem(s, "car", "c1", { working: before.car, review: before.review, published: before.published });
  const yes = await checkActionResult(
    s,
    { action: "publish", kind: "car", id: "c1", expectToken: token },
    before,
  );
  assert.equal(yes.applied, true);
});

test("check publish: our request failed, another editor published a DIFFERENT version of the SAME item -> null, never a false success", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const before = await versions(s);
  // Editor A captures the token for the version they try to publish.
  const tokenA = (await rowOf(s, "car", "c1")).publishTargetToken;
  // A's request is lost. Editor B edits c1 and publishes THEIR version.
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ price: "£777" }) }]);
  const vB = await versions(s);
  await publishItem(s, "car", "c1", { working: vB.car, review: vB.review, published: vB.published });

  const r = await checkActionResult(
    s,
    { action: "publish", kind: "car", id: "c1", expectToken: tokenA },
    before,
  );
  assert.equal(r.applied, null); // NOT true — it was B's version, not A's
  assert.doesNotMatch(r.message, /опубліковано саме цю версію/);
  assert.match(r.message, /іншу версію|перегляньте|не повторюйте/i);
});

test("check publish: another editor published a different ITEM -> our item absent -> false (retry ok)", async () => {
  const s = baseStore();
  s.seedDir("src/content/cms/gallery", [{ name: "g1.json", text: galJson() }]);
  s.seedFile("src/content/cms/review-state.json", JSON.stringify({ ...carReviewAll, ...galReviewAll }));
  const before = await versions(s);
  const tokenA = (await rowOf(s, "car", "c1")).publishTargetToken;
  const v = await versions(s);
  await publishItem(s, "gallery", "g1", { working: v.gallery, review: v.review, published: v.published });

  const r = await checkActionResult(
    s,
    { action: "publish", kind: "car", id: "c1", expectToken: tokenA },
    before,
  );
  assert.equal(r.applied, false); // c1 simply isn't published
});

test("check confirm-locale: OUR confirm of THIS text landed even after the text later changed to B", async () => {
  const s = baseStore();
  const v = await versions(s);
  const tokenA = (await rowOf(s, "car", "c1")).localeTextToken.uk;

  // Nothing confirmed yet -> false.
  const before = await checkActionResult(
    s,
    { action: "confirm-locale", kind: "car", id: "c1", locale: "uk", expectToken: tokenA },
    v,
  );
  assert.equal(before.applied, false);

  // A's confirm of text-A landed; then the working text changes to B.
  await confirmLocale(s, "car", "c1", "uk", { working: v.car, review: v.review });
  s.seedDir("src/content/cms/cars", [
    { name: "c1.json", text: carJson({ uk: { ...CAR_L, description: "text B now" } }) },
  ]);

  const after = await checkActionResult(
    s,
    { action: "confirm-locale", kind: "car", id: "c1", locale: "uk", expectToken: tokenA },
    await versions(s),
  );
  assert.equal(after.applied, true); // A's confirm DID happen
  assert.match(after.message, /застосовано/);
  assert.match(after.message, /текст змінили|перегляньте/i); // but flags the drift
});

test("check confirm-locale: another editor confirmed DIFFERENT text since -> null, don't suggest a blind re-confirm", async () => {
  const s = baseStore();
  const tokenA = (await rowOf(s, "car", "c1")).localeTextToken.uk;

  // Editor B changed the text AND confirmed it.
  s.seedDir("src/content/cms/cars", [
    { name: "c1.json", text: carJson({ uk: { ...CAR_L, description: "B's text" } }) },
  ]);
  const vB = await versions(s);
  await confirmLocale(s, "car", "c1", "uk", { working: vB.car, review: vB.review });

  const r = await checkActionResult(
    s,
    { action: "confirm-locale", kind: "car", id: "c1", locale: "uk", expectToken: tokenA },
    await versions(s),
  );
  assert.equal(r.applied, null);
  assert.match(r.message, /іншим текстом|прочитайте|наосліп/i);
});

test("check unpublish: true once the item is gone from the published snapshot", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  let v = await versions(s);
  await publishItem(s, "car", "c1", { working: v.car, review: v.review, published: v.published });
  const stillThere = await checkActionResult(s, { action: "unpublish", kind: "car", id: "c1" }, await versions(s));
  assert.equal(stillThere.applied, false);

  v = await versions(s);
  await unpublishItem(s, "car", "c1", { published: v.published });
  const gone = await checkActionResult(s, { action: "unpublish", kind: "car", id: "c1" }, await versions(s));
  assert.equal(gone.applied, true);
});

test("check cleanup: true/false/null keyed on the EXACT plan paths, not a fuzzy count", async () => {
  const s = photoStore();
  s.seedMedia("public/images/cms/services/s1/_pub/deadbeef00.jpg", jpgBytes("old-1"));
  s.seedMedia("public/images/cms/services/s1/_pub/deadbeef11.jpg", jpgBytes("old-2"));
  const plan = [
    "public/images/cms/services/s1/_pub/deadbeef00.jpg",
    "public/images/cms/services/s1/_pub/deadbeef11.jpg",
  ];
  const bothPresent = await checkActionResult(s, { action: "cleanup-frozen-media", planPaths: plan }, {});
  assert.equal(bothPresent.applied, false);

  s.media.delete(plan[0]);
  const partial = await checkActionResult(s, { action: "cleanup-frozen-media", planPaths: plan }, {});
  assert.equal(partial.applied, null); // "Прибрано частину…" — stay locked

  s.media.delete(plan[1]);
  const gone = await checkActionResult(s, { action: "cleanup-frozen-media", planPaths: plan }, {});
  assert.equal(gone.applied, true);

  const noPlan = await checkActionResult(s, { action: "cleanup-frozen-media", planPaths: [] }, {});
  assert.equal(noPlan.applied, null);
});

test("check: a read failure is NOT an answer — applied stays null so the button stays locked", async () => {
  const s = baseStore();
  const realRead = s.readFile.bind(s);
  s.readFile = async (f, at) => {
    if (f === "src/content/cms/published.json") throw new StorageUnavailableError("тест");
    return realRead(f, at);
  };
  const r = await checkActionResult(
    s,
    { action: "publish", kind: "car", id: "c1", expectToken: "anything" },
    {},
  );
  assert.equal(r.applied, null);
  assert.match(r.message, /не вдалося|ще раз/i);
});

test("check complete-deletion: true once the asked-about stale slugs are gone", async () => {
  const s = baseStore();
  // review-state row for a slug with no working card in any kind = stale.
  s.seedFile(
    "src/content/cms/review-state.json",
    JSON.stringify({ "car:ghost": { uk: { hash: "x", at: "t" }, instance: "" } }),
  );
  const stale = await checkActionResult(s, { action: "complete-deletion", slugs: ["car:ghost"] }, {});
  assert.equal(stale.applied, false);

  await completeDeletion(s, { review: (await versions(s)).review });
  const cleared = await checkActionResult(s, { action: "complete-deletion", slugs: ["car:ghost"] }, {});
  assert.equal(cleared.applied, true);
});

test("check publish: general status unchanged but working CONTENT changed -> never a false 'applied' (scenario 6)", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  const before = await versions(s);
  await publishItem(s, "car", "c1", { working: before.car, review: before.review, published: before.published });
  // owner edits a shared (non-locale) field after the (uncertain) publish; the
  // published token has NOT moved beyond that first publish.
  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ price: "£999" }) }]);
  const seenAfterOurPublish = await versions(s);
  const r = await checkActionResult(s, { action: "publish", kind: "car", id: "c1" }, seenAfterOurPublish);
  assert.notEqual(r.applied, true); // row is "modified" again — must not claim applied
});

test("check is READ-ONLY — it never writes, whatever the verdict (no repeated write before confirmation)", async () => {
  const s = baseStore();
  s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
  let writes = 0;
  const realWrite = s.writeFile.bind(s);
  s.writeFile = (f, t, e) => {
    writes += 1;
    return realWrite(f, t, e);
  };
  const targets: import("./panelStore").CheckTarget[] = [
    { action: "publish", kind: "car", id: "c1" },
    { action: "unpublish", kind: "car", id: "c1" },
    { action: "confirm-locale", kind: "car", id: "c1", locale: "uk" },
    { action: "complete-deletion", slugs: ["car:ghost"] },
    { action: "cleanup-frozen-media", planPaths: ["public/images/cms/cars/c1/_pub/aa.jpg"] },
  ];
  for (const t of targets) {
    await checkActionResult(s, t, await versions(s));
  }
  assert.equal(writes, 0, "checkActionResult must not perform any write");
});
