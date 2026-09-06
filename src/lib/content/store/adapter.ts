/**
 * Versioned file IO for the panel's writes. Two implementations:
 *  - LocalFsStorage  — reads/writes files in the repo (only `next dev`).
 *  - GitHubStorage   — reads/writes via the GitHub contents API using the
 *                      signed-in user's Keystatic token; the ONLY mode that
 *                      persists on a Vercel deployment.
 *
 * The adapter is deliberately dumb: it moves bytes for a FIXED allowlist of
 * paths and enforces optimistic concurrency. All content shaping, gating and
 * snapshot logic lives in panelStore (pure, testable). A path outside the
 * allowlist is rejected by the adapter itself, so a bug or a crafted request
 * upstream still cannot read or write arbitrary files.
 */

/** The only paths/dirs the panel is ever allowed to touch. */
export const ALLOWED_DIRS = ["src/content/cms/cars", "src/content/cms/gallery"] as const;
export const ALLOWED_FILES = [
  "src/content/cms/published.json",
  "src/content/cms/review-state.json",
] as const;
export type AllowedDir = (typeof ALLOWED_DIRS)[number];
export type AllowedFile = (typeof ALLOWED_FILES)[number];

export function assertAllowedDir(dir: string): asserts dir is AllowedDir {
  if (!(ALLOWED_DIRS as readonly string[]).includes(dir)) {
    throw new Error(`Panel storage: dir "${dir}" is not in the allowlist`);
  }
}
export function assertAllowedFile(file: string): asserts file is AllowedFile {
  if (!(ALLOWED_FILES as readonly string[]).includes(file)) {
    throw new Error(`Panel storage: file "${file}" is not in the allowlist`);
  }
}

export interface Versioned<T> {
  data: T;
  /** Opaque optimistic-concurrency token. "" means "does not exist". */
  version: string;
}

export interface DirEntry {
  name: string;
  text: string;
}

export class ConflictError extends Error {
  constructor(what: string) {
    super(
      `Дані «${what}» змінилися відколи ви відкрили сторінку. ` +
        `Можливо, хтось редагує паралельно або зміну вже застосовано. Оновіть сторінку.`,
    );
    this.name = "ConflictError";
  }
}

export interface PanelStorage {
  readonly mode: "local" | "github";

  /** `*.json` files (dotfiles excluded), sorted by name, + a combined version. */
  readDir(dir: AllowedDir): Promise<Versioned<DirEntry[]>>;

  readFile(file: AllowedFile): Promise<Versioned<string | null>>;

  /** Rejects with ConflictError if the stored version != expectedVersion. */
  writeFile(file: AllowedFile, text: string, expectedVersion: string): Promise<Versioned<string>>;

  /**
   * Deployment state of the current content on the panel's branch. Local mode
   * has no deploy step ("n/a"); GitHub mode reads the GitHub Deployment that
   * Vercel created for the branch HEAD.
   */
  deployStatus(): Promise<DeployStatus>;
}

export interface DeployMeta {
  url?: string;
  /** GitHub deployment `environment` (e.g. "Production", "Preview"). */
  environment?: string;
  /** true when the target is NOT the production site (a test branch). */
  isTest?: boolean;
}
export type DeployStatus =
  | { state: "n/a" }
  | { state: "none" }
  | ({ state: "unknown"; reason: string } & DeployMeta)
  | ({ state: "pending" } & DeployMeta)
  | ({ state: "ready" } & DeployMeta)
  | ({ state: "error" } & DeployMeta);
