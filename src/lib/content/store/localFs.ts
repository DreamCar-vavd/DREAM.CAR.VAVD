import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
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
} from "./adapter";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const abs = (rel: string) => path.join(process.cwd(), rel);

async function readOr(file: string, fallback: string | null): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return fallback;
  }
}

export class LocalFsStorage implements PanelStorage {
  readonly mode = "local" as const;

  async readDir(dir: AllowedDir): Promise<Versioned<DirEntry[]>> {
    assertAllowedDir(dir);
    let names: string[] = [];
    try {
      names = (await fs.readdir(abs(dir)))
        .filter((f) => f.endsWith(".json") && !f.startsWith("."))
        .sort();
    } catch {
      return { data: [], version: "" };
    }
    const entries: DirEntry[] = [];
    for (const name of names) {
      entries.push({ name, text: (await readOr(path.join(abs(dir), name), "{}")) ?? "{}" });
    }
    return {
      data: entries,
      version: names.length ? hash(entries.map((e) => `${e.name}:${e.text}`).join("\n")) : "",
    };
  }

  async readFile(file: AllowedFile): Promise<Versioned<string | null>> {
    assertAllowedFile(file);
    const text = await readOr(abs(file), null);
    return { data: text, version: text ? hash(text) : "" };
  }

  async writeFile(
    file: AllowedFile,
    text: string,
    expectedVersion: string,
  ): Promise<Versioned<string>> {
    assertAllowedFile(file);
    const current = await readOr(abs(file), null);
    if ((current ? hash(current) : "") !== expectedVersion) {
      throw new ConflictError(file.endsWith("review-state.json") ? "перевірки перекладів" : "знімок");
    }
    await fs.mkdir(path.dirname(abs(file)), { recursive: true });
    const tmp = `${abs(file)}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, text, "utf8");
    await fs.rename(tmp, abs(file)); // atomic
    return { data: text, version: hash(text) };
  }

  async deployStatus(): Promise<DeployStatus> {
    return { state: "n/a" };
  }
}
