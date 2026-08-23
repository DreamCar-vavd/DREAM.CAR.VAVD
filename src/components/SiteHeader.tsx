import Link from "next/link";
import { Phone } from "lucide-react";
import type { Dictionary } from "@/content/types";
import type { Locale } from "@/lib/i18n/config";
import { getNavItems } from "@/lib/nav";
import { phoneDisplay, phoneHref } from "@/lib/social";
import { DreamLogo } from "./DreamLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";

export function SiteHeader({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const items = getNavItems(dict, locale);

  return (
    <header className="sticky top-0 z-50 border-b border-border-gold bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
        <Link href={`/${locale}`} className="flex shrink-0 items-center gap-2">
          <DreamLogo
            alt={dict.meta.siteName}
            priority
            wrapperClassName="inline-block aspect-[1413/800] h-[46px] xl:h-[55px]"
          />
        </Link>

        <nav aria-label={dict.nav.primaryLabel} className="hidden xl:block">
          <ul className="flex items-center gap-5 text-sm font-medium tracking-wide text-text xl:gap-6">
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors duration-300 hover:text-gold">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-6 xl:flex">
          <a
            href={phoneHref}
            className="flex items-center gap-2 text-sm font-semibold text-gold"
            aria-label={dict.common.phoneLabel}
          >
            <Phone size={16} aria-hidden="true" />
            {phoneDisplay}
          </a>
          <LanguageSwitcher currentLocale={locale} label={dict.common.languageLabel} />
        </div>

        <div className="flex items-center gap-3 xl:hidden">
          <a
            href={phoneHref}
            aria-label={dict.common.phoneLabel}
            className="flex h-11 w-11 items-center justify-center text-gold"
          >
            <Phone size={20} />
          </a>
          <LanguageSwitcher
            currentLocale={locale}
            label={dict.common.languageLabel}
            variant="compact"
          />
          <MobileMenu
            items={items}
            phoneLabel={dict.common.phoneLabel}
            navLabel={dict.nav.mobileLabel}
            openMenuLabel={dict.nav.openMenu}
            closeMenuLabel={dict.nav.closeMenu}
          />
        </div>
      </div>
    </header>
  );
}
