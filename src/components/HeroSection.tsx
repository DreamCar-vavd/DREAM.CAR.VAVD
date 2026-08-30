import Image from "next/image";
import { MessageCircle } from "lucide-react";
import type { Dictionary } from "@/content/types";
import type { Locale } from "@/lib/i18n/config";
import { DreamLogo } from "./DreamLogo";
import { GoldLink } from "./GoldButton";
import { whatsappUrl } from "@/lib/social";

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

            {/* Photo + overlay content: stacked on mobile/tablet, single composition on desktop */}
            <div className="relative flex flex-col lg:block">
              <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[1682/714]">
                <Image
                  src="/images/hero-cars-logo-final.jpg"
                  alt={dict.meta.siteName}
                  fill
                  priority
                  quality={90}
                  sizes="(min-width: 1024px) 100vw, 100vw"
                  className="object-cover object-[center_38%] lg:object-center"
                />
                <div
                  className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-background from-10% via-background/75 via-40% to-transparent to-65% lg:block"
                  aria-hidden="true"
                />
              </div>

              <div className="relative z-10 flex flex-col items-start gap-5 p-6 sm:p-8 lg:absolute lg:inset-y-0 lg:left-0 lg:w-[52%] lg:justify-center lg:p-10 animate-in">
                <DreamLogo
                  alt={`${dict.hero.title} — ${dict.hero.brandTag}`}
                  priority
                  wrapperClassName="block aspect-[1413/800] w-full max-w-[322px] sm:max-w-[368px] lg:max-w-[414px]"
                />

                <div className="flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row">
                  <GoldLink
                    href={`/${locale}#contacts`}
                    variant="solid"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    {dict.hero.ctaPrimary}
                  </GoldLink>
                  <GoldLink
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                    size="lg"
                    className="whatsapp-cta w-full sm:w-auto"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    {dict.hero.ctaSecondary}
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
