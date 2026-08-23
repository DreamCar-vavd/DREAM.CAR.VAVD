"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { locales, type Locale } from "@/lib/i18n/config";

const labels: Record<Locale, { flag: string; code: string }> = {
  uk: { flag: "🇺🇦", code: "UA" },
  ru: { flag: "🇷🇺", code: "RU" },
  en: { flag: "🇬🇧", code: "EN" },
};

function pathForLocale(pathname: string, locale: Locale) {
  const segments = pathname.split("/");
  segments[1] = locale;
  return segments.join("/") || "/";
}

export function LanguageSwitcher({
  currentLocale,
  label,
  variant = "full",
}: {
  currentLocale: Locale;
  label: string;
  variant?: "full" | "compact";
}) {
  const pathname = usePathname();

  if (variant === "compact") {
    return (
      <CompactLanguageSwitcher currentLocale={currentLocale} label={label} pathname={pathname} />
    );
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      {locales.map((locale) => {
        const { flag, code } = labels[locale];
        const active = locale === currentLocale;
        return (
          <Link
            key={locale}
            href={pathForLocale(pathname, locale)}
            aria-current={active ? "true" : undefined}
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-sm border px-2 py-1.5 text-[10px] font-bold transition-colors duration-300 ${
              active
                ? "border-gold bg-gold/10 text-gold"
                : "border-border-gold text-text hover:bg-gold/10"
            }`}
          >
            <span className="text-base leading-none" aria-hidden="true">
              {flag}
            </span>
            {code}
          </Link>
        );
      })}
    </div>
  );
}

function CompactLanguageSwitcher({
  currentLocale,
  label,
  pathname,
}: {
  currentLocale: Locale;
  label: string;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;

    firstOptionRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const current = labels[currentLocale];
  const otherLocales = locales.filter((locale) => locale !== currentLocale);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-sm border border-border-gold px-2 text-xs font-bold text-text transition-colors duration-300 hover:bg-gold/10"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {current.flag}
        </span>
        {current.code}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          aria-label={label}
          className="absolute right-0 top-[calc(100%+8px)] z-50 flex flex-col gap-1 whitespace-nowrap rounded-sm border border-border-gold bg-background p-1.5 shadow-lg"
        >
          {otherLocales.map((locale, index) => {
            const { flag, code } = labels[locale];
            return (
              <li key={locale}>
                <Link
                  ref={index === 0 ? firstOptionRef : undefined}
                  href={pathForLocale(pathname, locale)}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-sm px-3 text-sm font-bold text-text transition-colors duration-300 hover:bg-gold/10"
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {flag}
                  </span>
                  {code}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
