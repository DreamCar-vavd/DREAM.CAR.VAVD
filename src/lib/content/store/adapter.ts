import type { CmsCar, ReviewState } from "../carsGate";

/**
 * Storage abstraction for the panel's writes. Two implementations:
 *  - LocalFsStorage  — reads/writes files in the repo (only `next dev`).
 *  - GitHubStorage   — reads/writes via the GitHub contents API using the
 *                      signed-in user's Keystatic token; the ONLY mode that
 *                      persists on a Vercel deployment.
 *
 * Every mutating call takes an `expectedVersion` (an opaque token — a git blob
 * SHA on GitHub, a content hash locally). If the stored version has moved, the
 * write is rejected with `ConflictError` and no partial state is written.
 *
 * The repository, branch and file paths are fixed by configuration, never
 * taken from a request, so a panel request cannot retarget them.
 */

export interface Snapshot {
  publishedAt: string;
  cars: CmsCar[];
}

export interface Versioned<T> {
  data: T;
  /** Opaque optimistic-concurrency token. "" means "file does not exist". */
  version: string;
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

  /** All working car records + a combined version of the whole working set. */
  readWorkingCars(): Promise<Versioned<CmsCar[]>>;

  readReview(): Promise<Versioned<ReviewState>>;
  readPublished(): Promise<Versioned<Snapshot>>;

  /** Rejects with ConflictError if the stored version != expectedVersion. */
  writeReview(data: ReviewState, expectedVersion: string): Promise<Versioned<ReviewState>>;
  writePublished(data: Snapshot, expectedVersion: string): Promise<Versioned<Snapshot>>;

  /**
   * Deployment state of the current content on the panel's branch. Local mode
   * has no deploy step ("n/a"). GitHub mode: branch HEAD commit -> the GitHub
   * Deployment Vercel created for it -> its latest status.
   */
  deployStatus(): Promise<DeployStatus>;
}

export type DeployStatus =
  | { state: "n/a" }
  | { state: "none" }
  | { state: "pending"; url?: string }
  | { state: "ready"; url?: string }
  | { state: "error"; url?: string };
