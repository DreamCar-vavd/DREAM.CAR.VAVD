import { createHash } from "node:crypto";
import {
  ConflictError,
  StorageAuthError,
  StorageBackendError,
  StorageForbiddenError,
  StorageRateLimitedError,
  StorageUnavailableError,
  WriteUncertainError,
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

export interface GitHubStorageConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  fetchImpl?: typeof fetch; // tests
  /** Per-HTTP-request ceiling — see DEFAULT_REQUEST_TIMEOUT_MS. */
  requestTimeoutMs?: number;
  /** Whole-instance ceiling across all sequential calls — see DEFAULT_OPERATION_TIMEOUT_MS. */
  operationTimeoutMs?: number;
}

const b64encode = (s: string) => Buffer.from(s, "utf8").toString("base64");
const b64decode = (s: string) => Buffer.from(s, "base64").toString("utf8");

/**
 * A single GitHub REST call that has not returned headers **and** body within
 * this window is on a broken connection, not merely a slow one — GitHub's
 * contents API p99 is well under a second. Short so a dropped TCP connection
 * surfaces as an error in seconds instead of stalling a server render for
 * minutes (an unbounded `fetch` once hung `/panel` for ~10 min after an
 * `ECONNRESET`).
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

/**
 * Ceiling for **all** the sequential requests one page render makes through a
 * single storage instance: `readDir` × 5 kinds + 2 files + `deployStatus`,
 * which is ~40 requests when a directory holds many files. 20s comfortably
 * fits a healthy render (tens–hundreds of ms per call) yet guarantees neither
 * the serverless function nor the waiting person hangs longer than that when
 * GitHub is degraded. A fresh instance is created per request (`getStorage`),
 * so this budget resets each request.
 */
const DEFAULT_OPERATION_TIMEOUT_MS = 20_000;

export class GitHubStorage implements PanelStorage {
  readonly mode = "github" as const;
  readonly branch: string;
  private readonly cfg: GitHubStorageConfig;
  private readonly f: typeof fetch;
  private readonly api = "https://api.github.com";
  private readonly requestTimeoutMs: number;
  /** Absolute time (ms epoch) after which no further request may start. */
  private readonly deadline: number;

  constructor(cfg: GitHubStorageConfig) {
    this.cfg = cfg;
    this.branch = cfg.branch;
    this.f = cfg.fetchImpl ?? fetch;
    this.requestTimeoutMs = cfg.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.deadline = Date.now() + (cfg.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS);
  }

  private repoUrl(rest: string) {
    return `${this.api}/repos/${this.cfg.owner}/${this.cfg.repo}${rest}`;
  }

  /**
   * One GitHub call, bounded twice: by `requestTimeoutMs` and by the remaining
   * whole-instance budget, whichever is smaller. The abort signal covers both
   * waiting for the response and reading its body, so a stalled body stream
   * cannot hang past the deadline. The timer is always cleared (success or
   * failure) so no handle leaks. A transport failure (timeout or dropped
   * connection) throws `StorageUnavailableError`; a real HTTP status — 4xx/5xx
   * included — is returned for the caller to interpret.
   */
  private async gh(
    url: string,
    init?: RequestInit,
  ): Promise<{ status: number; body: unknown; headers: Headers }> {
    const remaining = this.deadline - Date.now();
    if (remaining <= 0) {
      throw new StorageUnavailableError("перевищено загальний ліміт часу на звернення до GitHub");
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.min(this.requestTimeoutMs, remaining));
    let res: Response;
    let text: string;
    try {
      res = await this.f(url, {
        ...init,
        signal: ac.signal,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${this.cfg.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...init?.headers,
        },
      });
      text = await res.text();
    } catch {
      throw new StorageUnavailableError(
        ac.signal.aborted ? "GitHub не відповів вчасно" : "з'єднання з GitHub обірвалося",
      );
    } finally {
      clearTimeout(timer);
    }
    return {
      status: res.status,
      body: text ? JSON.parse(text) : null,
      headers: res.headers ?? new Headers(),
    };
  }

  private ref() {
    return encodeURIComponent(this.cfg.branch);
  }

  /** Milliseconds left in the whole-instance budget (may be <= 0). */
  private remainingBudget(): number {
    return this.deadline - Date.now();
  }

  /**
   * A phrase like "Спробуйте приблизно за 3 хв." built ONLY from a real
   * `Retry-After` (seconds) or `x-ratelimit-reset` (unix seconds) header.
   * Returns undefined when GitHub gave no usable time — the caller must then
   * not invent one.
   */
  private static rateLimitWaitHint(headers: Headers): string | undefined {
    const say = (seconds: number) =>
      seconds >= 90
        ? `Спробуйте приблизно за ${Math.round(seconds / 60)} хв.`
        : `Спробуйте приблизно за ${Math.max(1, Math.ceil(seconds))} с.`;

    const retryAfter = Number(headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) return say(retryAfter);

    const reset = Number(headers.get("x-ratelimit-reset")); // unix seconds
    if (Number.isFinite(reset) && reset > 0) {
      const secondsLeft = (reset * 1000 - Date.now()) / 1000;
      if (secondsLeft > 0) return say(secondsLeft);
    }
    return undefined;
  }

  /**
   * Classify a 401/403/429 by GitHub's documented signals and throw the
   * matching error. Never forwards the raw body. No-op for any other status.
   *  - 401                         -> StorageAuthError    (sign in again)
   *  - 429, or 403 + rate-limit signal -> StorageRateLimitedError (wait; a real
   *      Retry-After / reset time is put in the message, otherwise none)
   *  - 403 + "not accessible"/perm -> StorageForbiddenError (access changed)
   *  - 403, nothing conclusive     -> StorageForbiddenError, neutral wording
   */
  private static rejectIfUnauthorized(
    status: number,
    headers: Headers,
    body: unknown,
  ): void {
    if (status === 401) throw new StorageAuthError();
    if (status !== 403 && status !== 429) return;

    const msg = String((body as { message?: unknown })?.message ?? "").toLowerCase();
    const rateLimited =
      status === 429 ||
      headers.get("x-ratelimit-remaining") === "0" ||
      headers.has("retry-after") ||
      /\brate limit\b|secondary rate|abuse/.test(msg);
    if (rateLimited) {
      throw new StorageRateLimitedError(GitHubStorage.rateLimitWaitHint(headers));
    }

    if (/not accessible|must have|permission|forbidden|denied/.test(msg)) {
      throw new StorageForbiddenError("недостатньо прав доступу");
    }
    throw new StorageForbiddenError("доступ відхилено (403)");
  }

  private async getContent(repoPath: string): Promise<{ text: string | null; sha: string }> {
    const { status, body, headers } = await this.gh(
      this.repoUrl(`/contents/${repoPath}?ref=${this.ref()}`),
    );
    if (status === 404) return { text: null, sha: "" };
    GitHubStorage.rejectIfUnauthorized(status, headers, body);
    if (status !== 200) throw new Error(`GitHub read ${repoPath} failed (${status})`);
    const f = body as { content?: string; sha: string; encoding?: string };
    if (f.encoding === "base64" && f.content) return { text: b64decode(f.content), sha: f.sha };
    if (f.encoding !== "none" && typeof f.content === "string") return { text: f.content, sha: f.sha };
    // >1 MB: contents API drops `content` — read it from the blob API by SHA.
    const blob = await this.gh(this.repoUrl(`/git/blobs/${f.sha}`));
    GitHubStorage.rejectIfUnauthorized(blob.status, blob.headers, blob.body);
    if (blob.status !== 200) throw new Error(`GitHub blob ${repoPath} read failed (${blob.status})`);
    const b = blob.body as { content: string };
    return { text: b64decode(b.content), sha: f.sha };
  }

  async readDir(dir: AllowedDir): Promise<Versioned<DirEntry[]>> {
    assertAllowedDir(dir);
    const { status, body, headers } = await this.gh(
      this.repoUrl(`/contents/${dir}?ref=${this.ref()}`),
    );
    if (status === 404) return { data: [], version: "" };
    GitHubStorage.rejectIfUnauthorized(status, headers, body);
    if (status !== 200) throw new Error(`GitHub list ${dir} failed (${status})`);
    const files = (body as { name: string; sha: string; type: string }[])
      .filter((e) => e.type === "file" && e.name.endsWith(".json") && !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name));
    const entries: DirEntry[] = [];
    for (const e of files) {
      const c = await this.getContent(`${dir}/${e.name}`);
      entries.push({ name: e.name, text: c.text ?? "{}" });
    }
    // Version = tree of blob SHAs; changes iff any file in the dir changes.
    return { data: entries, version: files.map((e) => `${e.name}:${e.sha}`).join("|") };
  }

  async readFile(file: AllowedFile): Promise<Versioned<string | null>> {
    assertAllowedFile(file);
    const c = await this.getContent(file);
    return { data: c.text, version: c.sha };
  }

  async writeFile(
    file: AllowedFile,
    text: string,
    expectedVersion: string,
  ): Promise<Versioned<string>> {
    assertAllowedFile(file);
    const what = file.endsWith("review-state.json") ? "перевірки перекладів" : "знімок";
    const payload: Record<string, unknown> = {
      message: `panel: update ${file}`,
      content: b64encode(text),
      branch: this.cfg.branch,
    };
    if (expectedVersion) payload.sha = expectedVersion; // present sha => optimistic lock

    // Budget already spent BEFORE the request goes out: nothing was sent, so
    // this is a plain "unavailable, retry is safe" — NOT write-uncertain.
    if (this.remainingBudget() <= 0) {
      throw new StorageUnavailableError("бюджет часу вичерпано до відправлення запиту на запис");
    }

    let status: number;
    let body: unknown;
    let headers: Headers;
    try {
      ({ status, body, headers } = await this.gh(this.repoUrl(`/contents/${file}`), {
        method: "PUT",
        body: JSON.stringify(payload),
      }));
    } catch (err) {
      // We got past the pre-flight check, so the PUT was on its way when it
      // failed — the commit may or may not have landed. Do NOT retry here (a
      // blind retry could double-apply or fight the optimistic lock); make the
      // caller reload and check.
      if (err instanceof StorageUnavailableError) throw new WriteUncertainError(what);
      throw err;
    }

    if (status === 409 || (status === 422 && expectedVersion)) {
      throw new ConflictError(what);
    }
    // GitHub answered with a definite refusal — the commit did NOT happen, so
    // this is auth/permission/rate-limit, not "write uncertain".
    GitHubStorage.rejectIfUnauthorized(status, headers, body);
    if (status !== 200 && status !== 201) throw new Error(`GitHub write ${file} failed (${status})`);
    return { data: text, version: (body as { content: { sha: string } }).content.sha };
  }

  // ---- published-media store (see adapter.ts) --------------------------------

  /** git blob SHA-1 of `bytes` — lets us skip a PUT for a byte-identical file. */
  private static blobSha(bytes: Uint8Array): string {
    return createHash("sha1")
      .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
      .update(bytes)
      .digest("hex");
  }

  private async getRaw(repoPath: string): Promise<{ bytes: Uint8Array; sha: string } | null> {
    const { status, body, headers } = await this.gh(
      this.repoUrl(`/contents/${repoPath}?ref=${this.ref()}`),
    );
    if (status === 404) return null;
    GitHubStorage.rejectIfUnauthorized(status, headers, body);
    if (status !== 200) throw new Error(`GitHub read ${repoPath} failed (${status})`);
    const f = body as { content?: string; sha: string; encoding?: string; size?: number };
    // The contents API omits `content` for files over 1 MB (`encoding: "none"`).
    // Photos routinely exceed that, so fall back to the blob API by SHA — it
    // serves base64 up to 100 MB. Without this a big photo reads as 0 bytes:
    // "modified" forever, and a publish would freeze an EMPTY copy.
    if (f.encoding === "base64" && f.content) {
      return { bytes: new Uint8Array(Buffer.from(f.content, "base64")), sha: f.sha };
    }
    const blob = await this.gh(this.repoUrl(`/git/blobs/${f.sha}`));
    GitHubStorage.rejectIfUnauthorized(blob.status, blob.headers, blob.body);
    if (blob.status !== 200) throw new Error(`GitHub blob ${repoPath} read failed (${blob.status})`);
    const b = blob.body as { content: string; encoding: string };
    return { bytes: new Uint8Array(Buffer.from(b.content, "base64")), sha: f.sha };
  }

  async readMedia(repoPath: string): Promise<Uint8Array | null> {
    assertReadableMediaPath(repoPath);
    return (await this.getRaw(repoPath))?.bytes ?? null;
  }

  async putPublishedMedia(repoPath: string, bytes: Uint8Array): Promise<void> {
    assertPublishedMediaPath(repoPath);
    const existing = await this.getRaw(repoPath);
    if (existing && existing.sha === GitHubStorage.blobSha(bytes)) return; // already there
    const payload: Record<string, unknown> = {
      message: `panel: publish media ${repoPath}`,
      content: Buffer.from(bytes).toString("base64"),
      branch: this.cfg.branch,
    };
    if (existing) payload.sha = existing.sha;
    let status: number;
    let body: unknown;
    let headers: Headers;
    try {
      ({ status, body, headers } = await this.gh(this.repoUrl(`/contents/${repoPath}`), {
        method: "PUT",
        body: JSON.stringify(payload),
      }));
    } catch (err) {
      // The PUT was on its way when the connection failed — the media blob may
      // or may not have landed. Content-addressed, so a retry is safe, but the
      // caller must not assume the publish succeeded.
      if (err instanceof StorageUnavailableError) throw new WriteUncertainError("копію фото");
      throw err;
    }
    if (status === 409 || (status === 422 && existing)) throw new WriteUncertainError("копію фото");
    GitHubStorage.rejectIfUnauthorized(status, headers, body);
    if (status !== 200 && status !== 201) {
      throw new StorageUnavailableError(`запис копії фото не вдався (${status})`);
    }
  }

  async listPublishedMedia(dirPath: string): Promise<string[]> {
    assertPublishedMediaDir(dirPath);
    const { status, body, headers } = await this.gh(
      this.repoUrl(`/contents/${dirPath}?ref=${this.ref()}`),
    );
    if (status === 404) return [];
    GitHubStorage.rejectIfUnauthorized(status, headers, body);
    if (status !== 200 || !Array.isArray(body)) return [];
    return (body as { name: string; type: string }[])
      .filter((e) => e.type === "file" && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  }

  async deletePublishedMedia(repoPath: string): Promise<void> {
    assertPublishedMediaPath(repoPath);
    const existing = await this.getRaw(repoPath);
    if (!existing) return; // already gone
    const { status, body, headers } = await this.gh(this.repoUrl(`/contents/${repoPath}`), {
      method: "DELETE",
      body: JSON.stringify({
        message: `panel: drop unreferenced media ${repoPath}`,
        sha: existing.sha,
        branch: this.cfg.branch,
      }),
    });
    if (status === 404 || status === 409 || status === 422) return; // raced away — fine
    GitHubStorage.rejectIfUnauthorized(status, headers, body);
    if (status !== 200) throw new Error(`GitHub delete ${repoPath} failed (${status})`);
  }

  private async branchHeadSha(): Promise<string | null> {
    const { status, body } = await this.gh(this.repoUrl(`/commits/${this.ref()}?per_page=1`));
    return status === 200 ? (body as { sha: string }).sha : null;
  }

  async deployStatus(): Promise<DeployStatus> {
    const isTest = this.cfg.branch !== "main";
    try {
      return await this.deployStatusInner(isTest);
    } catch (err) {
      // A build-status probe that can't get a usable answer from GitHub
      // (unreachable, timed out, or refused) must not blank the whole
      // dashboard — the content already loaded. Report it separately as
      // "unknown"; it is never rendered as a successful build.
      if (err instanceof StorageBackendError) {
        return { state: "unknown", reason: "не вдалося перевірити стан збірки", isTest };
      }
      throw err;
    }
  }

  private async deployStatusInner(isTest: boolean): Promise<DeployStatus> {
    const sha = await this.branchHeadSha();
    if (!sha) return { state: "unknown", reason: "не вдалося визначити останній коміт гілки", isTest };

    // Newest deployment for this exact commit (there can be several).
    const list = await this.gh(this.repoUrl(`/deployments?sha=${sha}&per_page=10`));
    if (list.status === 403) {
      return {
        state: "unknown",
        reason: "немає доступу до стану deployment (потрібен дозвіл App «Deployments: Read») або обмеження GitHub API",
        isTest,
      };
    }
    if (list.status !== 200 || !Array.isArray(list.body) || list.body.length === 0) {
      return { state: "none" };
    }
    const deployments = (list.body as { id: number; environment?: string; created_at: string }[])
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const d = deployments[0];
    const environment = d.environment;

    const statuses = await this.gh(this.repoUrl(`/deployments/${d.id}/statuses?per_page=1`));
    if (statuses.status === 403) {
      return { state: "unknown", reason: "немає доступу до статусів deployment", environment, isTest };
    }
    if (statuses.status !== 200 || !Array.isArray(statuses.body) || statuses.body.length === 0) {
      return { state: "pending", environment, isTest };
    }
    const s = statuses.body[0] as { state: string; environment_url?: string; target_url?: string };
    const url = s.environment_url || s.target_url;
    if (s.state === "success") return { state: "ready", url, environment, isTest };
    if (s.state === "error" || s.state === "failure") return { state: "error", url, environment, isTest };
    return { state: "pending", url, environment, isTest };
  }
}
