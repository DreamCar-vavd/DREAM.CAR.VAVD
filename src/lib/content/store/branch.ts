/**
 * Which branch the panel reads and writes content on.
 *
 * On a Vercel git deployment `VERCEL_GIT_COMMIT_REF` is always set, so a Preview
 * publishes onto its own branch and never main by accident. Locally there is no
 * such variable, so `PANEL_CONTENT_BRANCH` must be set explicitly (e.g. in
 * `.env.local`).
 *
 * There is deliberately **no `"main"` fallback**: an undefined branch must fail
 * loudly. A silent default to main once made `/panel` look connected while it
 * was reading an empty main tree — see docs/PANEL-progress.md (2026-09-08).
 */
export type ResolvedBranch = { branch: string } | { branch: null; reason: string };

export const UNDEFINED_BRANCH_REASON =
  "Робоча гілка контенту не визначена. Локально задайте PANEL_CONTENT_BRANCH у " +
  ".env.local (напр. codex/admin-panel-spike); на Vercel її встановлює " +
  "VERCEL_GIT_COMMIT_REF. Панель навмисно не пише в main за замовчуванням.";

export function resolveContentBranch(
  env: Record<string, string | undefined> = process.env,
): ResolvedBranch {
  const branch = env.PANEL_CONTENT_BRANCH?.trim() || env.VERCEL_GIT_COMMIT_REF?.trim();
  return branch ? { branch } : { branch: null, reason: UNDEFINED_BRANCH_REASON };
}
