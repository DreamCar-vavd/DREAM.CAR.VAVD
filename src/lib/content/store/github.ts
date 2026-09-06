import type { CmsCar, ReviewState } from "../carsGate";
import { coerceCar, coerceSnapshot } from "./coerce";
import {
  ConflictError,
  type DeployStatus,
  type PanelStorage,
  type Snapshot,
  type Versioned,
} from "./adapter";

/**
 * Fixed content paths — NEVER derived from a request, so a panel call can't
 * retarget the repo, branch or a different file.
 */
const CARS_DIR = "src/content/cms/cars";
const PUBLISHED_PATH = "src/content/cms/published.json";
const REVIEW_PATH = "src/content/cms/review-state.json";

export interface GitHubStorageConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  /** for tests */
  fetchImpl?: typeof fetch;
}

const b64encode = (s: string) => Buffer.from(s, "utf8").toString("base64");
const b64decode = (s: string) => Buffer.from(s, "base64").toString("utf8");

export class GitHubStorage implements PanelStorage {
  readonly mode = "github" as const;
  private readonly cfg: GitHubStorageConfig;
  private readonly f: typeof fetch;
  private readonly api = "https://api.github.com";

  constructor(cfg: GitHubStorageConfig) {
    this.cfg = cfg;
    this.f = cfg.fetchImpl ?? fetch;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private repoUrl(rest: string) {
    return `${this.api}/repos/${this.cfg.owner}/${this.cfg.repo}${rest}`;
  }

  private async ghJson(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
    const res = await this.f(url, { ...init, headers: { ...this.headers(), ...init?.headers } });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  private async readJsonFile<T>(path: string, fallback: T): Promise<Versioned<T>> {
    const { status, body } = await this.ghJson(
      this.repoUrl(`/contents/${path}?ref=${encodeURIComponent(this.cfg.branch)}`),
    );
    if (status === 404) return { data: fallback, version: "" };
    if (status !== 200) throw new Error(`GitHub read ${path} failed (${status})`);
    const file = body as { content: string; sha: string; encoding: string };
    const raw = file.encoding === "base64" ? b64decode(file.content) : file.content;
    return { data: (raw ? JSON.parse(raw) : fallback) as T, version: file.sha };
  }

  private async writeJsonFile<T>(
    path: string,
    what: string,
    data: T,
    expectedVersion: string,
  ): Promise<Versioned<T>> {
    const text = `${JSON.stringify(data, null, 2)}\n`;
    const payload: Record<string, unknown> = {
      message: `panel: update ${path}`,
      content: b64encode(text),
      branch: this.cfg.branch,
    };
    // Omitting `sha` means "create". Present `sha` means "update this exact
    // blob" — GitHub returns 409 if it moved (optimistic concurrency).
    if (expectedVersion) payload.sha = expectedVersion;

    const { status, body } = await this.ghJson(this.repoUrl(`/contents/${path}`), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (status === 409 || (status === 422 && expectedVersion)) throw new ConflictError(what);
    if (status !== 200 && status !== 201) {
      throw new Error(`GitHub write ${path} failed (${status})`);
    }
    const res = body as { content: { sha: string } };
    return { data, version: res.content.sha };
  }

  async readWorkingCars(): Promise<Versioned<CmsCar[]>> {
    const { status, body } = await this.ghJson(
      this.repoUrl(`/contents/${CARS_DIR}?ref=${encodeURIComponent(this.cfg.branch)}`),
    );
    if (status === 404) return { data: [], version: "" };
    if (status !== 200) throw new Error(`GitHub list ${CARS_DIR} failed (${status})`);
    const entries = (body as { name: string; sha: string; type: string }[])
      .filter((e) => e.type === "file" && e.name.endsWith(".json") && !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name));

    const cars: CmsCar[] = [];
    for (const e of entries) {
      const file = await this.readJsonFile<Record<string, unknown>>(`${CARS_DIR}/${e.name}`, {});
      cars.push(coerceCar(e.name.replace(/\.json$/, ""), file.data));
    }
    cars.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    // Version = the tree of blob SHAs; changes iff any working file changes.
    return { data: cars, version: entries.map((e) => `${e.name}:${e.sha}`).join("|") };
  }

  readReview() {
    return this.readJsonFile<ReviewState>(REVIEW_PATH, {});
  }
  readPublished() {
    return this.readJsonFile<Record<string, unknown>>(PUBLISHED_PATH, {}).then((v) => ({
      data: coerceSnapshot(v.data),
      version: v.version,
    }));
  }
  writeReview(data: ReviewState, expectedVersion: string) {
    return this.writeJsonFile(REVIEW_PATH, "перевірки перекладів", data, expectedVersion);
  }
  writePublished(data: Snapshot, expectedVersion: string) {
    return this.writeJsonFile(PUBLISHED_PATH, "опублікований знімок", data, expectedVersion);
  }

  private async branchHeadSha(): Promise<string | null> {
    const { status, body } = await this.ghJson(
      this.repoUrl(`/commits/${encodeURIComponent(this.cfg.branch)}?per_page=1`),
    );
    return status === 200 ? (body as { sha: string }).sha : null;
  }

  /** Vercel creates a GitHub Deployment per commit; read its latest status. */
  async deployStatus(): Promise<DeployStatus> {
    const commitSha = await this.branchHeadSha();
    if (!commitSha) return { state: "none" };
    const list = await this.ghJson(this.repoUrl(`/deployments?sha=${commitSha}&per_page=1`));
    if (list.status !== 200 || !Array.isArray(list.body) || list.body.length === 0) {
      return { state: "none" };
    }
    const deploymentId = (list.body[0] as { id: number }).id;
    const statuses = await this.ghJson(
      this.repoUrl(`/deployments/${deploymentId}/statuses?per_page=1`),
    );
    if (statuses.status !== 200 || !Array.isArray(statuses.body) || statuses.body.length === 0) {
      return { state: "pending" };
    }
    const s = statuses.body[0] as { state: string; environment_url?: string; target_url?: string };
    const url = s.environment_url || s.target_url;
    if (["success"].includes(s.state)) return { state: "ready", url };
    if (["error", "failure"].includes(s.state)) return { state: "error", url };
    return { state: "pending", url };
  }
}
