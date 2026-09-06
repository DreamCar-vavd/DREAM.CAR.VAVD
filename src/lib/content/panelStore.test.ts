import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { confirmedText, type CmsCar } from "./carsGate";
import {
  ConflictError,
  type DeployStatus,
  type PanelStorage,
  type Snapshot,
  type Versioned,
} from "./store/adapter";
import { confirmLocale, getPanelData, publishCar, unpublishCar } from "./panelStore";
import type { ReviewState } from "./carsGate";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function car(over: Partial<CmsCar> = {}): CmsCar {
  const L = { title: "T", specLine: "S", description: "", viewGalleryLabel: "" };
  return {
    id: "c1",
    order: 1,
    saleStatus: "for-sale",
    year: "2020",
    price: "£1",
    mileageValue: 1,
    photos: [{ image: "/x.jpg", caption: "" }],
    video: { mode: "none", src: "", posterSrc: "" },
    uk: { ...L },
    en: { ...L },
    ru: { ...L },
    ...over,
  };
}

/** In-memory PanelStorage with real version bumps and conflict checks. */
class FakeStorage implements PanelStorage {
  readonly mode = "github" as const;
  cars: CmsCar[];
  review: ReviewState;
  published: Snapshot;
  vWorking = "w0";
  vReview = "r0";
  vPublished = "p0";
  deploy: DeployStatus = { state: "ready" };

  constructor(cars: CmsCar[], review: ReviewState = {}, published: Snapshot = { publishedAt: "", cars: [] }) {
    this.cars = cars;
    this.review = review;
    this.published = published;
  }
  async readWorkingCars(): Promise<Versioned<CmsCar[]>> {
    return { data: this.cars, version: this.vWorking };
  }
  async readReview(): Promise<Versioned<ReviewState>> {
    return { data: this.review, version: this.vReview };
  }
  async readPublished(): Promise<Versioned<Snapshot>> {
    return { data: this.published, version: this.vPublished };
  }
  async writeReview(data: ReviewState, expected: string) {
    if (expected !== this.vReview) throw new ConflictError("перевірки");
    this.review = data;
    this.vReview = `r${Math.random()}`;
    return { data, version: this.vReview };
  }
  async writePublished(data: Snapshot, expected: string) {
    if (expected !== this.vPublished) throw new ConflictError("знімок");
    this.published = data;
    this.vPublished = `p${Math.random()}`;
    return { data, version: this.vPublished };
  }
  async deployStatus() {
    return this.deploy;
  }
}

const reviewedAll = (c: CmsCar): ReviewState => ({
  [c.id]: {
    uk: { hash: sha(confirmedText(c.uk)), at: "t" },
    en: { hash: sha(confirmedText(c.en)), at: "t" },
    ru: { hash: sha(confirmedText(c.ru)), at: "t" },
  },
});

const V = (s: FakeStorage) => ({ working: s.vWorking, review: s.vReview, published: s.vPublished });

test("confirmLocale writes the review hash and is version-guarded", async () => {
  const s = new FakeStorage([car()]);
  const r = await confirmLocale(s, "c1", "uk", { review: s.vReview, working: s.vWorking });
  assert.equal(r.ok, true);
  assert.ok(s.review.c1?.uk?.hash);
});

test("confirmLocale conflicts when the working set changed since the page loaded", async () => {
  const s = new FakeStorage([car()]);
  s.vWorking = "w-moved";
  const r = await confirmLocale(s, "c1", "uk", { review: s.vReview, working: "w0" });
  assert.equal(r.ok, false);
  assert.equal((r as { conflict?: boolean }).conflict, true);
});

test("publishCar is blocked by the gate and never writes", async () => {
  const s = new FakeStorage([car({ ru: { title: "", specLine: "", description: "", viewGalleryLabel: "" } })], reviewedAll(car()));
  const r = await publishCar(s, "c1", V(s));
  assert.equal(r.ok, false);
  assert.ok((r as { blockers?: unknown[] }).blockers!.length > 0);
  assert.equal(s.published.cars.length, 0);
});

test("publishCar conflicts (no write) when the snapshot moved between view and publish", async () => {
  const c = car();
  const s = new FakeStorage([c], reviewedAll(c));
  const stale = V(s);
  s.vPublished = "p-moved-by-someone-else";
  const r = await publishCar(s, "c1", stale);
  assert.equal((r as { conflict?: boolean }).conflict, true);
  assert.equal(s.published.cars.length, 0);
});

test("publishCar freezes the working car into the snapshot; a second identical publish is a no-op success", async () => {
  const c = car();
  const s = new FakeStorage([c], reviewedAll(c));
  const r1 = await publishCar(s, "c1", V(s));
  assert.equal(r1.ok, true);
  assert.equal(s.published.cars.length, 1);
  // simulate the client re-reading versions (as router.refresh would)
  const r2 = await publishCar(s, "c1", V(s));
  assert.equal(r2.ok, true);
  assert.match(r2.message, /вже опубліков/);
  assert.equal(s.published.cars.length, 1);
});

test("unpublishCar removes from the snapshot, guarded by version", async () => {
  const c = car();
  const s = new FakeStorage([c], reviewedAll(c), { publishedAt: "t", cars: [c] });
  const bad = await unpublishCar(s, "c1", "p-wrong");
  assert.equal((bad as { conflict?: boolean }).conflict, true);
  const ok = await unpublishCar(s, "c1", s.vPublished);
  assert.equal(ok.ok, true);
  assert.equal(s.published.cars.length, 0);
});

test("getPanelData reports modified vs in-sync and surfaces the deploy state", async () => {
  const c = car();
  const s = new FakeStorage([c], reviewedAll(c), { publishedAt: "t", cars: [c] });
  let d = await getPanelData(s);
  assert.equal(d.rows[0].publishState, "in-sync");
  assert.equal(d.deploy.state, "ready");

  s.cars = [car({ price: "£999" })];
  d = await getPanelData(s);
  assert.equal(d.rows[0].publishState, "modified");
});
