import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Minimal build-time intrinsic-dimension reader for the panel's images
 * (JPEG / PNG). Used so the gallery keeps per-photo aspect ratios without an
 * extra CMS field the editor would have to fill; works for uploads too.
 * Returns null when the file is missing or not a recognised format — callers
 * fall back to a default box.
 */
export async function imageSize(
  publicPath: string,
): Promise<{ width: number; height: number } | null> {
  if (!publicPath || !publicPath.startsWith("/")) return null;
  const file = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
  let buf: Buffer;
  try {
    const fd = await fs.open(file, "r");
    try {
      const b = Buffer.alloc(65536);
      const { bytesRead } = await fd.read(b, 0, b.length, 0);
      buf = b.subarray(0, bytesRead);
    } finally {
      await fd.close();
    }
  } catch {
    return null;
  }

  // PNG: 8-byte signature, then IHDR chunk (length(4) "IHDR"(4) width(4) height(4))
  if (buf.length >= 24 && buf.toString("hex", 0, 8) === "89504e470d0a1a0a") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // JPEG: scan segments for a Start-Of-Frame marker (0xFFC0..0xFFCF except C4/C8/CC)
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
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + len;
    }
  }
  return null;
}
