import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { confirmedText } from "./carsGate";
import { galleryConfirmedText } from "./galleryGate";
import { serviceConfirmedText } from "./serviceGate";
import {
  ConflictError,
  StorageUnavailableError,
  assertAllowedDir,
  assertAllowedFile,
  type AllowedDir,
  type AllowedFile,
  type DeployStatus,
  type DirEntry,
  type PanelStorage,
  type Versioned,
} from "./store/adapter";
import { confirmLocale, getPanelData, publishItem, unpublishItem } from "./panelStore";

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

/** In-memory file store with real version bumps + conflict checks. */
class FakeStorage implements PanelStorage {
  readonly mode = "github" as const;
  branch: string | null = null;
  files = new Map<string, string>();
  dirs = new Map<string, DirEntry[]>();
  deploy: DeployStatus = { state: "ready" };

  seedDir(dir: AllowedDir, entries: DirEntry[]) {
    this.dirs.set(dir, entries);
  }
  seedFile(file: AllowedFile, text: string) {
    this.files.set(file, text);
  }

  async readDir(dir: AllowedDir): Promise<Versioned<DirEntry[]>> {
    assertAllowedDir(dir);
    const entries = this.dirs.get(dir) ?? [];
    return {
      data: entries,
      version: entries.length ? hash(entries.map((e) => `${e.name}:${e.text}`).join("\n")) : "",
    };
  }
  async readFile(file: AllowedFile): Promise<Versioned<string | null>> {
    assertAllowedFile(file);
    const text = this.files.get(file) ?? null;
    return { data: text, version: text ? hash(text) : "" };
  }
  async writeFile(file: AllowedFile, text: string, expected: string): Promise<Versioned<string>> {
    assertAllowedFile(file);
    const cur = this.files.get(file) ?? null;
    if ((cur ? hash(cur) : "") !== expected) throw new ConflictError("файл");
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
  assert.ok(JSON.parse(s.files.get("src/content/cms/review-state.json")!).c1.uk.hash);
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
  assert.ok(review.c1.uk.hash);
  assert.equal(review.c1.en, undefined);
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
