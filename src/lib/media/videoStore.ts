/**
 * Video-file storage for the panel. Videos must NEVER be committed to Git
 * (the content branch), so they live outside it:
 *
 *  - dev / local: `LocalVideoStore` writes to `<repo>/public/uploads/videos/`
 *    (git-ignored) so `next dev` can serve them for the draft preview.
 *  - hosted: `BlobVideoStore` — Vercel Blob. NOT wired yet: without
 *    `BLOB_READ_WRITE_TOKEN` `getVideoStore()` in production throws
 *    `VideoStoreNotConfiguredError` rather than pretending it works.
 *
 * The panel stores only the resulting URL on the car (`video.mode:
 * "hosted-file"`, `video.src: <url>`). A failed upload writes nothing, so it
 * can never leave a half-made media record. Replacing or deleting a video in
 * the working copy does not touch `published.json` (a frozen snapshot).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const VIDEO_MAX_BYTES = 200 * 1024 * 1024; // 200 MB
export const VIDEO_TYPES: Record<string, "mp4" | "webm"> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export interface VideoUploadSpec {
  filename: string;
  contentType: string;
  size: number;
}

export interface VideoObject {
  key: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export interface CreatedUpload {
  key: string;
  /** where the browser sends the bytes */
  uploadUrl: string;
  method: "PUT";
  /** the public URL the panel will store once the upload succeeds */
  publicUrl: string;
}

export interface VideoStore {
  readonly kind: "local" | "blob";
  createUpload(spec: VideoUploadSpec): Promise<CreatedUpload>;
  /** local only: receive the bytes after client-side validation + a server sniff */
  receive?(key: string, bytes: Buffer): Promise<VideoObject>;
  head(key: string): Promise<VideoObject | null>;
  remove(key: string): Promise<void>;
  list(): Promise<VideoObject[]>;
}

export class VideoStoreNotConfiguredError extends Error {
  constructor() {
    super(
      "Сховище відео не підключено. Для хостингу потрібні пакет @vercel/blob і " +
        "змінна BLOB_READ_WRITE_TOKEN (Vercel → Storage → Blob).",
    );
    this.name = "VideoStoreNotConfiguredError";
  }
}

export function validateSpec(spec: VideoUploadSpec): string | null {
  if (!spec.filename || spec.filename.length > 200) return "некоректна назва файлу";
  if (/[/\\]/.test(spec.filename) || spec.filename.includes("..")) return "недопустимі символи в назві";
  if (!(spec.contentType in VIDEO_TYPES)) return `непідтримуваний тип «${spec.contentType}» (лише MP4, WebM)`;
  if (!Number.isFinite(spec.size) || spec.size <= 0) return "невідомий розмір файлу";
  if (spec.size > VIDEO_MAX_BYTES) {
    return `завеликий файл (${(spec.size / 1048576).toFixed(0)} МБ > ${VIDEO_MAX_BYTES / 1048576} МБ)`;
  }
  return null;
}

const KEY_RE = /^[a-z0-9]{8,}-[a-z0-9-]+\.(mp4|webm)$/;
export const isValidVideoKey = (k: string) => KEY_RE.test(k) && !k.includes("..");

/** All panel video blobs live under this prefix. */
export const BLOB_VIDEO_PREFIX = "panel/videos/";

/** A safe blob pathname for the client SDK's `upload(pathname, …)` call. */
export function blobPathnameFor(filename: string, contentType: string): string {
  const ext = VIDEO_TYPES[contentType] ?? "mp4";
  const slug =
    filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "video";
  return `${BLOB_VIDEO_PREFIX}${slug}.${ext}`;
}

/** The token generator's answer — mirrors @vercel/blob's onBeforeGenerateToken
 *  return shape, kept here so it is unit-testable without the SDK. */
export function tokenRulesFor(pathname: string): {
  ok: boolean;
  reason?: string;
  rules?: { allowedContentTypes: string[]; maximumSizeInBytes: number; addRandomSuffix: boolean };
} {
  if (!pathname.startsWith(BLOB_VIDEO_PREFIX)) {
    return { ok: false, reason: `шлях має починатися з ${BLOB_VIDEO_PREFIX}` };
  }
  if (pathname.includes("..") || pathname.includes("//")) {
    return { ok: false, reason: "недопустимий шлях" };
  }
  if (!/\.(mp4|webm)$/i.test(pathname)) {
    return { ok: false, reason: "лише .mp4 / .webm" };
  }
  return {
    ok: true,
    rules: {
      allowedContentTypes: Object.keys(VIDEO_TYPES),
      maximumSizeInBytes: VIDEO_MAX_BYTES,
      addRandomSuffix: true,
    },
  };
}

// --- local store ----------------------------------------------------------

class LocalVideoStore implements VideoStore {
  readonly kind = "local" as const;
  private dir = path.join(process.cwd(), "public", "uploads", "videos");

  private async ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }
  private safePath(key: string): string {
    if (!isValidVideoKey(key)) throw new Error("bad key");
    const p = path.join(this.dir, key);
    if (!p.startsWith(this.dir + path.sep)) throw new Error("path escape");
    return p;
  }

  async createUpload(spec: VideoUploadSpec): Promise<CreatedUpload> {
    const ext = VIDEO_TYPES[spec.contentType];
    const slug = spec.filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "video";
    const key = `${randomBytes(6).toString("hex")}-${slug}.${ext}`;
    return {
      key,
      uploadUrl: `/api/panel/video?key=${encodeURIComponent(key)}`,
      method: "PUT",
      publicUrl: `/uploads/videos/${key}`,
    };
  }

  async receive(key: string, bytes: Buffer): Promise<VideoObject> {
    await this.ensureDir();
    const p = this.safePath(key);
    // temp + rename so a cancelled/failed PUT never leaves a partial file
    // that looks complete.
    const tmp = `${p}.part-${randomBytes(4).toString("hex")}`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, p);
    const st = await fs.stat(p);
    return { key, url: `/uploads/videos/${key}`, size: st.size, uploadedAt: new Date().toISOString() };
  }

  async head(key: string): Promise<VideoObject | null> {
    try {
      const st = await fs.stat(this.safePath(key));
      return { key, url: `/uploads/videos/${key}`, size: st.size, uploadedAt: st.mtime.toISOString() };
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.safePath(key), { force: true });
  }

  async list(): Promise<VideoObject[]> {
    await this.ensureDir();
    const names = (await fs.readdir(this.dir)).filter(isValidVideoKey);
    const out: VideoObject[] = [];
    for (const key of names) {
      const h = await this.head(key);
      if (h) out.push(h);
    }
    return out.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }
}

// --- hosted: Vercel Blob (direct browser → Blob client uploads) -----------
//
// Uploads never pass through this serverless function (Vercel caps request
// bodies at 4.5 MB — see docs/PANEL-video-hosting.md). The route only issues a
// short-lived client token via `handleUpload`; the browser then streams the
// file straight to Blob. This class covers the list / delete / head side.
// The token-issuing + client `upload()` wiring lives in the route + uploader;
// its rules are `tokenRulesFor()` above (unit-tested).

class BlobVideoStore implements VideoStore {
  readonly kind = "blob" as const;

  /** Read at call time so a deploy that gains/loses the token behaves live. */
  private need(): string {
    const t = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!t) throw new VideoStoreNotConfiguredError();
    return t;
  }

  async createUpload(): Promise<CreatedUpload> {
    // Not used in blob mode — the client SDK's `upload()` does the token
    // exchange against the route's `handleUpload`.
    throw new Error("У режимі Vercel Blob завантаження йде через клієнтський SDK, не через createUpload().");
  }

  async list(): Promise<VideoObject[]> {
    const { list } = await import("@vercel/blob");
    const out: VideoObject[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: BLOB_VIDEO_PREFIX, cursor, token: this.need() });
      for (const b of page.blobs) {
        out.push({
          key: b.url, // full blob URL — what a car's video.src stores, and what del() needs
          url: b.url,
          size: b.size,
          uploadedAt: (b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt)).toISOString(),
        });
      }
      cursor = page.cursor;
    } while (cursor);
    return out.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  async head(keyOrUrl: string): Promise<VideoObject | null> {
    try {
      const { head } = await import("@vercel/blob");
      const b = await head(keyOrUrl, { token: this.need() });
      return {
        key: b.url,
        url: b.url,
        size: b.size,
        uploadedAt: (b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt)).toISOString(),
      };
    } catch {
      return null;
    }
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith("https://") || !url.includes(".blob.vercel-storage.com")) {
      throw new Error("Очікується повний URL блоба.");
    }
    const { del } = await import("@vercel/blob");
    await del(url, { token: this.need() });
  }
}

export function getVideoStore(): VideoStore {
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  // A real token -> the real Blob adapter. Production without a token -> also
  // the Blob adapter, but its methods raise VideoStoreNotConfiguredError; it
  // must never fall back to writing the repo FS on a serverless deploy.
  if (hasBlob || process.env.NODE_ENV === "production") return new BlobVideoStore();
  return new LocalVideoStore();
}
