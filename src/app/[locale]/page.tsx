import { Phone, Mail, MessageCircle } from "lucide-react";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getGalleryMedia } from "@/lib/content/publishedGallery";
import { getServicesMeta } from "@/lib/content/publishedServices";
import { getPromoSlots } from "@/lib/content/publishedPromos";
import { hoursRows } from "@/lib/content/businessHours";
import { notFound } from "next/navigation";
import { HeroSection } from "@/components/HeroSection";
import { ServicesGrid } from "@/components/ServicesGrid";
import { CarsForSaleSection } from "@/components/CarsForSaleSection";
import { ProcessTimeline } from "@/components/ProcessTimeline";
import { BenefitsSection } from "@/components/BenefitsSection";
import { GalleryGrid } from "@/components/GalleryGrid";
import { AboutSection } from "@/components/AboutSection";
import { FaqAccordion } from "@/components/FaqAccordion";
import { ContactForm } from "@/components/ContactForm";
import { GoldLink } from "@/components/GoldButton";
import { SocialLinks } from "@/components/SocialLinks";
import { PromoBanners, PromoSection } from "@/components/PromoSection";

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  const dict = await getDictionary(locale);
  const hours = hoursRows(dict.contact.businessHours);
  const [galleryMedia, serviceMeta, promos] = await Promise.all([
    getGalleryMedia(),
    getServicesMeta(locale),
    getPromoSlots(locale),
  ]);

  return (
    <>
      <PromoBanners banners={promos.banners} />
      <HeroSection dict={dict} locale={locale} />
      <ServicesGrid dict={dict} locale={locale} serviceMeta={serviceMeta} />
      <CarsForSaleSection dict={dict} locale={locale} />
      <ProcessTimeline dict={dict} />
      <BenefitsSection dict={dict} />
      <PromoSection cards={promos.cards} locale={locale} />
      <GalleryGrid dict={dict} locale={locale} media={galleryMedia} />
      <AboutSection dict={dict} />
      <FaqAccordion dict={dict} />

      <section id="contacts" className="scroll-mt-20 bg-background">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2
              id="contacts-heading"
              tabIndex={-1}
              className="font-heading text-3xl font-bold text-gold sm:text-4xl focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              {dict.contact.heading}
            </h2>
            {dict.contact.subheading && (
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-gold sm:text-base">
                {dict.contact.subheading}
              </p>
            )}
            {dict.contact.serviceArea && <p className="mt-1.5 text-text">{dict.contact.serviceArea}</p>}

            <div className="mt-6 max-w-md">
              <hr className="border-border-gold/50" />
              <dl className="my-5 grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-3">
                <dt className="flex items-center gap-3 text-gold">
                  <Phone size={18} aria-hidden="true" />
                  {dict.contact.labels.phone}
                </dt>
                <dd>
                  <a href={dict.contact.phoneHref} className="text-text transition-colors hover:text-gold">
                    {dict.contact.phone}
                  </a>
                </dd>
                <dt className="flex items-center gap-3 text-gold">
                  <Mail size={18} aria-hidden="true" />
                  {dict.contact.labels.email}
                </dt>
                <dd className="min-w-0 break-words">
                  <a href={dict.contact.emailHref} className="text-text transition-colors hover:text-gold">
                    {dict.contact.email}
                  </a>
                </dd>
              </dl>
              <hr className="border-border-gold/50" />

              {hours.length > 0 && (
                <>
                  <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-gold sm:text-base">
                    {dict.contact.labels.hoursHeading}
                  </h3>
                  <dl className="my-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                    {hours.map((row) => (
                      <div key={row.day} className="contents">
                        <dt className="text-gold">
                          {row.day === "weekdays"
                            ? dict.contact.labels.weekdays
                            : row.day === "saturday"
                              ? dict.contact.labels.saturday
                              : dict.contact.labels.sunday}
                        </dt>
                        <dd className="text-text">
                          {typeof row.time === "string"
                            ? row.time === "closed"
                              ? dict.contact.labels.closed
                              : dict.contact.labels.byAppointment
                            : `${row.time.open}–${row.time.close}`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <hr className="border-border-gold/50" />
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-4">
              {dict.contact.addressText && (
                <p className="flex items-start gap-3 text-sm text-muted">
                  <span className="font-semibold text-gold">
                    {dict.contact.addressLabel || "Адреса"}:
                  </span>
                  {dict.contact.mapsUrl ? (
                    <a
                      href={dict.contact.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gold"
                    >
                      {dict.contact.addressText}
                    </a>
                  ) : (
                    dict.contact.addressText
                  )}
                </p>
              )}
              <GoldLink
                href={dict.contact.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                className="whatsapp-cta w-fit"
              >
                <MessageCircle size={16} aria-hidden="true" />
                {dict.hero.ctaSecondary}
              </GoldLink>

              <SocialLinks className="mt-1" links={dict.contact} />
            </div>
          </div>

          <div className="rounded-sm border border-border-gold/60 bg-surface p-6 sm:p-8">
            <ContactForm dict={dict} locale={locale} />
          </div>
        </div>
      </section>
    </>
  );
}
