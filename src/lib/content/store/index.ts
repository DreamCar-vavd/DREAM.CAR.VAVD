import "server-only";
import { cookies } from "next/headers";
import { LocalFsStorage } from "./localFs";
import { GitHubStorage } from "./github";
import { resolveContentBranch } from "./branch";
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
  if (process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE_KIND !== "github") {
    // `PANEL_CONTENT_ROOT` — dev/test only: point the local adapter at a throwaway
    // copy of the content so a destructive UI check never touches the real repo.
    // Ignored in production (that path is always github mode).
    const root =
      process.env.NODE_ENV !== "production" && process.env.PANEL_CONTENT_ROOT
        ? process.env.PANEL_CONTENT_ROOT
        : undefined;
    return new LocalFsStorage(root ? { root } : {});
  }

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
  // Panel reads/writes on the branch this deployment was built from (Vercel sets
  // VERCEL_GIT_COMMIT_REF) or PANEL_CONTENT_BRANCH locally. No "main" fallback:
  // an undefined branch is a hard error, not a silent main target — see
  // ./branch.ts.
  const resolved = resolveContentBranch();
  if (resolved.branch === null) throw new NotConnectedError(resolved.reason);
  return new GitHubStorage({ owner, repo, branch: resolved.branch, token });
}
