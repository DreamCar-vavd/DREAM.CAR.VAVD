import "server-only";
import { cookies } from "next/headers";
import { LocalFsStorage } from "./localFs";
import { GitHubStorage } from "./github";
import type { PanelStorage } from "./adapter";

export * from "./adapter";

export class NotConnectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConnectedError";
  }
}

/**
 * Picks the storage adapter for the current request.
 *  - not `github` mode -> local files (only meaningful in `next dev`)
 *  - `github` mode      -> GitHub API with the signed-in user's Keystatic
 *                          token; a missing token is a clear error, never a
 *                          silent local write that a redeploy would lose.
 */
export async function getStorage(): Promise<PanelStorage> {
  if (process.env.KEYSTATIC_STORAGE_KIND !== "github") return new LocalFsStorage();

  const token = (await cookies()).get("keystatic-gh-access-token")?.value;
  if (!token) {
    throw new NotConnectedError(
      "Ви не увійшли через GitHub. Відкрийте /keystatic, увійдіть, і поверніться сюди.",
    );
  }
  const owner = process.env.KEYSTATIC_GITHUB_REPO_OWNER;
  const repo = process.env.KEYSTATIC_GITHUB_REPO_NAME;
  if (!owner || !repo) {
    throw new NotConnectedError("Не налаштовано KEYSTATIC_GITHUB_REPO_OWNER / _NAME.");
  }
  // Panel writes content to the branch this deployment was built from
  // (Vercel sets VERCEL_GIT_COMMIT_REF), so a Preview publishes onto its own
  // branch — never main by accident. Override with PANEL_CONTENT_BRANCH.
  const branch =
    process.env.PANEL_CONTENT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "main";
  return new GitHubStorage({ owner, repo, branch, token });
}
