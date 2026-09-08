import {
  ConflictError,
  StorageUnavailableError,
  WriteUncertainError,
  assertAllowedDir,
  assertAllowedFile,
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
  private async gh(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
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
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  private ref() {
    return encodeURIComponent(this.cfg.branch);
  }

  private async getContent(repoPath: string): Promise<{ text: string | null; sha: string }> {
    const { status, body } = await this.gh(
      this.repoUrl(`/contents/${repoPath}?ref=${this.ref()}`),
    );
    if (status === 404) return { text: null, sha: "" };
    if (status !== 200) throw new Error(`GitHub read ${repoPath} failed (${status})`);
    const f = body as { content: string; sha: string; encoding: string };
    return { text: f.encoding === "base64" ? b64decode(f.content) : f.content, sha: f.sha };
  }

  async readDir(dir: AllowedDir): Promise<Versioned<DirEntry[]>> {
    assertAllowedDir(dir);
    const { status, body } = await this.gh(this.repoUrl(`/contents/${dir}?ref=${this.ref()}`));
    if (status === 404) return { data: [], version: "" };
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

    let status: number;
    let body: unknown;
    try {
      ({ status, body } = await this.gh(this.repoUrl(`/contents/${file}`), {
        method: "PUT",
        body: JSON.stringify(payload),
      }));
    } catch (err) {
      // The PUT went out but no answer came back — the commit may or may not
      // have landed. Do NOT retry here (a blind retry could double-apply or
      // fight an optimistic-lock); make the caller reload and check.
      if (err instanceof StorageUnavailableError) throw new WriteUncertainError(what);
      throw err;
    }

    if (status === 409 || (status === 422 && expectedVersion)) {
      throw new ConflictError(what);
    }
    if (status !== 200 && status !== 201) throw new Error(`GitHub write ${file} failed (${status})`);
    return { data: text, version: (body as { content: { sha: string } }).content.sha };
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
      // A build-status probe that can't reach GitHub must not blank the whole
      // dashboard — the content already loaded. Report it separately.
      if (err instanceof StorageUnavailableError) {
        return { state: "unknown", reason: "не вдалося перевірити стан збірки — GitHub не відповів", isTest };
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
