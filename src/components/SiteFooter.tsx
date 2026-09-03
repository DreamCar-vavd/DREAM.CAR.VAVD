import Link from "next/link";
import type { Dictionary } from "@/content/types";
import type { Locale } from "@/lib/i18n/config";
import { getNavItems } from "@/lib/nav";
import { emailDisplay, emailHref, phoneDisplay, phoneHref } from "@/lib/social";
import { DreamLogo } from "./DreamLogo";
import { SocialLinks } from "./SocialLinks";

export function SiteFooter({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const items = getNavItems(dict, locale);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-gold bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <DreamLogo
            alt={dict.meta.siteName}
            sizes="81px"
            wrapperClassName="inline-block aspect-[1413/800] h-[46px]"
          />
          <p className="mt-4 max-w-xs text-sm text-muted">{dict.footer.description}</p>
        </div>

        <nav aria-label={dict.nav.footerLabel}>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted">
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors duration-300 hover:text-gold">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4">
          <a href={phoneHref} className="text-sm text-text transition-colors hover:text-gold">
            {phoneDisplay}
          </a>
          <a href={emailHref} className="text-sm text-text transition-colors hover:text-gold">
            {emailDisplay}
          </a>
          <SocialLinks />
        </div>
      </div>

      <div className="border-t border-border-gold/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {year} {dict.meta.siteName}. {dict.footer.rights}
          </p>
          <div className="flex gap-4">
            <Link href={`/${locale}/privacy-policy`} className="hover:text-gold">
              {dict.footer.privacy}
            </Link>
            <Link href={`/${locale}/cookies`} className="hover:text-gold">
              {dict.footer.cookies}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
