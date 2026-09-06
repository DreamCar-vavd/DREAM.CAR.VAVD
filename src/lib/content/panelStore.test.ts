import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { confirmedText } from "./carsGate";
import { galleryConfirmedText } from "./galleryGate";
import {
  ConflictError,
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
  assert.deepEqual(d.groups.map((g) => g.kind), ["car", "gallery"]);
  assert.equal(d.groups[0].rows[0].publishState, "in-sync");
  assert.equal(d.groups[1].rows[0].publishState, "not-published");
  assert.equal(d.deploy.state, "ready");

  s.seedDir("src/content/cms/cars", [{ name: "c1.json", text: carJson({ price: "£999" }) }]);
  d = await getPanelData(s);
  assert.equal(d.groups[0].rows[0].publishState, "modified");
});
