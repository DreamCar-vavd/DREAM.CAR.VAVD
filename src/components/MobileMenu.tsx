"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Phone } from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { phoneDisplay, phoneHref } from "@/lib/social";
import { useDialogFocusTrap } from "@/lib/useDialogFocusTrap";

export function MobileMenu({
  items,
  phoneLabel,
  navLabel,
  openMenuLabel,
  closeMenuLabel,
}: {
  items: NavItem[];
  phoneLabel: string;
  navLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const closeAndReturnFocus = useCallback(() => {
    setOpen(false);
    toggleButtonRef.current?.focus();
  }, []);

  useDialogFocusTrap(drawerRef, open, closeAndReturnFocus, {
    trapFocus: false,
  });

  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        ref={toggleButtonRef}
        type="button"
        aria-label={open ? closeMenuLabel : openMenuLabel}
        aria-expanded={open}
        aria-controls="mobile-drawer"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-sm border border-border-gold text-gold"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={drawerRef}
            id="mobile-drawer"
            className="fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col gap-6 overflow-y-auto bg-background/98 px-6 py-8"
          >
            <nav aria-label={navLabel}>
              <ul className="flex flex-col gap-5 text-lg">
                {items.map((item, index) => (
                  <li key={item.href}>
                    <a
                      ref={index === 0 ? firstLinkRef : undefined}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center font-medium text-text transition-colors hover:text-gold"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <a
              href={phoneHref}
              className="flex min-h-11 items-center gap-2 text-gold"
              aria-label={phoneLabel}
            >
              <Phone size={18} aria-hidden="true" />
              {phoneDisplay}
            </a>
          </div>,
          document.body,
        )}
    </div>
  );
}
