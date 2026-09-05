"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Dictionary } from "@/content/types";
import type { Locale } from "@/lib/i18n/config";
import { galleryImages, galleryAlbums } from "@/content/gallery";
import { galleryProjects } from "@/content/galleryProjects";
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

export function GalleryGrid({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeProject = galleryProjects.find((p) => p.id === openProjectId) ?? null;

  function closeModal() {
    const id = openProjectId;
    setOpenProjectId(null);
    if (id) {
      requestAnimationFrame(() => triggerRefs.current[id]?.focus());
    }
  }

  // Used only by the modal's "go to contacts" CTA. Deliberately skips the
  // trigger refocus above — see ServiceModal/CarListingGallery's identical
  // `closeForNavigation` for why: that trigger card can end up scrolled far
  // off-screen once the page lands on `#contacts`, so returning focus to it
  // would strand a keyboard/screen-reader user there instead of at the form.
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
          {galleryAlbums.map((album) => {
            const albumMeta = dict.gallery.albums[album.titleKey];
            return (
              <button
                key={album.id}
                ref={(el) => {
                  triggerRefs.current[album.id] = el;
                }}
                type="button"
                onClick={() => setOpenProjectId(album.id)}
                className={cardButtonClass}
              >
                <GalleryCardFrame />
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm">
                  <Image
                    src={album.cover.src}
                    alt={albumMeta.alts[0]}
                    fill
                    loading="lazy"
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="bg-surface-light object-cover"
                  />
                  {/* Mobile/Tablet: original overlay label (unchanged), hidden on Desktop */}
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/90 via-background/10 to-transparent p-3 lg:hidden">
                    <span className="text-xs font-semibold tracking-[0.15em] text-gold">
                      {dict.gallery.albumNumberLabel}
                      {album.number}
                    </span>
                    <span className="font-heading text-sm font-bold text-text sm:text-base">
                      {albumMeta.title}
                    </span>
                  </div>
                </div>
                {/* Desktop-only: separate text block below the photo, divided by a gold line */}
                <div className="relative hidden min-h-[64px] flex-1 flex-col justify-center gap-0.5 border-t border-gold/50 px-3 py-2 text-left lg:flex">
                  <span className="text-xs font-semibold tracking-[0.15em] text-gold">
                    {dict.gallery.albumNumberLabel}
                    {album.number}
                  </span>
                  <span className="font-heading text-sm font-bold text-text sm:text-base">
                    {albumMeta.title}
                  </span>
                </div>
              </button>
            );
          })}

          {galleryImages.map((image, index) => {
            const id = `showcase-${String(index + 1).padStart(2, "0")}`;
            const mobileAspect = image.width === image.height ? "aspect-square" : "aspect-[4/5]";
            return (
              <button
                key={image.src}
                ref={(el) => {
                  triggerRefs.current[id] = el;
                }}
                type="button"
                onClick={() => setOpenProjectId(id)}
                aria-label={`${dict.gallery.heading} ${index + 1}`}
                className={cardButtonClass}
              >
                <GalleryCardFrame />
                <div
                  className={`relative w-full overflow-hidden rounded-sm bg-surface ${mobileAspect} lg:aspect-[4/3]`}
                />
                {/* Desktop-only: reserves the same outer card height as the album card (no divider, no text). */}
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
          project={activeProject}
          onClose={closeModal}
          onNavigate={closeForNavigation}
        />
      )}
    </section>
  );
}
