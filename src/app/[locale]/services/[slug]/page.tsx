import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { locales, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { serviceSlugs, services } from "@/content/services";
import { siteUrl } from "@/lib/site";
import { whatsappUrl } from "@/lib/social";
import { GoldLink } from "@/components/GoldButton";
import type { ServiceSlug } from "@/content/types";

interface RouteParams {
  locale: string;
  slug: string;
}

export function generateStaticParams() {
  return locales.flatMap((locale) => serviceSlugs.map((slug) => ({ locale, slug })));
}

function isServiceSlug(value: string): value is ServiceSlug {
  return (serviceSlugs as string[]).includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam) || !isServiceSlug(slug)) return {};
  const dict = await getDictionary(localeParam);
  const copy = dict.services[slug];

  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${siteUrl}/${l}/services/${slug}`;
  }

  return {
    title: `${copy.title} — ${dict.meta.siteName}`,
    description: copy.shortDescription,
    alternates: {
      canonical: `${siteUrl}/${localeParam}/services/${slug}`,
      languages,
    },
    openGraph: {
      title: `${copy.title} — ${dict.meta.siteName}`,
      description: copy.shortDescription,
      url: `${siteUrl}/${localeParam}/services/${slug}`,
      type: "website",
    },
  };
}

export default async function ServicePage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam) || !isServiceSlug(slug)) notFound();
  const locale: Locale = localeParam;
  const dict = await getDictionary(locale);
  const copy = dict.services[slug];
  const meta = services.find((s) => s.slug === slug)!;
  const Icon = meta.icon;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: dict.nav.home, item: `${siteUrl}/${locale}` },
      {
        "@type": "ListItem",
        position: 2,
        name: dict.servicesSection.heading,
        item: `${siteUrl}/${locale}#services`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: copy.title,
        item: `${siteUrl}/${locale}/services/${slug}`,
      },
    ],
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Link
        href={`/${locale}#services`}
        className="inline-flex items-center gap-2 text-sm font-medium text-gold transition-colors hover:text-gold-light"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {dict.common.backToServices}
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border-gold text-gold">
          <Icon className="h-[26px] w-[26px]" aria-hidden="true" />
        </span>
        <h1 className="font-heading text-3xl font-bold text-gold sm:text-4xl">{copy.title}</h1>
      </div>

      <p className="mt-6 text-lg text-muted">{copy.longDescription}</p>

      <ul className="mt-8 flex flex-col gap-3">
        {copy.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 text-text">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
            {bullet}
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <GoldLink href={`/${locale}#contacts`} variant="solid">
          {dict.common.consultationCta}
        </GoldLink>
        <GoldLink href={whatsappUrl} target="_blank" rel="noopener noreferrer" variant="outline" className="whatsapp-cta">
          <MessageCircle size={16} aria-hidden="true" />
          {dict.common.whatsappCta}
        </GoldLink>
      </div>
    </section>
  );
}
