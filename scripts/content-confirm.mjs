/**
 *   npm run content:confirm            — refresh locks for every car
 *   npm run content:confirm <car-id>   — just one car
 *
 * For each language currently marked "Перевірено цією мовою" (reviewState:
 * "confirmed"), (re)writes its hash into src/content/cms/translation-locks.json.
 * Run this after you edit and re-check a translation, so the content gate
 * stops flagging it as "текст змінено після перевірки".
 *
 * A language that is NOT confirmed gets its lock entry removed.
 *
 * NOTE: this is the interim CLI. A one-click "Перевірено" button inside the
 * panel that does the same write is a follow-up (report/33 §3).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const CARS_DIR = path.join(ROOT, "src/content/cms/cars");
const LOCKS_FILE = path.join(ROOT, "src/content/cms/translation-locks.json");
const LOCALES = ["uk", "en", "ru"];
const only = process.argv[2];

function confirmedText(lang) {
  return JSON.stringify({
    title: (lang?.title ?? "").trim(),
    specLine: (lang?.specLine ?? "").trim(),
    description: (lang?.description ?? "").trim(),
    viewGalleryLabel: (lang?.viewGalleryLabel ?? "").trim(),
  });
}
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function main() {
  const locks = JSON.parse(await fs.readFile(LOCKS_FILE, "utf8").catch(() => "{}"));
  const files = (await fs.readdir(CARS_DIR)).filter((f) => f.endsWith(".json") && !f.startsWith("."));

  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    if (only && only !== id) continue;
    const car = JSON.parse(await fs.readFile(path.join(CARS_DIR, file), "utf8"));
    const entry = {};
    for (const locale of LOCALES) {
      if (car[locale]?.reviewState === "confirmed") {
        entry[locale] = hash(confirmedText(car[locale]));
      }
    }
    if (Object.keys(entry).length > 0) locks[id] = entry;
    else delete locks[id];
    console.log(`✓ ${id}: ${Object.keys(entry).join(", ") || "(жодної перевіреної мови)"}`);
  }

  await fs.writeFile(LOCKS_FILE, `${JSON.stringify(locks, null, 2)}\n`, "utf8");
  console.log("\ntranslation-locks.json оновлено.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
