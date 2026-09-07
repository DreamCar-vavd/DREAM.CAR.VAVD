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

// --- hosted (not wired) --------------------------------------------------

class BlobVideoStore implements VideoStore {
  readonly kind = "blob" as const;
  async createUpload(): Promise<CreatedUpload> {
    throw new VideoStoreNotConfiguredError();
  }
  async head(): Promise<VideoObject | null> {
    throw new VideoStoreNotConfiguredError();
  }
  async remove(): Promise<void> {
    throw new VideoStoreNotConfiguredError();
  }
  async list(): Promise<VideoObject[]> {
    throw new VideoStoreNotConfiguredError();
  }
}

export function getVideoStore(): VideoStore {
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  if (process.env.NODE_ENV === "production" || hasBlob) {
    // A real token would still hit BlobVideoStore's stub methods — the adapter
    // implementation is the remaining hosted work (report). It must not fall
    // back to writing into the repo on a serverless FS.
    return new BlobVideoStore();
  }
  return new LocalVideoStore();
}
