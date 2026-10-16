import { getImageProps } from "next/image";
import { MessageCircle, Phone } from "lucide-react";
import type { Dictionary } from "@/content/types";
import type { Locale } from "@/lib/i18n/config";
import { GoldLink } from "./GoldButton";

/**
 * One photo per screen class (art direction). The breakpoints match the
 * Tailwind `sm` / `lg` aspect classes on the photo box and the shimmer masks
 * in globals.css — keep all three in sync.
 */
export const HERO_PHOTOS = {
  desktop: { src: "/images/hero/hero-workshop-desktop.webp", width: 3364, height: 1428, media: "(min-width: 1024px)" },
  tablet: { src: "/images/hero/hero-workshop-tablet.webp", width: 1672, height: 941, media: "(min-width: 640px)" },
  mobile: { src: "/images/hero/hero-workshop-mobile.webp", width: 1600, height: 1000 },
} as const;

const HERO_SIZES = "(min-width: 1760px) 1700px, 100vw";

/**
 * `<picture>` + getImageProps (Next 16 art direction): the browser picks ONE
 * source, so only the matching photo is downloaded. `fetchPriority="high"`
 * keeps it the LCP-first request without preloading all three.
 */
function HeroPicture({ alt }: { alt: string }) {
  const common = { alt, sizes: HERO_SIZES, quality: 75 };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, ...pick(HERO_PHOTOS.desktop) });
  const {
    props: { srcSet: tablet },
  } = getImageProps({ ...common, ...pick(HERO_PHOTOS.tablet) });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({ ...common, ...pick(HERO_PHOTOS.mobile), loading: "eager", fetchPriority: "high" });

  return (
    <picture>
      <source media={HERO_PHOTOS.desktop.media} srcSet={desktop} sizes={HERO_SIZES} />
      <source media={HERO_PHOTOS.tablet.media} srcSet={tablet} sizes={HERO_SIZES} />
      {/* Art direction needs a raw <img> inside <picture> (Next docs, getImageProps). */}
      <img {...rest} srcSet={mobile} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
    </picture>
  );
}

function pick(photo: { src: string; width: number; height: number }) {
  return { src: photo.src, width: photo.width, height: photo.height };
}


function CornerOrnament({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className={`pointer-events-none absolute h-7 w-7 text-gold lg:h-9 lg:w-9 ${className}`}
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

function DividerAccent({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={`hidden items-center gap-1.5 sm:inline-flex ${side === "left" ? "flex-row" : "flex-row-reverse"}`}
    >
      <span className="h-px w-8 bg-border-gold lg:w-10" />
      <span className="h-1.5 w-1.5 rotate-45 border border-gold" />
    </span>
  );
}

export function HeroSection({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const [word1, word2, word3] = dict.hero.tagline.split(" • ");

  return (
    <section className="relative bg-background">
      <h1 className="sr-only">{dict.meta.homeTitle}</h1>
      <div className="mx-auto max-w-[1760px] px-6 py-4 sm:px-8 lg:px-10 lg:py-3">
        <div className="relative border border-border-gold lg:p-[3px]">
          <div className="relative lg:border lg:border-border-gold/70">
            <CornerOrnament className="-left-2.5 -top-2.5 lg:-left-3.5 lg:-top-3.5" />
            <CornerOrnament className="-right-2.5 -top-2.5 rotate-90 lg:-right-3.5 lg:-top-3.5" />
            <CornerOrnament className="-bottom-2.5 -right-2.5 rotate-180 lg:-bottom-3.5 lg:-right-3.5" />
            <CornerOrnament className="-bottom-2.5 -left-2.5 -rotate-90 lg:-bottom-3.5 lg:-left-3.5" />

            {/* Photo + buttons: buttons sit on the photo from 768px up (enough free floor on the
                left), below it on phones and narrow tablets so they never cover the cars */}
            <div className="relative flex flex-col md:block">
              <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[3364/1428]">
                <HeroPicture alt={dict.meta.siteName} />
                <span className="hero-sign-shimmer" aria-hidden="true" />
                <div
                  className="pointer-events-none absolute inset-0 hidden bg-gradient-to-tr from-background/70 from-0% via-background/15 via-35% to-transparent to-55% md:block"
                  aria-hidden="true"
                />
              </div>

              {/* Two rows everywhere (consultation on top, WhatsApp + phone below) so the
                  group stays inside the empty floor area on the left of every photo. */}
              <div className="relative z-10 p-5 sm:px-8 md:absolute md:bottom-0 md:left-0 md:p-5 lg:p-8 xl:p-10 animate-in">
                <div className="grid w-full grid-cols-2 gap-3 md:inline-grid md:w-auto md:grid-cols-[auto_auto] md:gap-2.5 lg:gap-3">
                  <GoldLink
                    href={`/${locale}#contacts`}
                    variant="solid"
                    size="md"
                    className="hero-cta-primary col-span-2 w-full md:w-auto md:justify-self-start xl:py-3.5 xl:text-base"
                  >
                    {dict.hero.ctaPrimary}
                  </GoldLink>
                  <GoldLink
                    href={dict.contact.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                    size="md"
                    className="whatsapp-cta hero-cta-secondary w-full whitespace-nowrap bg-background/85 max-[400px]:col-span-2 max-md:gap-1.5 max-md:px-3 max-sm:px-1.5 max-sm:text-[13px] max-[400px]:text-sm xl:px-7 xl:py-3.5 xl:text-base [&>svg]:shrink-0"
                  >
                    <MessageCircle size={17} aria-hidden="true" />
                    {dict.hero.ctaSecondary}
                  </GoldLink>
                  <GoldLink
                    href={dict.contact.phoneHref}
                    variant="outline"
                    size="md"
                    className="whatsapp-cta hero-cta-secondary w-full whitespace-nowrap bg-background/85 max-[400px]:col-span-2 max-md:gap-1.5 max-md:px-3 max-sm:px-1.5 max-sm:text-[13px] max-[400px]:text-sm xl:px-7 xl:py-3.5 xl:text-base [&>svg]:shrink-0"
                  >
                    <Phone size={17} aria-hidden="true" />
                    {dict.hero.ctaCall}
                  </GoldLink>
                </div>
              </div>
            </div>

            <div className="relative border-t border-border-gold/50 bg-background/70 px-4 py-3 sm:px-6">
              <div className="mx-auto flex max-w-3xl flex-col items-center gap-1.5 text-center">
                {word1 && word2 && word3 && (
                  <p className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold tracking-[0.2em] text-gold sm:text-base">
                    <span>{word1}</span>
                    <span className="inline-block h-1.5 w-1.5 rotate-45 bg-gold" aria-hidden="true" />
                    <span>{word2}</span>
                    <span className="inline-block h-1.5 w-1.5 rotate-45 bg-gold" aria-hidden="true" />
                    <span>{word3}</span>
                  </p>
                )}
                <p className="text-sm text-text">{dict.hero.subtitle}</p>
                <p className="flex items-center gap-3 text-xs text-muted">
                  <DividerAccent side="left" />
                  {dict.hero.thanksLine}
                  <DividerAccent side="right" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
