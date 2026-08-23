"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Images, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CarListing } from "@/content/carListings";
import type { CarListingCopy } from "@/content/types";

interface GalleryLabels {
  status: string;
  closeGallery: string;
  previousPhoto: string;
  nextPhoto: string;
  contactCta: string;
  photoAlt: string;
  videoAlt: string;
}

type MediaItem =
  | { type: "photo"; src: string }
  | { type: "video"; src: string; posterSrc: string };

export function CarListingGallery({
  listing,
  copy,
  labels,
  contactHref,
}: {
  listing: CarListing;
  copy: CarListingCopy;
  labels: GalleryLabels;
  contactHref: string;
}) {
  const media: MediaItem[] = [
    ...listing.photos.map((photo) => ({ type: "photo" as const, src: photo.src })),
    ...(listing.videos ?? []).map((video) => ({
      type: "video" as const,
      src: video.src,
      posterSrc: video.posterSrc,
    })),
  ];

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const showPrevious = useCallback(() => {
    videoRef.current?.pause();
    setActiveIndex((current) => (current - 1 + media.length) % media.length);
  }, [media.length]);
  const showNext = useCallback(() => {
    videoRef.current?.pause();
    setActiveIndex((current) => (current + 1) % media.length);
  }, [media.length]);

  const close = useCallback(() => {
    videoRef.current?.pause();
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const video = videoRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };
    // Escape is handled separately, in the capture phase: the native
    // <video controls> shadow DOM can otherwise keep the key from ever
    // reaching this bubble-phase listener once it has focus.
    const handleEscapeCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // Focus trap, also in the capture phase so it still applies when
    // focus is inside the native <video controls> shadow DOM. Only the
    // boundary (first/last focusable, or focus having escaped the
    // dialog entirely) is intercepted — everything in between,
    // including the video's own internal control navigation, is left
    // to the browser's default Tab handling.
    const handleTabCapture = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, a[href], video, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const isInside = dialog.contains(active);

      if (event.shiftKey) {
        if (!isInside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!isInside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", handleEscapeCapture, true);
    window.addEventListener("keydown", handleTabCapture, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", handleEscapeCapture, true);
      window.removeEventListener("keydown", handleTabCapture, true);
      video?.pause();
    };
  }, [close, isOpen, showNext, showPrevious]);

  function selectIndex(index: number) {
    videoRef.current?.pause();
    setActiveIndex(index);
  }

  const activeMedia = media[activeIndex];

  return (
    <>
      <article className="group relative rounded-sm border border-border-gold/50 p-[3px] transition-[transform,box-shadow] duration-[280ms] ease-out hover:scale-[1.015] hover:shadow-[0_0_35px_rgba(212,175,55,0.2)] motion-reduce:transition-none motion-reduce:hover:scale-100">
        <div className="flex h-full flex-col overflow-hidden rounded-sm border border-border-gold/30 bg-surface">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen(true)}
            className="relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden bg-surface-light text-left"
            aria-label={`${copy.viewGallery}: ${copy.title}`}
          >
            <Image
              src={listing.photos[0].src}
              alt={copy.title}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 90vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
            <span className="absolute left-3 top-3 rounded-sm border border-gold bg-background/85 px-2.5 py-1 text-xs font-semibold tracking-wide text-gold">
              {labels.status}
            </span>
            <span className="absolute bottom-3 right-3 flex items-center gap-2 rounded-sm border border-gold/70 bg-background/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gold">
              <Images aria-hidden="true" size={16} /> {copy.viewGallery}
            </span>
          </button>
          <div className="flex flex-1 flex-col gap-1.5 p-5">
            <h2 className="font-heading text-lg font-bold text-text">{copy.title}</h2>
            <p className="text-sm text-muted">{copy.year} • {copy.specLine}</p>
            <p className="text-sm text-muted">{copy.mileage}</p>
            <p className="mt-2 font-heading text-xl font-bold text-gold">{copy.price}</p>
          </div>
        </div>
      </article>

      {isOpen && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 backdrop-blur-md sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`${copy.title} — ${copy.viewGallery}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="relative max-h-[96vh] w-full max-w-[1540px] overflow-y-auto border border-gold/80 bg-[#080808] p-[3px] shadow-[0_0_70px_rgba(212,175,55,0.2)]">
            <div className="relative border border-gold/35 bg-[radial-gradient(circle_at_75%_15%,rgba(212,175,55,0.08),transparent_32%),#090909] p-4 sm:p-7">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-gold text-gold transition-colors hover:bg-gold hover:text-black sm:right-5 sm:top-5"
                aria-label={labels.closeGallery}
              >
                <X aria-hidden="true" size={22} />
              </button>

              <div className="grid gap-7 pt-12 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.75fr)] lg:pt-0">
                <div className="min-w-0">
                  <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden border border-gold/35 bg-black sm:min-h-[520px] lg:h-[min(62vh,720px)]">
                    {activeMedia.type === "photo" ? (
                      <Image
                        src={activeMedia.src}
                        alt={`${copy.title} — ${labels.photoAlt} ${activeIndex + 1}`}
                        fill
                        sizes="(min-width: 1024px) 70vw, 100vw"
                        className="object-contain"
                        priority
                      />
                    ) : (
                      <video
                        ref={videoRef}
                        src={activeMedia.src}
                        poster={activeMedia.posterSrc}
                        controls
                        playsInline
                        preload="metadata"
                        aria-label={`${copy.title} — ${labels.videoAlt}`}
                        className="h-full w-full object-contain"
                      />
                    )}
                    <button type="button" onClick={showPrevious} aria-label={labels.previousPhoto} className="absolute left-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-gold bg-black/75 text-gold transition-colors hover:bg-gold hover:text-black">
                      <ChevronLeft aria-hidden="true" />
                    </button>
                    <button type="button" onClick={showNext} aria-label={labels.nextPhoto} className="absolute right-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-gold bg-black/75 text-gold transition-colors hover:bg-gold hover:text-black">
                      <ChevronRight aria-hidden="true" />
                    </button>
                    <span className="absolute bottom-3 left-3 border border-gold/60 bg-black/80 px-3 py-1.5 text-sm tracking-widest text-gold">
                      {String(activeIndex + 1).padStart(2, "0")} / {String(media.length).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {media.map((item, index) => (
                      <button
                        key={item.src}
                        type="button"
                        onClick={() => selectIndex(index)}
                        className={`relative h-20 w-24 shrink-0 overflow-hidden border bg-black transition-colors sm:h-24 sm:w-28 ${index === activeIndex ? "border-gold shadow-[0_0_18px_rgba(212,175,55,0.35)]" : "border-gold/25 hover:border-gold/70"}`}
                        aria-label={
                          item.type === "video"
                            ? `${copy.title} — ${labels.videoAlt}`
                            : `${copy.title} — ${labels.photoAlt} ${index + 1}`
                        }
                        aria-current={index === activeIndex ? "true" : undefined}
                      >
                        <Image
                          src={item.type === "video" ? item.posterSrc : item.src}
                          alt=""
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                        {item.type === "video" && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                            <Play aria-hidden="true" size={22} className="fill-gold text-gold" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <aside className="flex flex-col justify-center border-t border-gold/30 pt-7 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  <div className="relative h-24 w-full max-w-[330px] overflow-hidden sm:h-32" aria-label="DREAM.CAR.VAVD Automotive Services">
                    <Image
                      src="/images/cars-for-sale-gallery-logo.png"
                      alt="DREAM.CAR.VAVD Automotive Services"
                      fill
                      sizes="330px"
                      className="object-contain object-left"
                    />
                  </div>
                  <h2 className="mt-4 font-heading text-3xl font-bold text-text sm:text-4xl">{copy.title}</h2>
                  <div className="my-6 h-px bg-gradient-to-r from-gold/80 to-transparent" />
                  <div className="space-y-3 text-base text-muted sm:text-lg">
                    <p>{copy.year}</p>
                    <p>{copy.specLine}</p>
                    <p>{copy.mileage}</p>
                  </div>
                  <p className="my-7 font-heading text-4xl font-bold text-gold sm:text-5xl">{copy.price}</p>
                  <Link href={contactHref} onClick={close} className="inline-flex min-h-12 items-center justify-center border border-gold bg-gradient-to-b from-[#e2c35b] to-[#a9780b] px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-black transition-[filter,transform] hover:brightness-110 active:scale-[0.99]">
                    {labels.contactCta}
                  </Link>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
