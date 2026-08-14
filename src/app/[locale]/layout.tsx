import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Playfair_Display, Manrope } from "next/font/google";
import { locales, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { siteUrl } from "@/lib/site";
import { phoneDisplay, emailDisplay } from "@/lib/social";
import { getSocialLinks } from "@/lib/social";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "../globals.css";

const heading = Playfair_Display({
  variable: "--font-heading-src",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["600", "700"],
});

const body = Manrope({
  variable: "--font-body-src",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) return {};
  const locale = localeParam;
  const dict = await getDictionary(locale);

  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${siteUrl}/${l}`;
  }
  languages["x-default"] = `${siteUrl}/${locales[0]}`;

  return {
    metadataBase: new URL(siteUrl),
    title: dict.meta.homeTitle,
    description: dict.meta.homeDescription,
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages,
    },
    openGraph: {
      title: dict.meta.homeTitle,
      description: dict.meta.homeDescription,
      url: `${siteUrl}/${locale}`,
      siteName: dict.meta.siteName,
      locale,
      type: "website",
      images: [{ url: "/images/dream-car-logo.png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.homeTitle,
      description: dict.meta.homeDescription,
      images: ["/images/dream-car-logo.png"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  const dict = await getDictionary(locale);
  const social = getSocialLinks();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: dict.meta.siteName,
    url: `${siteUrl}/${locale}`,
    image: `${siteUrl}/images/dream-car-logo.png`,
    telephone: phoneDisplay,
    email: emailDisplay,
    areaServed: "GB",
    ...(process.env.NEXT_PUBLIC_BUSINESS_ADDRESS
      ? { address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS }
      : {}),
    ...(social.length > 0 ? { sameAs: social.map((s) => s.url) } : {}),
  };

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${heading.variable} ${body.variable}`}
    >
      <body className="flex min-h-dvh flex-col bg-background text-text antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SiteHeader dict={dict} locale={locale} />
        <main className="flex-1">{children}</main>
        <SiteFooter dict={dict} locale={locale} />
      </body>
    </html>
  );
}
