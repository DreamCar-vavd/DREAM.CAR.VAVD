import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { carListings } from "@/content/carListings";
import { CarListingGallery } from "@/components/CarListingGallery";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) return {};
  const dict = await getDictionary(localeParam);
  return { title: `${dict.carsForSale.pageHeading} — ${dict.meta.siteName}` };
}

export default async function CarsForSalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  const dict = await getDictionary(locale);

  return (
    <section className="mx-auto max-w-[1760px] px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-heading text-3xl font-bold text-gold sm:text-4xl">
          {dict.carsForSale.pageHeading}
        </h1>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {carListings.map((listing) => {
          const copy = dict.carsForSale.listings[listing.id];
          return (
            <CarListingGallery
              key={listing.id}
              listing={listing}
              copy={copy}
              contactHref={`/${locale}#contacts`}
              labels={{
                status: dict.carsForSale.statusLabel,
                closeGallery: dict.carsForSale.closeGallery,
                previousPhoto: dict.carsForSale.previousPhoto,
                nextPhoto: dict.carsForSale.nextPhoto,
                contactCta: dict.carsForSale.contactCta,
                photoAlt: dict.carsForSale.photoAlt,
                videoAlt: dict.carsForSale.videoAlt,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
