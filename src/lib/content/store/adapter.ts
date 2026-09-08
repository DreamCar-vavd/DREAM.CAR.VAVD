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
export const ALLOWED_DIRS = [
  "src/content/cms/cars",
  "src/content/cms/gallery",
  "src/content/cms/services",
  "src/content/cms/contact",
  "src/content/cms/promos",
] as const;
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

/**
 * Base for "the storage backend gave us no usable answer" — unreachable, timed
 * out, or refused (401/403/429). A content READ that fails this way must
 * surface as an error, never as an empty list; a non-critical probe
 * (deployStatus) may safely degrade to "unknown".
 *
 * `retriable` = the same request could succeed a bit later (network blip, rate
 * limit). `false` = the caller must do something first (sign in, get access).
 */
export abstract class StorageBackendError extends Error {
  /** Same request may succeed shortly (blip / rate limit) vs needs user action. */
  abstract readonly retriable: boolean;
}

/**
 * The backend could not be reached, or did not answer within the adapter's
 * time budget. Retrying a read is safe.
 */
export class StorageUnavailableError extends StorageBackendError {
  readonly retriable = true;
  constructor(what: string) {
    super(
      `Не вдалося отримати дані з GitHub (${what}). Мережа або GitHub тимчасово ` +
        `недоступні — зачекайте хвилину й оновіть сторінку. Дані не втрачені.`,
    );
    this.name = "StorageUnavailableError";
  }
}

/**
 * GitHub answered **401** — the credentials are no longer valid: the sign-in
 * session ended or the token was revoked. Signing in again fixes it.
 */
export class StorageAuthError extends StorageBackendError {
  readonly retriable = false;
  constructor() {
    super(
      "Сесію GitHub завершено або відкликано. Відкрийте /keystatic й увійдіть знову.",
    );
    this.name = "StorageAuthError";
  }
}

/**
 * GitHub answered **403** and it is NOT a rate limit — most often the App's
 * permissions were narrowed or repo access was removed. Signing in again will
 * NOT grant a permission the token never had; the repo owner has to restore
 * access. `what` is a short, non-sensitive hint ("недостатньо прав" or a
 * neutral phrase for an unclassified 403) — never a raw GitHub body.
 */
export class StorageForbiddenError extends StorageBackendError {
  readonly retriable = false;
  constructor(what: string) {
    super(
      `GitHub відхилив запит: ${what}. Оновіть сторінку; якщо повторюється — ` +
        `перевірте з власником репозиторію права доступу застосунку.`,
    );
    this.name = "StorageForbiddenError";
  }
}

/**
 * GitHub is rate-limiting this token — a primary limit (HTTP 429, or 403 with
 * `x-ratelimit-remaining: 0`) or a secondary/abuse limit. Nothing is wrong with
 * the session — just wait. `waitHint` is a phrase built from `Retry-After` /
 * `x-ratelimit-reset` when GitHub gave a real time; when it did not, the
 * message must NOT invent one ("спробуйте пізніше").
 */
export class StorageRateLimitedError extends StorageBackendError {
  readonly retriable = true;
  constructor(waitHint?: string) {
    super(
      `GitHub тимчасово обмежив частоту запитів. ${waitHint ?? "Спробуйте пізніше."}`,
    );
    this.name = "StorageRateLimitedError";
  }
}

/**
 * A WRITE was sent but no response came back (timeout / dropped connection).
 * GitHub may or may not have applied the commit, so the caller must NOT retry
 * blindly: it has to reload and check the current state first.
 *
 * NOT the same as a write that never left: when the time budget is already
 * spent BEFORE the request goes out, nothing happened and the adapter throws
 * `StorageUnavailableError` (safe to retry) instead.
 */
export class WriteUncertainError extends Error {
  constructor(what: string) {
    super(
      `Відповідь від GitHub не надійшла, тому невідомо, чи збережено «${what}». ` +
        `Оновіть сторінку й перевірте поточний стан, перш ніж повторювати дію.`,
    );
    this.name = "WriteUncertainError";
  }
}

export interface PanelStorage {
  readonly mode: "local" | "github";

  /**
   * The git branch this storage reads/writes. `null` in local-file mode (no
   * branch concept). Never a silent "main" — see store/branch.ts.
   */
  readonly branch: string | null;

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
