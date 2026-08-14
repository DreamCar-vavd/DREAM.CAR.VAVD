import type { Dictionary } from "@/content/types";

export interface NavItem {
  label: string;
  href: string;
}

export function getNavItems(dict: Dictionary, locale: string): NavItem[] {
  const base = `/${locale}`;
  return [
    { label: dict.nav.home, href: base },
    { label: dict.nav.services, href: `${base}#services` },
    { label: dict.nav.howWeWork, href: `${base}#how-we-work` },
    { label: dict.nav.gallery, href: `${base}#gallery` },
    { label: dict.nav.about, href: `${base}#about` },
    { label: dict.nav.faq, href: `${base}#faq` },
    { label: dict.nav.contacts, href: `${base}#contacts` },
  ];
}
