/**
 * Browser-only photo optimizer for Keystatic's `fields.image` value shape.
 * Decodes the picked file, resizes it to fit within `MAX_IMAGE_SIDE` (never
 * enlarging), re-encodes as WebP at `WEBP_QUALITY`, and returns a value in
 * the exact same `{data, extension, filename}` shape Keystatic expects — so
 * a caller (the future field wrapper) can hand the result straight to
 * Keystatic's own `onChange` with no further transformation.
 *
 * The actual browser APIs (`createImageBitmap`, canvas creation/encoding)
 * are reached only through the injectable `BrowserImageAdapter`, which is
 * what makes this fully unit-testable under plain node:test — the default
 * adapter (used when no adapter is passed) is the only part that touches
 * real browser globals, and even it does so lazily, inside its methods, not
 * at construction time.
 *
 * This module is NOT wired into keystatic.config.ts yet — see
 * PANEL-PHOTO-AUTO-OPTIMIZATION-CORE-01.
 */
import {
  computeTargetSize,
  isWebpMagicBytes,
  toWebpFilename,
  MAX_SOURCE_IMAGE_BYTES,
} from "./imageOptimization";

export interface KeystaticImageValue {
  data: Uint8Array;
  extension: string;
  filename: string;
}

/** The exact source formats this optimizer accepts, and their MIME type for decoding. */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const WEBP_QUALITY = 0.84;

function formatMebibytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** The minimal surface `compressImageInBrowser` needs from a decoded bitmap. */
export interface ImageBitmapLike {
  width: number;
  height: number;
  close(): void;
}

/** The minimal surface needed from a 2D drawing context. */
export interface CanvasContext2DLike {
  drawImage(
    image: ImageBitmapLike,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void;
}

/** The minimal surface needed from a canvas (real or offscreen). */
export interface CanvasLike {
  getContext(kind: "2d"): CanvasContext2DLike | null;
  toWebpBlob(quality: number): Promise<Blob | null>;
}

/**
 * Everything `compressImageInBrowser` needs from the browser, behind an
 * interface a test can implement with plain objects — no real DOM required.
 */
export interface BrowserImageAdapter {
  createImageBitmap(
    blob: Blob,
    options?: { imageOrientation?: "from-image" | "none" },
  ): Promise<ImageBitmapLike>;
  createCanvas(width: number, height: number): CanvasLike;
}

/**
 * The real adapter, built only from lazy references to browser globals —
 * importing this module (or calling `compressImageInBrowser` with an
 * injected adapter, as every test here does) never touches
 * `createImageBitmap`/`OffscreenCanvas`/`document`, so it is safe to import
 * from Node. Calling one of ITS methods outside a browser throws a clear
 * error instead of a cryptic "is not a function".
 */
export function createDefaultBrowserImageAdapter(): BrowserImageAdapter {
  return {
    async createImageBitmap(blob, options) {
      if (typeof createImageBitmap !== "function") {
        throw new Error("createImageBitmap недоступний у цьому середовищі (потрібен браузер)");
      }
      return createImageBitmap(blob, options as ImageBitmapOptions);
    },
    createCanvas(width, height) {
      if (typeof OffscreenCanvas === "function") {
        const canvas = new OffscreenCanvas(width, height);
        return {
          getContext: (kind) => canvas.getContext(kind) as unknown as CanvasContext2DLike | null,
          toWebpBlob: (quality) => canvas.convertToBlob({ type: "image/webp", quality }),
        };
      }
      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return {
          getContext: (kind) => canvas.getContext(kind) as unknown as CanvasContext2DLike | null,
          toWebpBlob: (quality) =>
            new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality)),
        };
      }
      throw new Error("немає доступного Canvas API в цьому середовищі (потрібен браузер)");
    },
  };
}

/**
 * Compresses one Keystatic-picked photo to WebP in the browser. Throws a
 * descriptive Error on any failure (unsupported source format, source over
 * `MAX_SOURCE_IMAGE_BYTES` -- rejected BEFORE the adapter is touched at all,
 * decode failure, missing 2D context, `toBlob`/`convertToBlob` returning
 * `null`, a result whose MIME type or magic bytes are not actually WebP, or
 * an encoded result somehow still over `MAX_SOURCE_IMAGE_BYTES`) — it never
 * falls back to silently returning the original value; a caller that wants
 * a "keep the original on failure" fallback must catch this itself.
 */
export async function compressImageInBrowser(
  value: KeystaticImageValue,
  adapter: BrowserImageAdapter = createDefaultBrowserImageAdapter(),
): Promise<KeystaticImageValue> {
  const ext = value.extension.toLowerCase();
  const mime = MIME_BY_EXTENSION[ext];
  if (!mime) {
    throw new Error(`непідтримуваний формат зображення для стиснення: «${value.extension}»`);
  }

  // Checked BEFORE the adapter is touched at all -- an oversized source must
  // never reach createImageBitmap/canvas.
  if (value.data.byteLength > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error(
      `файл завеликий (${formatMebibytes(value.data.byteLength)} МБ) — технічний максимум ${formatMebibytes(MAX_SOURCE_IMAGE_BYTES)} МБ на одне зображення`,
    );
  }

  // `.slice()` copies into a fresh, plain ArrayBuffer-backed Uint8Array --
  // `value.data`'s generic buffer type (which could in principle be a
  // SharedArrayBuffer) isn't assignable to BlobPart directly under the
  // stricter typed-array generics in the current DOM lib.
  const sourceBlob = new Blob([value.data.slice()], { type: mime });
  let bitmap: ImageBitmapLike | null = null;

  try {
    try {
      bitmap = await adapter.createImageBitmap(sourceBlob, { imageOrientation: "from-image" });
    } catch (err) {
      throw new Error(`не вдалося декодувати зображення: ${(err as Error).message}`);
    }

    const target = computeTargetSize(bitmap.width, bitmap.height);
    const canvas = adapter.createCanvas(target.width, target.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("не вдалося отримати 2D-контекст canvas");
    }
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await canvas.toWebpBlob(WEBP_QUALITY);
    if (!blob) {
      throw new Error("canvas не зміг створити WebP-зображення (toBlob/convertToBlob повернув null)");
    }
    if (blob.type !== "image/webp") {
      throw new Error(`неочікуваний тип результату «${blob.type}», очікувався image/webp`);
    }

    const data = new Uint8Array(await blob.arrayBuffer());
    if (!isWebpMagicBytes(data)) {
      throw new Error("результат стиснення не є коректним WebP-файлом (magic bytes не збігаються)");
    }
    if (data.byteLength > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error(
        `стиснений WebP завеликий (${formatMebibytes(data.byteLength)} МБ) — технічний максимум ${formatMebibytes(MAX_SOURCE_IMAGE_BYTES)} МБ на одне зображення`,
      );
    }

    return {
      data,
      extension: "webp",
      filename: toWebpFilename(value.filename),
    };
  } finally {
    bitmap?.close();
  }
}
