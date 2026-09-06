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

export interface GitHubStorageConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  fetchImpl?: typeof fetch; // tests
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

  private repoUrl(rest: string) {
    return `${this.api}/repos/${this.cfg.owner}/${this.cfg.repo}${rest}`;
  }

  private async gh(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
    const res = await this.f(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...init?.headers,
      },
    });
    const text = await res.text();
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
    const payload: Record<string, unknown> = {
      message: `panel: update ${file}`,
      content: b64encode(text),
      branch: this.cfg.branch,
    };
    if (expectedVersion) payload.sha = expectedVersion; // present sha => optimistic lock
    const { status, body } = await this.gh(this.repoUrl(`/contents/${file}`), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (status === 409 || (status === 422 && expectedVersion)) {
      throw new ConflictError(file.endsWith("review-state.json") ? "перевірки перекладів" : "знімок");
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
