/**
 * Content gate — extra safety layer, runs in CI and locally:
 *
 *   npm run content:check
 *
 * Fails (exit 1) when a car marked `published` would be silently dropped from
 * the public build because of a content mistake:
 *   - a required UK / EN / RU field is empty,
 *   - a language is not confirmed,
 *   - a language's text changed after it was confirmed (translation-lock
 *     drift), or
 *   - the car has no photos.
 *
 * The static build already refuses to emit such cars (src/lib/content/carsGate
 * is the trusted boundary); this script surfaces the mistake on the PR instead
 * of leaving the owner to notice a car vanished.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  confirmedText,
  describeFailure,
  getCarGateFailures,
  LOCALES,
  type CmsCar,
  type TranslationLocks,
} from "../src/lib/content/carsGate";

const CARS_DIR = path.join(process.cwd(), "src/content/cms/cars");
const LOCKS_FILE = path.join(process.cwd(), "src/content/cms/translation-locks.json");
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function loadCars(): Promise<{ cars: CmsCar[]; locks: TranslationLocks }> {
  const locks: TranslationLocks = JSON.parse(
    await fs.readFile(LOCKS_FILE, "utf8").catch(() => "{}"),
  );
  const files = (await fs.readdir(CARS_DIR)).filter(
    (f) => f.endsWith(".json") && !f.startsWith("."),
  );
  const cars: CmsCar[] = [];
  for (const file of files) {
    const raw = JSON.parse(await fs.readFile(path.join(CARS_DIR, file), "utf8"));
    cars.push({ id: file.replace(/\.json$/, ""), ...raw });
  }
  return { cars, locks };
}

async function main() {
  const { cars, locks } = await loadCars();
  const problems: string[] = [];

  for (const car of cars) {
    // A confirmed locale must have a lock entry, otherwise "confirmed" is
    // unverifiable and drift can never be detected.
    for (const locale of LOCALES) {
      if (car[locale]?.reviewState === "confirmed" && locks[car.id]?.[locale] === undefined) {
        problems.push(
          `${car.id} / ${locale.toUpperCase()}: позначено «перевірено», але немає запису в translation-locks.json (запустіть npm run content:confirm)`,
        );
      }
    }

    if (car.publishState !== "published") continue;

    const blockers = getCarGateFailures(car, { locks, sha256 }).filter(
      (f) => f.kind !== "draft" && f.kind !== "sale-status-hidden",
    );
    for (const b of blockers) {
      problems.push(`${car.id}: ${describeFailure(b)}`);
    }
  }

  if (problems.length > 0) {
    console.error("✗ Перевірка контенту не пройдена:\n");
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      `\n${problems.length} проблем(и). Опубліковане авто з такою помилкою не з'явиться на сайті.`,
    );
    process.exit(1);
  }

  console.log(`✓ Перевірка контенту пройдена (${cars.length} авто).`);
  // Keep confirmedText referenced so the shared helper can't drift unnoticed.
  void confirmedText;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
