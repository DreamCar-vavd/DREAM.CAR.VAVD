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

async function readOr(file: string, fallback: string | null): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return fallback;
  }
}

export interface LocalFsStorageOptions {
  /**
   * Project root every repo-relative path is resolved against. Defaults to
   * `process.cwd()` (the running app). Tests pass a throwaway temp dir so a
   * destructive check (freeze / cleanup / delete) can never reach real content.
   */
  root?: string;
}

export class LocalFsStorage implements PanelStorage {
  readonly mode = "local" as const;
  readonly branch = null;
  private readonly root: string;

  constructor(opts: LocalFsStorageOptions = {}) {
    this.root = path.resolve(opts.root ?? process.cwd());
  }

  /** Repo-relative -> absolute, under this instance's root. */
  private abs(rel: string): string {
    return path.join(this.root, rel);
  }

  /**
   * Absolute path for a WRITE / DELETE target, hard-checked to resolve INSIDE
   * `this.root/public/images/cms/` (or the given `subtree`). `..`, an absolute
   * `repoPath`, or anything that would land outside throws — a second line of
   * defence behind the `assert*MediaPath` regexes, and the reason a stray path
   * can never delete real card folders.
   */
  private mutablePath(repoPath: string, subtree = "public/images/cms"): string {
    const base = path.join(this.root, subtree) + path.sep;
    const full = path.resolve(this.root, repoPath);
    if (full !== base.slice(0, -1) && !full.startsWith(base)) {
      throw new Error(`LocalFsStorage: refusing to touch "${repoPath}" — outside ${subtree}`);
    }
    return full;
  }

  async readDir(dir: AllowedDir, _atSha?: string): Promise<Versioned<DirEntry[]>> {
    void _atSha; // local mode: single writer, no branch to pin to
    assertAllowedDir(dir);
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.abs(dir)))
        .filter((f) => f.endsWith(".json") && !f.startsWith("."))
        .sort();
    } catch {
      return { data: [], version: "" };
    }
    const entries: DirEntry[] = [];
    for (const name of names) {
      entries.push({ name, text: (await readOr(path.join(this.abs(dir), name), "{}")) ?? "{}" });
    }
    return {
      data: entries,
      version: names.length ? hash(entries.map((e) => `${e.name}:${e.text}`).join("\n")) : "",
    };
  }

  async readFile(file: AllowedFile, _atSha?: string): Promise<Versioned<string | null>> {
    void _atSha; // local mode: single writer, no branch to pin to
    assertAllowedFile(file);
    const text = await readOr(this.abs(file), null);
    return { data: text, version: text ? hash(text) : "" };
  }

  async writeFile(
    file: AllowedFile,
    text: string,
    expectedVersion: string,
  ): Promise<Versioned<string>> {
    assertAllowedFile(file);
    const target = this.mutablePath(file, "src/content/cms");
    const current = await readOr(target, null);
    if ((current ? hash(current) : "") !== expectedVersion) {
      throw new ConflictError(file.endsWith("review-state.json") ? "перевірки перекладів" : "знімок");
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, text, "utf8");
    await fs.rename(tmp, target); // atomic
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
    const root = this.abs("public/images/cms");
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
          out.set(path.relative(this.root, full), {
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
      return new Uint8Array(await fs.readFile(this.abs(repoPath)));
    } catch {
      return null;
    }
  }

  async putPublishedMedia(repoPath: string, bytes: Uint8Array): Promise<void> {
    assertPublishedMediaPath(repoPath);
    const target = this.mutablePath(repoPath);
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
      return (await fs.readdir(this.abs(dirPath))).filter((n) => !n.startsWith(".")).sort();
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
      assertPublishedMediaPath(p); // regex: …/<slug>/_pub/<hex>.<ext>
      const target = this.mutablePath(p); // + resolved-path containment check
      const existed = await fs
        .stat(target)
        .then((s) => s.isFile())
        .catch(() => false);
      await fs.rm(target, { force: true }); // single file, never a directory
      out.push({ path: p, outcome: existed ? "deleted" : "already-absent" });
    }
    return out;
  }
}
