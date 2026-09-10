import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  ConflictError,
  assertAllowedDir,
  assertAllowedFile,
  assertPublishedMediaDir,
  assertPublishedMediaPath,
  assertReadableMediaPath,
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
  readonly branch = null;

  async readDir(dir: AllowedDir, _atSha?: string): Promise<Versioned<DirEntry[]>> {
    void _atSha; // local mode: single writer, no branch to pin to
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

  async readFile(file: AllowedFile, _atSha?: string): Promise<Versioned<string | null>> {
    void _atSha; // local mode: single writer, no branch to pin to
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

  async headSha(): Promise<string | null> {
    return null; // local files: no branch, no concurrency to guard against
  }

  /** git blob id of `bytes` — matches what GitHub reports in a tree. */
  private static blobId(bytes: Buffer): string {
    return createHash("sha1")
      .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
      .update(bytes)
      .digest("hex");
  }

  async mediaIndex(_atSha?: string): Promise<Map<string, { id: string; size: number }>> {
    void _atSha; // local mode: single writer, no branch to pin to
    const root = abs("public/images/cms");
    const out = new Map<string, { id: string; size: number }>();
    const walk = async (dir: string): Promise<void> => {
      let entries: import("node:fs").Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          await walk(full);
        } else if (e.isFile()) {
          const bytes = await fs.readFile(full);
          out.set(path.relative(process.cwd(), full), {
            id: LocalFsStorage.blobId(bytes),
            size: bytes.length,
          });
        }
      }
    };
    await walk(root);
    return out;
  }

  async readMedia(repoPath: string): Promise<Uint8Array | null> {
    assertReadableMediaPath(repoPath);
    try {
      return new Uint8Array(await fs.readFile(abs(repoPath)));
    } catch {
      return null;
    }
  }

  async putPublishedMedia(repoPath: string, bytes: Uint8Array): Promise<void> {
    assertPublishedMediaPath(repoPath);
    const target = abs(repoPath);
    try {
      const existing = await fs.readFile(target);
      if (Buffer.from(bytes).equals(existing)) return; // content-addressed no-op
    } catch {
      /* not there yet */
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, target);
  }

  async listPublishedMedia(dirPath: string): Promise<string[]> {
    assertPublishedMediaDir(dirPath);
    try {
      return (await fs.readdir(abs(dirPath))).filter((n) => !n.startsWith(".")).sort();
    } catch {
      return [];
    }
  }

  async deletePublishedMediaBatch(
    paths: string[],
    expectedHeadSha: string | null,
  ): Promise<{ path: string; outcome: "deleted" | "already-absent" }[]> {
    void expectedHeadSha; // local files: no branch to guard, and `next dev` is single-writer.
    const out: { path: string; outcome: "deleted" | "already-absent" }[] = [];
    for (const p of paths) {
      assertPublishedMediaPath(p);
      const existed = await fs
        .stat(abs(p))
        .then(() => true)
        .catch(() => false);
      await fs.rm(abs(p), { force: true });
      out.push({ path: p, outcome: existed ? "deleted" : "already-absent" });
    }
    return out;
  }
}
