import { NextResponse } from "next/server";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { getStorage, NotConnectedError } from "@/lib/content/store";
import {
  getVideoStore,
  isValidVideoKey,
  validateSpec,
  VideoStoreNotConfiguredError,
  VIDEO_MAX_BYTES,
  type VideoUploadSpec,
} from "@/lib/media/videoStore";
import { sniffMedia } from "@/lib/content/mediaSniff";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Shared auth gate: panel enabled + a live storage session (same as /panel). */
async function requireSession(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  if (!keystaticEnabled) return { ok: false, res: json({ ok: false, message: "Панель вимкнена." }, 404) };
  try {
    await getStorage();
    return { ok: true };
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return { ok: false, res: json({ ok: false, message: err.message }, 401) };
    }
    throw err;
  }
}

const asNotConfigured = (err: unknown) =>
  err instanceof VideoStoreNotConfiguredError
    ? json({ ok: false, message: err.message, notConfigured: true }, 501)
    : null;

/** create an upload target */
export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.res;

  let spec: VideoUploadSpec;
  try {
    const b = (await request.json()) as Partial<VideoUploadSpec>;
    spec = { filename: String(b.filename ?? ""), contentType: String(b.contentType ?? ""), size: Number(b.size ?? 0) };
  } catch {
    return json({ ok: false, message: "Некоректний запит." }, 400);
  }
  const bad = validateSpec(spec);
  if (bad) return json({ ok: false, message: bad }, 400);

  try {
    const created = await getVideoStore().createUpload(spec);
    return json({ ok: true, ...created });
  } catch (err) {
    return asNotConfigured(err) ?? json({ ok: false, message: (err as Error).message }, 500);
  }
}

/** local store only: receive the bytes, sniff, persist */
export async function PUT(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.res;

  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!isValidVideoKey(key)) return json({ ok: false, message: "Некоректний ключ." }, 400);

  const store = getVideoStore();
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
  const gate = await requireSession();
  if (!gate.ok) return gate.res;
  try {
    return json({ ok: true, videos: await getVideoStore().list() });
  } catch (err) {
    return asNotConfigured(err) ?? json({ ok: false, message: (err as Error).message }, 500);
  }
}

/** delete one uploaded video (manual only — never automatic) */
export async function DELETE(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.res;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!isValidVideoKey(key)) return json({ ok: false, message: "Некоректний ключ." }, 400);
  try {
    await getVideoStore().remove(key);
    return json({ ok: true, message: `Видалено «${key}».` });
  } catch (err) {
    return asNotConfigured(err) ?? json({ ok: false, message: (err as Error).message }, 500);
  }
}
