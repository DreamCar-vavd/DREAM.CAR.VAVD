/**
 * Which branch the panel reads and writes content on.
 *
 * On a Vercel git deployment `VERCEL_GIT_COMMIT_REF` is always set, so a Preview
 * publishes onto its own branch. Production is built from `main`, so it must name
 * its content branch explicitly with `PANEL_CONTENT_BRANCH`; locally there is no
 * deploy branch at all, so `PANEL_CONTENT_BRANCH` must be set (e.g. in `.env.local`).
 *
 * `main` is never a content branch, in any environment: an undefined or forbidden
 * branch must fail loudly. A silent default to main once made `/panel` look
 * connected while it was reading an empty main tree — see docs/PANEL-progress.md
 * (2026-09-08). On Production (`VERCEL_ENV=production`) only `panel/content` is
 * accepted, so a missing `PANEL_CONTENT_BRANCH` there can never fall back to the
 * deploy branch (`main`).
 */
export type ResolvedBranch = { branch: string } | { branch: null; reason: string };

/** The only content branch a Production deployment may read and write. */
export const PRODUCTION_CONTENT_BRANCH = "panel/content";

export const UNDEFINED_BRANCH_REASON =
  "Робоча гілка контенту не визначена. Локально задайте PANEL_CONTENT_BRANCH у " +
  ".env.local (напр. panel/content); на Vercel Preview її встановлює " +
  "VERCEL_GIT_COMMIT_REF. Панель навмисно не пише в main за замовчуванням.";

export const MAIN_BRANCH_REASON =
  "Гілка main не може бути робочою гілкою контенту: панель і Keystatic працюють лише " +
  "з окремою гілкою (на Production — panel/content). Перевірте PANEL_CONTENT_BRANCH.";

export const PRODUCTION_BRANCH_REASON =
  `На Production панель працює лише з гілкою ${PRODUCTION_CONTENT_BRANCH}. ` +
  "Перевірте значення PANEL_CONTENT_BRANCH для Production.";

export function resolveContentBranch(
  env: Record<string, string | undefined> = process.env,
): ResolvedBranch {
  const branch = env.PANEL_CONTENT_BRANCH?.trim() || env.VERCEL_GIT_COMMIT_REF?.trim();
  if (!branch) return { branch: null, reason: UNDEFINED_BRANCH_REASON };
  if (branch === "main") return { branch: null, reason: MAIN_BRANCH_REASON };
  if (env.VERCEL_ENV?.trim() === "production" && branch !== PRODUCTION_CONTENT_BRANCH) {
    return { branch: null, reason: PRODUCTION_BRANCH_REASON };
  }
  return { branch };
}
