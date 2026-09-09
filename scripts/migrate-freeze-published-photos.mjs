/**
 * One-off, re-runnable: freeze the photos of every item ALREADY in
 * published.json into each slug's content-addressed `_pub/` folder and repoint
 * the snapshot there.
 *
 *   node --import tsx scripts/migrate-freeze-published-photos.mjs
 *
 * Why: items published before the freeze pipeline (task 2026-09-09 §5–6) still
 * point published.json at the WORKING photo files. A later Keystatic re-order or
 * removal of one of those photos is a direct commit that renumbers / deletes the
 * file, and the NEXT deployment then 404s it even though the card was never
 * re-published. Copying the bytes now, content-addressed, makes the published
 * page independent of the working files from here on.
 *
 * Idempotent: a photo already under `_pub/` is left as-is; a second run is a
 * no-op ("changed: 0"). Only photo `image` paths in published.json change; the
 * public site reads exactly the same pixels.
 */
import { LocalFsStorage } from "../src/lib/content/store/localFs.ts";
import { freezePublishedMedia } from "../src/lib/content/panelStore.ts";

const { changed } = await freezePublishedMedia(new LocalFsStorage());
console.log(changed === 0 ? "Nothing to freeze — every published photo is already in _pub/." : `Froze photos for ${changed} published item(s).`);
console.log("Review: git status && git diff src/content/cms/published.json && git add public/images/cms");
