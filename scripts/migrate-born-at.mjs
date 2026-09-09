/**
 * One-off, re-runnable migration: stamp every EXISTING working card and its
 * review-state row with a matching instance token (`bornAt` / `instance`).
 *
 *   node scripts/migrate-born-at.mjs
 *
 * Why: per-instance review binding (task 2026-09-09 §3). New cards get a fresh
 * token from Keystatic's schema default on create; the cards that predate the
 * field need one too, or their first Keystatic save would gain a `bornAt` that
 * no longer matches their (token-less) review row and wrongly re-open every
 * language. Stamping both sides now with the SAME deterministic value keeps
 * existing confirmations valid and changes nothing the public site reads
 * (`bornAt` is not in `published.json`, not in any coerce output, not in the
 * review hash).
 *
 * Token: `legacy-<slug>` — obviously a migration stamp, unique per card.
 * Re-running is a no-op (rows/files that already have a token are left alone).
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CMS = path.join(ROOT, "src/content/cms");
const REVIEW = path.join(CMS, "review-state.json");
const WORKING_DIRS = ["cars", "gallery", "services", "contact"];

const token = (slug) => `legacy-${slug}`;
const writeJson = (file, value) => fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");

let stampedFiles = 0;
let stampedRows = 0;

for (const dir of WORKING_DIRS) {
  const abs = path.join(CMS, dir);
  let names;
  try {
    names = (await fs.readdir(abs)).filter((n) => n.endsWith(".json") && !n.startsWith("."));
  } catch {
    continue;
  }
  for (const name of names.sort()) {
    const file = path.join(abs, name);
    const slug = name.replace(/\.json$/, "");
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    if (typeof data.bornAt === "string" && data.bornAt) continue;
    data.bornAt = token(slug); // appended last — matches schema field order
    await writeJson(file, data);
    stampedFiles += 1;
    console.log(`✓ ${dir}/${name} -> bornAt ${data.bornAt}`);
  }
}

const review = JSON.parse(await fs.readFile(REVIEW, "utf8"));
for (const [slug, row] of Object.entries(review)) {
  if (typeof row.instance === "string" && row.instance) continue;
  review[slug] = { instance: token(slug), ...row };
  stampedRows += 1;
  console.log(`✓ review-state[${slug}] -> instance ${token(slug)}`);
}
await writeJson(REVIEW, review);

console.log(`\nDone. ${stampedFiles} card file(s), ${stampedRows} review row(s) stamped.`);
console.log("Review: git diff --stat && node scripts/migrate-born-at.mjs (re-run = no-op)");
