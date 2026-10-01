import { Play } from "lucide-react";
import { GoldLink } from "./GoldButton";

/**
 * The project's video button — always rendered, in one of two states.
 * `watchUrl` is the normalized `https://www.youtube.com/watch?v=<id>` built
 * server-side from a validated YouTube id (publishedGallery.ts for the
 * gallery, carVideo.ts for cars for sale), never the raw content value: it
 * renders an active gold link that opens YouTube in a new tab. `null` (no
 * link, an invalid one, or a non-YouTube video file) renders a real disabled
 * <button> in muted grey. The button itself never embeds or plays the video.
 *
 * Shared by GalleryProjectModal and CarListingGallery so both modals show the
 * exact same button.
 *
 * Below `sm` the label may wrap onto two centred lines — a 320 px phone can't
 * fit «Дивитися відео на YouTube» on one — while the Play icon keeps its size;
 * from `sm` up it stays on one line, exactly as before.
 */
export function GalleryVideoButton({
  watchUrl,
  watchLabel,
  comingSoonLabel,
}: {
  watchUrl: string | null;
  watchLabel: string;
  comingSoonLabel: string;
}) {
  if (watchUrl) {
    return (
      <GoldLink
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        className="w-full min-w-0 max-sm:text-center max-sm:leading-snug sm:w-auto sm:whitespace-nowrap"
      >
        <Play size={16} aria-hidden="true" className="shrink-0" />
        {watchLabel}
      </GoldLink>
    );
  }
  return (
    <button
      type="button"
      disabled
      className="inline-flex w-full min-w-0 cursor-not-allowed items-center justify-center gap-2 rounded-sm border border-muted/40 bg-surface-light px-6 py-3 text-sm font-semibold tracking-wide text-muted max-sm:text-center max-sm:leading-snug sm:w-auto sm:whitespace-nowrap"
    >
      <Play size={16} aria-hidden="true" className="shrink-0" />
      {comingSoonLabel}
    </button>
  );
}
