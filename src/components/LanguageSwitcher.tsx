"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
}: {
  currentLocale: Locale;
  label: string;
}) {
  const pathname = usePathname();

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
