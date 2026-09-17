import { NextResponse } from "next/server";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { getStorage } from "@/lib/content/store";
import { loadVideoAccess, videoAccessStatus } from "@/lib/media/videoAccessGate";
import {
  isBlobConfigured,
  isValidVideoKey,
  tokenRulesFor,
  validateSpec,
  VideoStoreNotConfiguredError,
  VIDEO_MAX_BYTES,
  type VideoStore,
  type VideoUploadSpec,
} from "@/lib/media/videoStore";
import { sniffMedia } from "@/lib/content/mediaSniff";
import type { HandleUploadBody } from "@vercel/blob/client";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const asNotConfigured = (err: unknown) =>
  err instanceof VideoStoreNotConfiguredError
    ? json({ ok: false, message: err.message, notConfigured: true }, 501)
    : null;

/**
 * `videoAccessStatus`'s status -> a JSON response, shared by every caller in
 * this file (the initial gate on each method below, AND the Blob
 * token-exchange re-check). `null` means "not one of the access-gate error
 * types" — callers compose it with `asNotConfigured` / a generic fallback
 * rather than this function inventing a catch-all itself.
 */
const asAccessError = (err: unknown) => {
  const status = videoAccessStatus(err);
  return status ? json({ ok: false, message: (err as Error).message }, status) : null;
};

/**
 * Shared gate for every method below: panel enabled (404 if not) + a live,
 * write-capable GitHub session (`loadVideoAccess` — see that module for why
 * `getVideoStore()` must never run before this succeeds). Mirrors the return
 * shape the old `requireSession()` had, so callers barely change.
 */
async function requireVideoAccess(): Promise<
  { ok: true; videoStore: VideoStore } | { ok: false; res: NextResponse }
> {
  if (!keystaticEnabled) return { ok: false, res: json({ ok: false, message: "Панель вимкнена." }, 404) };
  const gate = await loadVideoAccess();
  if (!gate.ok) {
    return {
      ok: false,
      res: asAccessError(gate.error) ?? json({ ok: false, message: "Не вдалося перевірити доступ." }, 500),
    };
  }
  return { ok: true, videoStore: gate.videoStore };
}

/**
 * POST is two things by mode:
 *  - Vercel Blob mode: the `@vercel/blob` client-upload token endpoint. The
 *    browser (via `upload()`) POSTs a `HandleUploadBody`; we authorise the
 *    user in `onBeforeGenerateToken` and hand back a short-lived token. The
 *    file NEVER passes through here (Vercel caps request bodies at 4.5 MB).
 *  - local mode: "create an upload target" -> `{ uploadUrl, publicUrl, key }`,
 *    then the browser PUTs the bytes to this route (dev only, no size cap).
 */
export async function POST(request: Request) {
  const gate = await requireVideoAccess();
  if (!gate.ok) return gate.res;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: "Некоректний запит." }, 400);
  }

  // --- Vercel Blob client-upload token exchange ---
  if (typeof body.type === "string" && body.type.startsWith("blob.")) {
    try {
      // Fail fast, predictably, and WITHOUT ever handing the request to
      // `@vercel/blob` when there's no token — otherwise the client SDK's
      // own internal error (whatever shape/wording it happens to throw)
      // leaks through instead of our own clear, consistent message.
      if (!isBlobConfigured()) throw new VideoStoreNotConfiguredError();
      const { handleUpload } = await import("@vercel/blob/client");
      const res = await handleUpload({
        body: body as unknown as HandleUploadBody,
        request,
        onBeforeGenerateToken: async (pathname: string) => {
          // Re-checked RIGHT BEFORE issuing the short-lived upload token —
          // not a duplicate of the gate above. Access can be revoked in the
          // window between a user opening /panel/video and them actually
          // picking a file and uploading; without this, a token could still
          // be handed out on that stale, already-revoked session.
          const contentStore = await getStorage();
          await contentStore.assertWriteAccess();
          const rules = tokenRulesFor(pathname);
          if (!rules.ok || !rules.rules) throw new Error(rules.reason ?? "шлях відхилено");
          return { ...rules.rules, tokenPayload: JSON.stringify({ at: Date.now() }) };
        },
        onUploadCompleted: async () => {
          // No separate index — /panel/video lists straight from Blob.
        },
      });
      return json(res);
    } catch (err) {
      // Not-configured and access-denied get their own predictable shapes
      // (checked above / during the re-check, before or during handleUpload);
      // anything else is 400 so the client SDK surfaces the message.
      return asNotConfigured(err) ?? asAccessError(err) ?? json({ ok: false, message: (err as Error).message }, 400);
    }
  }

  // --- local mode: create an upload target ---
  const store = gate.videoStore;
  if (store.kind !== "local") {
    return json(
      { ok: false, message: "У режимі Vercel Blob використовуйте клієнтське завантаження." },
      400,
    );
  }
  const spec: VideoUploadSpec = {
    filename: String(body.filename ?? ""),
    contentType: String(body.contentType ?? ""),
    size: Number(body.size ?? 0),
  };
  const bad = validateSpec(spec);
  if (bad) return json({ ok: false, message: bad }, 400);
  try {
    const created = await store.createUpload(spec);
    return json({ ok: true, ...created });
  } catch (err) {
    return asNotConfigured(err) ?? json({ ok: false, message: (err as Error).message }, 500);
  }
}

/** local store only: receive the bytes, sniff, persist */
export async function PUT(request: Request) {
  const gate = await requireVideoAccess();
  if (!gate.ok) return gate.res;

  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!isValidVideoKey(key)) return json({ ok: false, message: "Некоректний ключ." }, 400);

  const store = gate.videoStore;
  if (store.kind !== "local" || !store.receive) {
    return json({ ok: false, message: "Прямий приймач доступний лише в локальному режимі." }, 400);
  }

  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length === 0) return json({ ok: false, message: "Порожнє тіло запиту." }, 400);
  if (buf.length > VIDEO_MAX_BYTES) return json({ ok: false, message: "Перевищено ліміт розміру." }, 413);

  // Content check by magic bytes — not the extension.
  const ext = key.endsWith(".webm") ? "webm" : "mp4";
  const r = sniffMedia(buf.subarray(0, 65536), buf.length, ext);
  if (!r.ok) return json({ ok: false, message: `Файл відхилено: ${r.reason}` }, 415);

  try {
    const obj = await store.receive(key, buf);
    return json({ ok: true, ...obj });
  } catch (err) {
    return json({ ok: false, message: (err as Error).message }, 500);
  }
}

/** list uploaded videos (for the "orphans" view) */
export async function GET() {
  const gate = await requireVideoAccess();
  if (!gate.ok) return gate.res;
  try {
    return json({ ok: true, videos: await gate.videoStore.list() });
  } catch (err) {
    return asNotConfigured(err) ?? json({ ok: false, message: (err as Error).message }, 500);
  }
}

/** delete one uploaded video (manual only — never automatic) */
export async function DELETE(request: Request) {
  const gate = await requireVideoAccess();
  if (!gate.ok) return gate.res;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const store = gate.videoStore;
  // local: a bare filename; blob: the full https blob URL.
  if (store.kind === "local" && !isValidVideoKey(key)) {
    return json({ ok: false, message: "Некоректний ключ." }, 400);
  }
  try {
    await store.remove(key);
    return json({ ok: true, message: "Видалено." });
  } catch (err) {
    return asNotConfigured(err) ?? json({ ok: false, message: (err as Error).message }, 500);
  }
}
