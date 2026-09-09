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

// ---------------------------------------------------------------------------
// Stale review-state rows left by a Keystatic "Delete entry" (П35)
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
  assert.ok(review.c1.uk.hash); // the confirmation still landed
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

// KNOWN RESIDUAL (task 14:51 item 8): if a card is deleted straight from
// Keystatic and re-created under the SAME slug with BYTE-IDENTICAL confirmed
// text BEFORE any other confirm has fired the prune, the leftover row is not
// stale (the slug is live again) and its stored hash still matches the
// identical text — so the card shows "reviewed" without a fresh human
// confirm. Fully closing this needs the review row bound to a card-instance
// token, not just content (a bigger change than this fix). Recorded as `todo`
// so it stays visible; the narrower harm is low (the text IS what a human
// approved before the delete).
test(
  "residual: delete + immediate re-create with identical text still shows reviewed",
  { todo: "needs per-card-instance binding of review rows" },
  async () => {
    const s = baseStore();
    s.seedFile("src/content/cms/review-state.json", JSON.stringify(carReviewAll));
    // delete then immediately re-create c1 with the same bytes, no confirm between
    s.seedDir("src/content/cms/cars", []);
    s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson() }]);
    const d = await getPanelData(s);
    // desired: "needs-review"; actual today: "reviewed"
    assert.equal(d.groups[0].rows[0].langStatus.uk, "needs-review");
  },
);

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
  assert.ok(review.c1.uk.hash); // confirmation landed
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
  assert.equal((r as { transient?: boolean }).transient, true);
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
