/**
 * One-off, re-runnable: namespace every review-state.json key by kind
 * (`suzuki-sx4-s-cross` -> `car:suzuki-sx4-s-cross`).
 *
 *   node scripts/migrate-review-keys.mjs
 *
 * Why: `review[id]` was flat, so two cards in different collections with the
 * same slug (e.g. `cars/foo` + `services/foo`) shared one confirmation —
 * confirming one wiped the other (task 2026-09-09 §3). Namespaced keys keep
 * them separate. The gates still read a bare key as a fallback, so this can run
 * before or after the code lands.
 *
 * Only KEYS change — no hash, `instance`, or timestamp is touched. Re-running
 * is a no-op (a key that already contains ":" is left alone). A key whose slug
 * backs no working card in any kind is left bare (it is orphaned review state;
 * "Завершити видалення" in /panel removes it).
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CMS = path.join(ROOT, "src/content/cms");
const REVIEW = path.join(CMS, "review-state.json");
/** collection dir -> kindKey */
const KIND_OF_DIR = { cars: "car", gallery: "gallery", services: "service", contact: "contact", promos: "promo" };

// slug -> kindKey, from the working card files
const slugKind = {};
for (const [dir, kindKey] of Object.entries(KIND_OF_DIR)) {
  let names;
  try {
    names = (await fs.readdir(path.join(CMS, dir))).filter((n) => n.endsWith(".json") && !n.startsWith("."));
  } catch {
    continue;
  }
  for (const n of names) slugKind[n.replace(/\.json$/, "")] = kindKey;
}

const review = JSON.parse(await fs.readFile(REVIEW, "utf8"));
const out = {};
let renamed = 0;
let orphan = 0;
for (const [key, row] of Object.entries(review)) {
  if (key.includes(":")) {
    out[key] = row; // already namespaced
    continue;
  }
  const kindKey = slugKind[key];
  if (!kindKey) {
    out[key] = row; // orphaned review state — leave bare, /panel sweeps it
    orphan += 1;
    console.log(`• ${key}: no working card — left bare (orphan)`);
    continue;
  }
  out[`${kindKey}:${key}`] = row;
  renamed += 1;
  console.log(`✓ ${key} -> ${kindKey}:${key}`);
}
await fs.writeFile(REVIEW, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(`\nDone. ${renamed} key(s) namespaced, ${orphan} left bare. Review: git diff ${path.relative(ROOT, REVIEW)}`);
