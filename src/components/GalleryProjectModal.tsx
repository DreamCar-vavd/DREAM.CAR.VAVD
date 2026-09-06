"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import { Car, Check, ClipboardCheck, ShieldCheck, User, X } from "lucide-react";
import type { Dictionary } from "@/content/types";
import type { Locale } from "@/lib/i18n/config";
import { DreamLogo } from "./DreamLogo";
import { GoldLink } from "./GoldButton";
import { WhatsAppIcon } from "./icons/SocialIcons";
import { whatsappUrl } from "@/lib/social";
import { useDialogFocusTrap } from "@/lib/useDialogFocusTrap";
import { isModifiedClick } from "@/lib/isModifiedClick";
import { focusContactsHeading } from "@/lib/focusContactsHeading";

/**
 * Read-only gallery-project modal. Content is now edited in the management
 * panel (/keystatic + /panel); the former in-modal dev editor and its
 * /api/gallery-projects backend were removed with the panel work.
 */
export interface GalleryModalProject {
  id: string;
  images: { src: string; width: number; height: number }[];
}

export function GalleryProjectModal({
  dict,
  locale,
  project,
  onClose,
  onNavigate,
}: {
  dict: Dictionary;
  locale: Locale;
  project: GalleryModalProject;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const copy = dict.gallery.projects[project.id];
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeImage = project.images[activeIndex];

  useDialogFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    closeButtonRef.current?.focus();
    return () => cancelAnimationFrame(frame);
  }, []);

  // Closes the modal (via `onNavigate`, not `onClose` — see its comment on
  // the `GalleryGrid` call site for why) and moves focus onto the contacts
  // heading. Without this, the link's default navigation still ran (the URL
  // hash did change to `#contacts`), but nothing ever told this modal to stop
  // rendering: its full-screen overlay kept covering the page, making the CTA
  // look like it did nothing at all — confirmed by reproducing the reported
  // bug before writing this fix.
  function handleContactClick(event: MouseEvent<HTMLAnchorElement>) {
    if (isModifiedClick(event)) return;
    onNavigate();
    focusContactsHeading();
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-background/90 p-4 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-y-auto rounded-md border border-gold bg-background shadow-[0_0_40px_rgba(212,175,55,0.15)] transition-all duration-[250ms] ease-out motion-reduce:transition-none ${
          mounted ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.98] opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border-gold/50 px-5 py-3 sm:px-6">
          <DreamLogo
            alt={dict.meta.siteName}
            sizes="64px"
            wrapperClassName="inline-block aspect-[1413/800] h-9"
          />
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={dict.gallery.lightboxClose}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-gold text-gold transition-colors duration-300 hover:bg-gold/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[3fr_2fr] lg:gap-8 lg:p-8">
          <div>
            <div
              className="relative w-full overflow-hidden rounded-sm border border-border-gold/50 bg-surface"
              style={{ aspectRatio: `${activeImage.width} / ${activeImage.height}` }}
            >
              <Image
                src={activeImage.src}
                alt={`${copy.title} — ${activeIndex + 1}`}
                fill
                sizes="(min-width: 1024px) 60vw, 90vw"
                className="object-contain"
                priority
              />
            </div>

            {project.images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {project.images.map((image, index) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`${copy.title} — ${index + 1}`}
                    aria-current={index === activeIndex}
                    className={`relative overflow-hidden rounded-sm border transition-colors duration-300 ${
                      index === activeIndex
                        ? "border-2 border-gold"
                        : "border-border-gold/40 hover:border-gold/70"
                    }`}
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    <Image src={image.src} alt="" fill sizes="10vw" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-heading text-2xl font-bold text-gold sm:text-3xl">
                {copy.title}
                {copy.year ? `, ${copy.year}` : ""}
              </h2>
            </div>
            <p className="mt-1 text-text">{copy.service}</p>

            <div className="mt-4 border-t border-border-gold/40 pt-4">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-wide text-gold">
                <User size={18} aria-hidden="true" />
                {dict.gallery.modal.clientRequestLabel}
              </h3>
              <p className="mt-2 text-sm text-muted">{copy.clientRequest}</p>
            </div>

            <div className="mt-4 border-t border-border-gold/40 pt-4">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-wide text-gold">
                <ClipboardCheck size={18} aria-hidden="true" />
                {dict.gallery.modal.checkedLabel}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {copy.completedItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted">
                    <Check size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 border-t border-border-gold/40 pt-4">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-wide text-gold">
                <ShieldCheck size={18} aria-hidden="true" />
                {dict.gallery.modal.resultLabel}
              </h3>
              <p className="mt-2 text-sm text-muted">{copy.result}</p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <GoldLink
                href={`/${locale}#contacts`}
                onClick={handleContactClick}
                variant="solid"
                className="w-full whitespace-nowrap sm:w-auto"
              >
                <Car size={16} aria-hidden="true" />
                {dict.common.consultationCta}
              </GoldLink>
              <GoldLink
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                className="whatsapp-cta w-full whitespace-nowrap sm:w-auto"
              >
                <WhatsAppIcon className="h-4 w-4" />
                {dict.common.whatsappCta}
              </GoldLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
