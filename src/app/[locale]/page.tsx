import { Phone, Mail, MessageCircle } from "lucide-react";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getGalleryMedia } from "@/lib/content/publishedGallery";
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
import { phoneDisplay, phoneHref, emailDisplay, emailHref, whatsappUrl } from "@/lib/social";

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  const dict = await getDictionary(locale);
  const galleryMedia = await getGalleryMedia();

  return (
    <>
      <HeroSection dict={dict} locale={locale} />
      <ServicesGrid dict={dict} locale={locale} />
      <CarsForSaleSection dict={dict} locale={locale} />
      <ProcessTimeline dict={dict} />
      <BenefitsSection dict={dict} />
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
            <p className="mt-3 max-w-md text-muted">{dict.contact.subheading}</p>

            <div className="mt-8 flex flex-col gap-4">
              <a
                href={phoneHref}
                className="flex items-center gap-3 text-text transition-colors hover:text-gold"
              >
                <Phone size={18} className="text-gold" aria-hidden="true" />
                {phoneDisplay}
              </a>
              <a
                href={emailHref}
                className="flex items-center gap-3 text-text transition-colors hover:text-gold"
              >
                <Mail size={18} className="text-gold" aria-hidden="true" />
                {emailDisplay}
              </a>
              <GoldLink
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                className="whatsapp-cta w-fit"
              >
                <MessageCircle size={16} aria-hidden="true" />
                {dict.hero.ctaSecondary}
              </GoldLink>

              <SocialLinks className="mt-1" />
            </div>
          </div>

          <div className="rounded-sm border border-border-gold/60 bg-surface p-6 sm:p-8">
            <ContactForm dict={dict} />
          </div>
        </div>
      </section>
    </>
  );
}
