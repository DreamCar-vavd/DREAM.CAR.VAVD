import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { locales, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPublishedServiceSlugs, getServicesMeta } from "@/lib/content/publishedServices";
import { siteUrl } from "@/lib/site";
import { GoldLink } from "@/components/GoldButton";
import { ServicePhotos } from "@/components/ServicePhotos";

interface RouteParams {
  locale: string;
  slug: string;
}

export async function generateStaticParams() {
  const slugs = await getPublishedServiceSlugs();
  return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};
  const dict = await getDictionary(localeParam);
  const copy = dict.services[slug];
  if (!copy) return {};
  const meta = (await getServicesMeta(localeParam)).find((s) => s.slug === slug);

  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${siteUrl}/${l}/services/${slug}`;
  }

  const title = meta?.seoTitle || `${copy.title} — ${dict.meta.siteName}`;
  const description = meta?.seoDescription || copy.shortDescription;

  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/${localeParam}/services/${slug}`, languages },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${localeParam}/services/${slug}`,
      type: "website",
      images: [{ url: "/images/dream-car-logo.png" }],
    },
  };
}

export default async function ServicePage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  const dict = await getDictionary(locale);
  const copy = dict.services[slug];
  const meta = (await getServicesMeta(locale)).find((s) => s.slug === slug);
  if (!copy || !meta) notFound();

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
          {meta.iconSrc && (
            <Image
              src={meta.iconSrc}
              alt=""
              width={28}
              height={28}
              quality={90}
              className="h-[26px] w-[26px] object-contain"
            />
          )}
        </span>
        <h1 className="font-heading text-3xl font-bold text-gold sm:text-4xl">{copy.title}</h1>
        {meta.status === "coming-soon" && (
          <span className="rounded-sm border border-gold/60 bg-background/85 px-2 py-0.5 text-xs font-semibold text-gold">
            {locale === "en" ? "Coming soon" : locale === "ru" ? "Скоро" : "Незабаром"}
          </span>
        )}
      </div>

      {meta.price && <p className="mt-4 font-heading text-xl font-bold text-gold">{meta.price}</p>}

      <p className="mt-6 text-lg text-muted">{copy.longDescription}</p>

      <ul className="mt-8 flex flex-col gap-3">
        {copy.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 text-text">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
            {bullet}
          </li>
        ))}
      </ul>

      <ServicePhotos
        photos={meta.photos}
        title={copy.title}
        labels={{
          heading: locale === "en" ? "Photos" : locale === "ru" ? "Фотографии" : "Фотографії",
          photoAlt: dict.carsForSale.photoAlt,
          closeGallery: dict.carsForSale.closeGallery,
          previousPhoto: dict.carsForSale.previousPhoto,
          nextPhoto: dict.carsForSale.nextPhoto,
        }}
      />

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <GoldLink href={`/${locale}#contacts`} variant="solid">
          {dict.common.consultationCta}
        </GoldLink>
        <GoldLink
          href={dict.contact.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          className="whatsapp-cta"
        >
          <MessageCircle size={16} aria-hidden="true" />
          {dict.common.whatsappCta}
        </GoldLink>
      </div>
    </section>
  );
}
