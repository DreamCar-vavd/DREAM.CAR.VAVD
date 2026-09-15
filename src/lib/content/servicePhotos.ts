/**
 * Pure helpers for rendering a service's photo strip. Kept framework-free so
 * both the client component (`ServicePhotos.tsx`) and unit tests can use them.
 */

export interface ServicePhotoInput {
  src: string;
  width: number;
  height: number;
  caption: string;
}

/** Photos safe to render: a non-empty `src` and sane intrinsic dimensions. */
export function usableServicePhotos(photos: readonly ServicePhotoInput[]): ServicePhotoInput[] {
  return photos.filter(
    (p) => typeof p?.src === "string" && p.src.trim() !== "" && p.width > 0 && p.height > 0,
  );
}

/**
 * Alt / accessible name for one photo. Uses the editor's caption when it has
 * one (a single language-neutral field in Keystatic), otherwise a name built
 * from the already-localised service title and the localised "Photo" word —
 * so the fallback text always matches the page's language.
 */
export function servicePhotoAlt(args: {
  caption: string;
  title: string;
  photoWord: string;
  index: number;
}): string {
  const caption = args.caption?.trim();
  if (caption) return caption;
  return `${args.title} — ${args.photoWord} ${args.index + 1}`;
}
