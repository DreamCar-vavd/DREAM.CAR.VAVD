"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useDialogFocusTrap } from "@/lib/useDialogFocusTrap";
import type { ServiceSection } from "@/content/types";

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
}: {
  content: ServiceModalContent;
  closeLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

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
      </div>
    </div>
  );
}
