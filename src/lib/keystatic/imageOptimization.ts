/**
 * Pure helpers for the browser-side photo optimizer — no DOM, no Keystatic
 * import, safe to unit-test with plain node:test. The actual pixel work
 * (decode/draw/encode) lives in compressImageInBrowser.ts, which is the only
 * browser-only piece; everything here is just arithmetic and byte checks.
 */

export const MAX_IMAGE_SIDE = 2400;

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * The final width/height for a resize that never enlarges a small photo,
 * caps the LARGER side at `maxSide`, and preserves the aspect ratio. A photo
 * already within bounds on both sides is returned unchanged (dimensions
 * rounded to integers, since a source could in principle report fractional
 * values).
 */
export function computeTargetSize(
  width: number,
  height: number,
  maxSide: number = MAX_IMAGE_SIDE,
): Dimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`некоректні розміри зображення: ${width}x${height}`);
  }
  const largerSide = Math.max(width, height);
  if (largerSide <= maxSide) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxSide / largerSide;
  return {
    // Math.max(1, ...) guards an extreme aspect ratio from rounding a side
    // down to 0 (e.g. a 1px-tall panorama).
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Replaces the LAST extension with `.webp`, keeping everything before it
 * (including any earlier dots in the name) untouched. A name with no
 * extension at all gets `.webp` appended rather than losing a character.
 */
export function toWebpFilename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return `${filename}.webp`;
  return `${filename.slice(0, lastDot)}.webp`;
}

/**
 * Whether `data` starts with a WebP file's magic bytes: the RIFF container
 * header (bytes 0-3) followed by the "WEBP" fourCC (bytes 8-11) — this is
 * the actual on-disk signature, independent of whatever a Blob's `.type`
 * claims.
 */
export function isWebpMagicBytes(data: Uint8Array): boolean {
  if (data.length < 12) return false;
  return (
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  );
}
