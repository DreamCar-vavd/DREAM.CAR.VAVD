"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogFocusTrap } from "@/lib/useDialogFocusTrap";
import {
  servicePhotoAlt,
  usableServicePhotos,
  type ServicePhotoInput,
} from "@/lib/content/servicePhotos";

export type ServicePhoto = ServicePhotoInput;

export interface ServicePhotosLabels {
  /** Section heading, e.g. "Фотографії" */
  heading: string;
  /** "Photo" — used for generated alt text when a photo has no caption */
  photoAlt: string;
  closeGallery: string;
  previousPhoto: string;
  nextPhoto: string;
}

/**
 * Read-only photo strip for a published service page. Renders nothing when
 * there are no usable photos, so the page stays clean without a placeholder.
 *
 * The images are the exact files the panel committed for this service
 * (`/images/cms/services/<slug>/photos/<i>/image.<ext>`). Each deployment is
 * a single git checkout, so on any one deployment `published.json` and these
 * files come from the same commit. A photo the owner removes or replaces in
 * Keystatic only reaches a LATER deployment; if they delete a photo in the
 * working copy and do NOT re-publish, the still-published older photo path
 * can 404 on the next deployment. `onError` then hides that one tile instead
 * of showing a broken image, and the fix is to re-publish. See
 * docs/PANEL-service-photos.md.
 */
export function ServicePhotos({
  photos,
  title,
  labels,
}: {
  photos: ServicePhoto[];
  title: string;
  labels: ServicePhotosLabels;
}) {
  const usable = usableServicePhotos(photos);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const shown = usable.filter((p) => !broken.has(p.src));

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const markBroken = (src: string) =>
    setBroken((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });

  const close = useCallback(() => setOpen(false), []);
  const showPrev = useCallback(
    () => setActiveIndex((c) => (c - 1 + shown.length) % shown.length),
    [shown.length],
  );
  const showNext = useCallback(
    () => setActiveIndex((c) => (c + 1) % shown.length),
    [shown.length],
  );

  useDialogFocusTrap(dialogRef, open, close);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, showPrev, showNext]);

  if (shown.length === 0) return null;

  const safeIndex = Math.min(activeIndex, shown.length - 1);
  const active = shown[safeIndex];
  const altFor = (photo: ServicePhoto, index: number) =>
    servicePhotoAlt({ caption: photo.caption, title, photoWord: labels.photoAlt, index });

  function openAt(index: number) {
    setActiveIndex(index);
    setOpen(true);
  }

  return (
    <section className="mt-10" aria-label={labels.heading}>
      <h2 className="font-heading text-lg font-bold text-gold">{labels.heading}</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((photo, index) => (
          <li key={photo.src}>
            <button
              ref={index === 0 ? triggerRef : undefined}
              type="button"
              onClick={() => openAt(index)}
              className="group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-sm border border-border-gold/40 bg-surface-light transition-colors hover:border-gold/70"
              aria-label={altFor(photo, index)}
            >
              <Image
                src={photo.src}
                alt={altFor(photo, index)}
                fill
                sizes="(min-width: 640px) 30vw, 45vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                onError={() => markBroken(photo.src)}
              />
              <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-sm border border-gold/60 bg-background/85 px-2 py-1 text-[11px] font-semibold text-gold opacity-0 transition-opacity group-hover:opacity-100">
                <Images aria-hidden="true" size={14} />
              </span>
            </button>
            {photo.caption && <p className="mt-1.5 text-xs text-muted">{photo.caption}</p>}
          </li>
        ))}
      </ul>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={labels.heading}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="relative flex max-h-[94vh] w-full max-w-[1200px] flex-col overflow-y-auto border border-gold/80 bg-[#080808] p-[3px]">
            <div className="relative border border-gold/35 bg-[#090909] p-4 sm:p-6">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-gold text-gold transition-colors hover:bg-gold hover:text-black"
                aria-label={labels.closeGallery}
              >
                <X aria-hidden="true" size={22} />
              </button>

              <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden border border-gold/35 bg-black pt-12 sm:min-h-[440px] sm:pt-0">
                <div
                  className="relative max-h-[70vh] w-full"
                  style={{ aspectRatio: `${active.width} / ${active.height}` }}
                >
                  <Image
                    src={active.src}
                    alt={altFor(active, safeIndex)}
                    fill
                    sizes="(min-width: 1024px) 70vw, 100vw"
                    className="object-contain"
                    fetchPriority="high"
                    onError={() => markBroken(active.src)}
                  />
                </div>
                {shown.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={showPrev}
                      aria-label={labels.previousPhoto}
                      className="absolute left-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-gold bg-black/75 text-gold transition-colors hover:bg-gold hover:text-black"
                    >
                      <ChevronLeft aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={showNext}
                      aria-label={labels.nextPhoto}
                      className="absolute right-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-gold bg-black/75 text-gold transition-colors hover:bg-gold hover:text-black"
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                    <span className="absolute bottom-3 left-3 border border-gold/60 bg-black/80 px-3 py-1.5 text-sm tracking-widest text-gold">
                      {String(safeIndex + 1).padStart(2, "0")} /{" "}
                      {String(shown.length).padStart(2, "0")}
                    </span>
                  </>
                )}
              </div>

              {active.caption && <p className="mt-3 text-sm text-muted">{active.caption}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
