import type { PanelStorage } from "@/lib/content/store/adapter";
import { getLeadsStore as defaultGetLeadsStore, type LeadsStore } from "./store";

export type LeadsAccessResult =
  | { ok: true; leadsStore: LeadsStore }
  | { ok: false; error: unknown };

/**
 * The exact, non-negotiable order `/panel/leads` must follow: confirm a live,
 * write-capable GitHub session (`PanelStorage.assertWriteAccess`) BEFORE the
 * leads store is even constructed. Extracted out of the page component so a
 * regression test can inject spies on `getStorage`/`getLeadsStore` and PROVE
 * the ordering — a "does the page render the right JSX" test cannot show the
 * leads store was never touched on a denial, and would keep passing if
 * someone later moved the leads read above the gate by mistake.
 *
 * `getStorage` is not imported at module top level: `@/lib/content/store`
 * carries `import "server-only"`, which throws outside Next.js's build
 * (including plain `node:test`). The real one is loaded with a dynamic
 * `import()` — same pattern already used by `siteContent.ts` — so it is
 * pulled in only when this function actually runs in the app, never merely
 * by importing this module in a test.
 */
export async function loadLeadsAccess(deps?: {
  getStorage?: () => Promise<PanelStorage>;
  getLeadsStore?: () => Promise<LeadsStore>;
}): Promise<LeadsAccessResult> {
  const getStorage =
    deps?.getStorage ?? (async () => (await import("@/lib/content/store")).getStorage());
  const getLeadsStore = deps?.getLeadsStore ?? defaultGetLeadsStore;

  try {
    const contentStore = await getStorage();
    await contentStore.assertWriteAccess();
  } catch (error) {
    return { ok: false, error };
  }
  const leadsStore = await getLeadsStore();
  return { ok: true, leadsStore };
}
