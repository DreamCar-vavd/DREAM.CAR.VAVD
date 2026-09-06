import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { CmsCar, ReviewState } from "../carsGate";
import { CARS_WORKING_DIR, PUBLISHED_FILE, REVIEW_FILE } from "../paths";
import { coerceCar, coerceSnapshot } from "./coerce";
import {
  ConflictError,
  type DeployStatus,
  type PanelStorage,
  type Snapshot,
  type Versioned,
} from "./adapter";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

async function readFileOr(file: string, fallback: string): Promise<string> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return fallback;
  }
}

/** Atomic write: temp file + rename, so a crash never leaves half a file. */
async function writeAtomic(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, file);
}

export class LocalFsStorage implements PanelStorage {
  readonly mode = "local" as const;

  async readWorkingCars(): Promise<Versioned<CmsCar[]>> {
    let files: string[] = [];
    try {
      files = (await fs.readdir(CARS_WORKING_DIR))
        .filter((f) => f.endsWith(".json") && !f.startsWith("."))
        .sort();
    } catch {
      return { data: [], version: "" };
    }
    const cars: CmsCar[] = [];
    const parts: string[] = [];
    for (const file of files) {
      const text = await readFileOr(path.join(CARS_WORKING_DIR, file), "{}");
      parts.push(`${file}:${text}`);
      cars.push(coerceCar(file.replace(/\.json$/, ""), JSON.parse(text || "{}")));
    }
    cars.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    return { data: cars, version: files.length ? hash(parts.join("\n")) : "" };
  }

  async readReview(): Promise<Versioned<ReviewState>> {
    const text = await readFileOr(REVIEW_FILE, "");
    return { data: text ? (JSON.parse(text) as ReviewState) : {}, version: text ? hash(text) : "" };
  }

  async readPublished(): Promise<Versioned<Snapshot>> {
    const text = await readFileOr(PUBLISHED_FILE, "");
    return {
      data: coerceSnapshot(text ? JSON.parse(text) : {}),
      version: text ? hash(text) : "",
    };
  }

  private async writeGuarded<T>(
    file: string,
    what: string,
    data: T,
    expectedVersion: string,
  ): Promise<Versioned<T>> {
    const current = await readFileOr(file, "");
    const currentVersion = current ? hash(current) : "";
    if (currentVersion !== expectedVersion) throw new ConflictError(what);
    const text = `${JSON.stringify(data, null, 2)}\n`;
    await writeAtomic(file, text);
    return { data, version: hash(text) };
  }

  writeReview(data: ReviewState, expectedVersion: string) {
    return this.writeGuarded(REVIEW_FILE, "перевірки перекладів", data, expectedVersion);
  }
  writePublished(data: Snapshot, expectedVersion: string) {
    return this.writeGuarded(PUBLISHED_FILE, "опублікований знімок", data, expectedVersion);
  }

  async deployStatus(): Promise<DeployStatus> {
    // Local mode writes files directly; `next dev` HMR reflects them at once —
    // there is no build/deploy step to wait for.
    return { state: "n/a" };
  }
}
