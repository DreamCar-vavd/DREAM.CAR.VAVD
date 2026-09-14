import type { PanelStorage } from "./store/adapter";
import { NotConnectedError, StorageAuthError, StorageForbiddenError } from "./store/adapter";
import type { SiteContent } from "./siteContent";

export interface DraftAccessDeps {
  getStorage: () => Promise<PanelStorage>;
}

export type DraftAccessResult =
  | { ok: true; storage: PanelStorage }
  | { ok: false; content: SiteContent };

/**
 * The pure, Next.js-free half of the draft-preview access check: given a way
 * to obtain storage and the already-computed PUBLISHED content (the fail-
 * closed fallback), decide whether this render may show the draft.
 *
 * Split out of `readSiteContent` specifically so a test can inject a
 * `getStorage`/`assertWriteAccess` spy and assert on the ordering and on
 * every failure mode, the same way `lib/leads/accessGate.ts` does for
 * `/panel/leads` — `readSiteContent` itself can't be unit-tested directly
 * because it also calls `next/headers` (`draftMode()`), which only works
 * inside a real Next.js request.
 */
export async function resolveDraftAccess(
  deps: DraftAccessDeps,
  published: SiteContent,
): Promise<DraftAccessResult> {
  try {
    const storage = await deps.getStorage();
    await storage.assertWriteAccess();
    return { ok: true, storage };
  } catch (err) {
    if (err instanceof NotConnectedError || err instanceof StorageAuthError) {
      return {
        ok: false,
        content: { ...published, draftError: "Сесію завершено або відкликано — перегляд чернетки недоступний." },
      };
    }
    if (err instanceof StorageForbiddenError) {
      return { ok: false, content: { ...published, draftError: "Немає прав доступу для перегляду чернетки." } };
    }
    throw err;
  }
}
