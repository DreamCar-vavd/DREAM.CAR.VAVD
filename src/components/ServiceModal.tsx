"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type MouseEvent } from "react";
import { useDialogFocusTrap } from "@/lib/useDialogFocusTrap";
import type { ServiceSection } from "@/content/types";
import { GoldLink } from "./GoldButton";
import { setRequestedService } from "@/lib/serviceContactIntent";
import { isModifiedClick } from "@/lib/isModifiedClick";

export interface ServiceModalContent {
  title: string;
  description: string;
  bullets?: string[];
  modalLead?: string;
  modalDescription?: string;
  modalSections?: ServiceSection[];
}

export function ServiceModal({
  content,
  closeLabel,
  onClose,
  onNavigate,
  slug,
  contactHref,
  contactCtaLabel,
}: {
  content: ServiceModalContent;
  closeLabel: string;
  onClose: () => void;
  onNavigate: () => void;
  slug: string;
  contactHref: string;
  contactCtaLabel: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Closes the modal (restoring body scroll via useDialogFocusTrap's own
  // cleanup) and hands the requested service slug to the contact form
  // (see serviceContactIntent.ts) — ContactForm both consumes it at mount
  // and listens live to pre-select a matching <option>, if any.
  //
  // Uses `onNavigate`, not `onClose`: this CTA navigates the page to
  // `#contacts`, so — unlike the X button/backdrop/Escape, which use
  // `onClose` and correctly return focus to the card that opened this
  // modal — returning focus to that same card here would strand a
  // keyboard/screen-reader user on an element that's now scrolled far
  // off-screen (confirmed with real keyboard events while testing this).
  // ContactForm moves focus to the contacts heading itself once the hash
  // navigation lands.
  function handleContactClick(event: MouseEvent<HTMLAnchorElement>) {
    // A Ctrl/Cmd/Shift/Alt/middle-click opens the link in a new tab — this
    // tab isn't navigating anywhere, so it must not close this modal or
    // write a same-tab contact-intent that could later misfire on an
    // unrelated visit (see isModifiedClick.ts). Default browser behavior
    // (open in new tab) proceeds untouched.
    if (isModifiedClick(event)) return;
    setRequestedService(slug);
    onNavigate();
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={content.title}
      className="fixed inset-0 z-[60] flex animate-in items-center justify-center bg-background/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-sm border border-border-gold bg-surface p-8 shadow-[0_0_30px_rgba(212,175,55,0.15)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border-gold text-gold transition-colors duration-300 hover:bg-gold/10"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <h2 className="font-heading pr-10 text-2xl font-bold text-gold">{content.title}</h2>
        {content.modalSections && content.modalSections.length > 0 ? (
          <>
            {content.modalLead && (
              <p className="mt-2 text-sm font-medium text-muted">{content.modalLead}</p>
            )}
            <div className="mt-4 flex flex-col gap-6">
              {content.modalSections.map((section) => (
                <div key={section.heading}>
                  <h3 className="font-heading text-lg font-semibold text-gold">{section.heading}</h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted">
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        ) : content.modalDescription ? (
          <>
            {content.modalLead && (
              <p className="mt-2 text-sm font-medium text-muted">{content.modalLead}</p>
            )}
            <p className="mt-4 text-base leading-relaxed text-text">{content.modalDescription}</p>
          </>
        ) : (
          <>
            <p className="mt-4 text-base leading-relaxed text-text">{content.description}</p>
            {content.bullets && content.bullets.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {content.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-muted">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                      aria-hidden="true"
                    />
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <GoldLink href={contactHref} onClick={handleContactClick} className="mt-6">
          {contactCtaLabel}
        </GoldLink>
      </div>
    </div>
  );
}
