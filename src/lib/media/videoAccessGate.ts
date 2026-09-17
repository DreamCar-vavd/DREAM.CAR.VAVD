import {
  NotConnectedError,
  StorageAuthError,
  StorageBackendError,
  StorageForbiddenError,
  type PanelStorage,
} from "@/lib/content/store/adapter";
import { getVideoStore as defaultGetVideoStore, type VideoStore } from "./videoStore";

export type VideoAccessResult =
  | { ok: true; storage: PanelStorage; videoStore: VideoStore }
  | { ok: false; error: unknown };

/**
 * The exact, non-negotiable order every video surface (`/panel/video`, and
 * every method of `/api/panel/video`) must follow: confirm a live,
 * write-capable GitHub session (`PanelStorage.assertWriteAccess`) BEFORE
 * `getVideoStore()` is even called — so no Blob API call, no local
 * filesystem read/write, and no car-listing read can happen ahead of the
 * check. Modelled directly on `src/lib/leads/accessGate.ts`'s
 * `loadLeadsAccess`; see that file's own comment for why the ordering
 * matters and why it is extracted rather than inlined per caller.
 *
 * `getStorage` is not imported at module top level: `@/lib/content/store`
 * carries `import "server-only"`, which throws outside Next.js's build
 * (including plain `node:test`). The real one is loaded with a dynamic
 * `import()` so it is pulled in only when this function actually runs in
 * the app, never merely by importing this module in a test.
 */
export async function loadVideoAccess(deps?: {
  getStorage?: () => Promise<PanelStorage>;
  getVideoStore?: () => VideoStore;
}): Promise<VideoAccessResult> {
  const getStorage =
    deps?.getStorage ?? (async () => (await import("@/lib/content/store")).getStorage());
  const getVideoStore = deps?.getVideoStore ?? defaultGetVideoStore;

  let contentStore: PanelStorage;
  try {
    contentStore = await getStorage();
    await contentStore.assertWriteAccess();
  } catch (error) {
    return { ok: false, error };
  }
  return { ok: true, storage: contentStore, videoStore: getVideoStore() };
}

/**
 * Maps a `loadVideoAccess()` failure to the HTTP status a caller should use
 * — one source of truth so `/panel/video`'s API and any future caller agree
 * on exactly the same status for exactly the same cause, instead of each
 * route method re-deriving it:
 *  - no session, or a session GitHub itself says is no longer valid -> 401;
 *  - a valid session without push access -> 403;
 *  - GitHub unreachable/timed out/rate-limited (retriable either way) -> 503.
 * `null` means "not one of the errors this gate produces" — the caller
 * decides the fallback (e.g. a generic 500), never this function.
 */
export function videoAccessStatus(error: unknown): 401 | 403 | 503 | null {
  if (error instanceof NotConnectedError || error instanceof StorageAuthError) return 401;
  if (error instanceof StorageForbiddenError) return 403;
  if (error instanceof StorageBackendError) return 503;
  return null;
}
