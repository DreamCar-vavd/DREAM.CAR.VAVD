"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Dictionary } from "@/content/types";
import type { Locale } from "@/lib/i18n/config";
import type { GalleryMediaEntry } from "@/lib/content/publishedGallery";
import { GalleryProjectModal } from "./GalleryProjectModal";

function GalleryCardCorner({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className={`pointer-events-none absolute z-10 h-5 w-5 text-gold ${className}`}
    >
      <path d="M1 1 H16 M1 1 V16" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <path
        d="M1 1 C1 1 11 0.5 11 7.5 C11 12 6.5 12 6.5 8.5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
      />
      <path
        d="M1 1 C1 1 0.5 11 7.5 11 C12 11 12 6.5 8.5 6.5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
      />
      <circle cx="1" cy="1" r="1.7" fill="currentColor" />
      <circle cx="11" cy="7.5" r="1" fill="currentColor" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}

/** Desktop-only decorative frame (double border + corner ornaments). Hidden below `lg` so Tablet/Mobile stay untouched. */
function GalleryCardFrame() {
  return (
    <div className="hidden lg:block">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-sm border-2 border-border-gold/50 transition-colors duration-300 group-hover:border-border-gold/80"
      />
      <GalleryCardCorner className="-left-1 -top-1" />
      <GalleryCardCorner className="-right-1 -top-1 rotate-90" />
      <GalleryCardCorner className="-bottom-1 -right-1 rotate-180" />
      <GalleryCardCorner className="-bottom-1 -left-1 -rotate-90" />
    </div>
  );
}

const cardButtonClass =
  "group relative flex flex-col border border-border-gold/40 transition-opacity duration-300 hover:opacity-90 focus-visible:outline-offset-4 lg:border-0 lg:bg-gradient-to-b lg:from-gold/[0.06] lg:to-transparent lg:transition-transform lg:duration-[280ms] lg:ease-out lg:hover:z-10 lg:hover:scale-[1.04] lg:hover:opacity-100 lg:hover:shadow-[0_10px_30px_rgba(212,175,55,0.22)] lg:focus-visible:z-10";

export function GalleryGrid({
  dict,
  locale,
  media,
}: {
  dict: Dictionary;
  locale: Locale;
  /**
   * Published gallery projects with their photos (from the panel snapshot,
   * or the working copy in draft preview). A project renders only if it is
   * present here.
   */
  media: GalleryMediaEntry[];
}) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  // The exact card element that opened the current modal, captured on click.
  // Same pattern as ServicesGrid's `lastTriggerRef` — a single stable ref.
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const activeProject = media.find((p) => p.id === openProjectId) ?? null;

  function openModal(id: string, trigger: HTMLElement) {
    lastTriggerRef.current = trigger;
    setOpenProjectId(id);
  }

  function closeModal() {
    setOpenProjectId(null);
    const trigger = lastTriggerRef.current;
    // Deferred with setTimeout(0), not requestAnimationFrame: rAF callbacks
    // are paused while the tab is backgrounded, so an rAF-scheduled focus
    // restore is silently dropped if the tab isn't visible at close time.
    // Matches CarListingGallery's existing close().
    window.setTimeout(() => {
      if (trigger?.isConnected) trigger.focus();
    }, 0);
  }

  // Used only by the modal's "go to contacts" CTA — deliberately skips the
  // trigger refocus (see ServiceModal/CarListingGallery's identical
  // `closeForNavigation`): the trigger card can end up scrolled far
  // off-screen once the page lands on `#contacts`. GalleryProjectModal moves
  // focus to the contacts heading itself instead.
  function closeForNavigation() {
    setOpenProjectId(null);
  }

  return (
    <section id="gallery" className="scroll-mt-20 border-b border-border-gold/60 bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-gold sm:text-4xl">
            {dict.gallery.heading}
          </h2>
          <p className="mt-3 text-muted">{dict.gallery.subheading}</p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((project, projectIndex) => {
            const cover = project.images[0];
            const title = dict.gallery.projects[project.id]?.title ?? "";
            if (project.kind === "album") {
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={(event) => openModal(project.id, event.currentTarget)}
                  className={cardButtonClass}
                >
                  <GalleryCardFrame />
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm">
                    <Image
                      src={cover.src}
                      alt={cover.caption || title}
                      fill
                      loading="lazy"
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="bg-surface-light object-cover"
                    />
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/90 via-background/10 to-transparent p-3 lg:hidden">
                      <span className="text-xs font-semibold tracking-[0.15em] text-gold">
                        {dict.gallery.albumNumberLabel}
                        {project.albumNumber}
                      </span>
                      <span className="font-heading text-sm font-bold text-text sm:text-base">
                        {title}
                      </span>
                    </div>
                  </div>
                  <div className="relative hidden min-h-[64px] flex-1 flex-col justify-center gap-0.5 border-t border-gold/50 px-3 py-2 text-left lg:flex">
                    <span className="text-xs font-semibold tracking-[0.15em] text-gold">
                      {dict.gallery.albumNumberLabel}
                      {project.albumNumber}
                    </span>
                    <span className="font-heading text-sm font-bold text-text sm:text-base">
                      {title}
                    </span>
                  </div>
                </button>
              );
            }

            const isSquare = cover.width === cover.height;
            const mobileAspect = isSquare ? "aspect-square" : "aspect-[4/5]";
            return (
              <button
                key={project.id}
                type="button"
                onClick={(event) => openModal(project.id, event.currentTarget)}
                aria-label={`${dict.gallery.heading} ${projectIndex + 1}`}
                className={cardButtonClass}
              >
                <GalleryCardFrame />
                <div
                  className={`relative w-full overflow-hidden rounded-sm bg-surface ${mobileAspect} lg:aspect-[4/3]`}
                />
                <div className="hidden min-h-[64px] flex-1 lg:block" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {activeProject && (
        <GalleryProjectModal
          key={activeProject.id}
          dict={dict}
          locale={locale}
          project={{
            id: activeProject.id,
            images: activeProject.images.map((i) => ({
              src: i.src,
              width: i.width,
              height: i.height,
            })),
          }}
          onClose={closeModal}
          onNavigate={closeForNavigation}
        />
      )}
    </section>
  );
}
