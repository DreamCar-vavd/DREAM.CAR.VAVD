import Image from "next/image";
import type { Dictionary } from "@/content/types";
import type { Locale } from "@/lib/i18n/config";
import { DreamLogo } from "./DreamLogo";
import { GoldLink } from "./GoldButton";

function CassetteCorner({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className={`pointer-events-none absolute h-6 w-6 text-gold lg:h-7 lg:w-7 ${className}`}
    >
      <path d="M1 1 H16 M1 1 V16" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <path
        d="M1 1 C1 1 11 0.5 11 7.5 C11 12 6.5 12 6.5 8.5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
      />
      <path
        d="M1 1 C1 1 0.5 11 7.5 11 C12 11 12 6.5 8.5 6.5"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
      />
      <circle cx="1" cy="1" r="1.7" fill="currentColor" />
      <circle cx="11" cy="7.5" r="1" fill="currentColor" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}

export function CarsForSaleSection({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-[1760px] px-6 py-4 sm:px-8 lg:px-10 lg:py-3">
        <div className="group relative border border-border-gold p-[3px] shadow-[0_0_0_rgba(212,175,55,0)] transition-[transform,box-shadow] duration-[280ms] ease-out hover:scale-[1.015] hover:shadow-[0_0_50px_rgba(212,175,55,0.4)] motion-reduce:transition-none motion-reduce:hover:scale-100">
          <div className="relative overflow-hidden border border-border-gold/70 bg-gradient-to-br from-gold/[0.05] via-background to-background transition-colors duration-[280ms] ease-out group-hover:border-gold group-hover:from-gold/[0.09]">
            <CassetteCorner className="-left-2 -top-2 lg:-left-2.5 lg:-top-2.5" />
            <CassetteCorner className="-right-2 -top-2 rotate-90 lg:-right-2.5 lg:-top-2.5" />
            <CassetteCorner className="-bottom-2 -right-2 rotate-180 lg:-bottom-2.5 lg:-right-2.5" />
            <CassetteCorner className="-bottom-2 -left-2 -rotate-90 lg:-bottom-2.5 lg:-left-2.5" />

            <div className="flex flex-col lg:flex-row lg:items-center">
              <div className="flex flex-col items-start gap-5 p-8 sm:p-10 lg:w-[46%] lg:p-12">
                <DreamLogo
                  alt={dict.meta.siteName}
                  wrapperClassName="block aspect-[1413/800] w-full max-w-[190px]"
                />
                <h2 className="font-heading text-3xl font-bold leading-tight text-gold sm:text-4xl lg:text-[2.75rem]">
                  {dict.carsForSale.heading}
                </h2>
                <GoldLink href={`/${locale}/cars-for-sale`} variant="outline" size="lg">
                  {dict.carsForSale.ctaButton}
                </GoldLink>
              </div>

              <div className="relative w-full px-6 pb-8 sm:px-10 sm:pb-10 lg:w-[54%] lg:p-10">
                <Image
                  src="/images/cars-for-sale-car.png"
                  alt=""
                  aria-hidden="true"
                  width={575}
                  height={265}
                  quality={90}
                  sizes="(min-width: 1024px) 54vw, 90vw"
                  className="h-auto w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
