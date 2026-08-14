"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Phone } from "lucide-react";
import type { NavItem } from "@/lib/nav";
import type { Locale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { phoneDisplay, phoneHref } from "@/lib/social";

export function MobileMenu({
  items,
  locale,
  phoneLabel,
  navLabel,
  openMenuLabel,
  closeMenuLabel,
  languageLabel,
}: {
  items: NavItem[];
  locale: Locale;
  phoneLabel: string;
  navLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
  languageLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-label={open ? closeMenuLabel : openMenuLabel}
        aria-expanded={open}
        aria-controls="mobile-drawer"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-sm border border-border-gold text-gold"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id="mobile-drawer"
            className="fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col gap-6 overflow-y-auto bg-background/98 px-6 py-8"
          >
            <nav aria-label={navLabel}>
              <ul className="flex flex-col gap-5 text-lg">
                {items.map((item) => (
                  <li key={item.href}>
                    <a
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
              className="flex items-center gap-2 text-gold"
              aria-label={phoneLabel}
            >
              <Phone size={18} aria-hidden="true" />
              {phoneDisplay}
            </a>

            <LanguageSwitcher currentLocale={locale} label={languageLabel} />
          </div>,
          document.body,
        )}
    </div>
  );
}
