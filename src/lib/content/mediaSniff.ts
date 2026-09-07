/**
 * Content-type sniffing for panel media, by magic bytes — the check the
 * extension alone cannot do (a `.jpg` that is really an HTML page, a `.png`
 * that is a script, an `.mp4` that is a zip).
 *
 * IMPORTANT: a passing sniff means "the header matches a <ext> container and,
 * for JPEG/PNG, the pixel dimensions parse". It is NOT a guarantee the whole
 * file is intact, virus-free, or a benign media file — do not present it as
 * one. It closes the "wrong type behind a media extension" gap; it does not
 * replace serving media from a domain with no script execution (which the
 * public site already does via /images/…).
 */

export type MediaExt = "jpg" | "jpeg" | "png" | "webp" | "mp4" | "webm";

export interface SniffResult {
  ok: boolean;
  /** the container the bytes actually look like, or "unknown" */
  detected: MediaExt | "unknown" | "empty";
  reason?: string;
}

/** Per-type ceiling. Images are small; video is intentionally capped low so a
 *  large file is never committed straight into the git content branch. */
export const MAX_BYTES: Record<"image" | "video", number> = {
  image: 12 * 1024 * 1024,
  video: 64 * 1024 * 1024,
};
/** Below this a "media" file is treated as truncated / empty / a stub. */
export const MIN_BYTES = 64;

const norm = (ext: string): MediaExt | null => {
  const e = ext.replace(/^\./, "").toLowerCase();
  return (["jpg", "jpeg", "png", "webp", "mp4", "webm"] as const).includes(e as MediaExt)
    ? (e as MediaExt)
    : null;
};
const isImage = (e: MediaExt) => e === "jpg" || e === "jpeg" || e === "png" || e === "webp";

/** Which container do these bytes look like? (header only) */
export function detectContainer(buf: Buffer): MediaExt | "unknown" | "empty" {
  if (buf.length === 0) return "empty";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.toString("hex", 0, 8) === "89504e470d0a1a0a") return "png";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  // ISO-BMFF (mp4/mov/m4v): bytes 4..8 == "ftyp"
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") return "mp4";
  // Matroska / WebM: EBML magic 1A 45 DF A3
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return "webm";
  }
  return "unknown";
}

/** Do these bytes parse to real pixel dimensions? (JPEG SOF / PNG IHDR) */
export function imageDimensionsParse(buf: Buffer): boolean {
  if (buf.length >= 24 && buf.toString("hex", 0, 8) === "89504e470d0a1a0a") {
    return buf.readUInt32BE(16) > 0 && buf.readUInt32BE(20) > 0;
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return buf.readUInt16BE(off + 5) > 0 && buf.readUInt16BE(off + 7) > 0;
      }
      off += 2 + len;
    }
    return false; // JPEG signature but no SOF -> truncated / not really a JPEG
  }
  return false;
}

/**
 * @param head  the first N KiB of the file (>= 64 bytes recommended)
 * @param size  the full file size in bytes
 * @param ext   the on-disk extension (with or without dot)
 */
export function sniffMedia(head: Buffer, size: number, ext: string): SniffResult {
  const want = norm(ext);
  if (!want) return { ok: false, detected: "unknown", reason: `непідтримуване розширення «${ext}»` };

  if (size === 0) return { ok: false, detected: "empty", reason: "порожній файл (0 байт)" };
  if (size < MIN_BYTES) {
    return { ok: false, detected: detectContainer(head), reason: `замалий файл (${size} Б) — обрізаний або заглушка` };
  }
  const cap = isImage(want) ? MAX_BYTES.image : MAX_BYTES.video;
  if (size > cap) {
    return {
      ok: false,
      detected: detectContainer(head),
      reason: `завеликий файл (${(size / 1048576).toFixed(1)} МБ > ${(cap / 1048576).toFixed(0)} МБ)`,
    };
  }

  const detected = detectContainer(head);
  const wantNorm = want === "jpg" ? "jpeg" : want;
  if (detected !== wantNorm) {
    return {
      ok: false,
      detected,
      reason:
        detected === "unknown"
          ? `вміст не розпізнано як медіа (розширення «${ext}»)`
          : `розширення «${ext}», а вміст — «${detected}»`,
    };
  }

  if (isImage(want) && want !== "webp" && !imageDimensionsParse(head)) {
    return { ok: false, detected, reason: "заголовок є, але розміри зображення не читаються (обрізаний файл)" };
  }

  return { ok: true, detected };
}
