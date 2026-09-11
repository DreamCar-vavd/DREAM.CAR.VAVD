"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import type { PromoView } from "@/lib/content/publishedPromos";
import { useDialogFocusTrap } from "@/lib/useDialogFocusTrap";

const L = {
  uk: { heading: "Акції та новини", read: "Читати", close: "Закрити", more: "Детальніше" },
  en: { heading: "Offers & news", read: "Read", close: "Close", more: "Learn more" },
  ru: { heading: "Акции и новости", read: "Читать", close: "Закрыть", more: "Подробнее" },
} as const;

function PromoLink({ url, label, className }: { url: string; label: string; className?: string }) {
  if (!url || !label) return null;
  const internal = url.startsWith("/") || url.startsWith("#");
  if (internal) {
    return (
      <Link href={url} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}

/** Thin gold strip(s) above the page content. Rendered only when non-empty. */
export function PromoBanners({ banners }: { banners: PromoView[] }) {
  if (banners.length === 0) return null;
  return (
    <div className="flex flex-col">
      {banners.map((b) => (
        <div
          key={b.id}
          className="border-b border-gold/40 bg-gold/10 px-4 py-2 text-center text-sm text-text"
        >
          <span className="font-semibold text-gold">{b.title}</span>
          {b.summary && <span className="ml-2 text-muted">{b.summary}</span>}
          <PromoLink
            url={b.linkUrl}
            label={b.linkLabel}
            className="ml-3 font-semibold text-gold underline hover:text-gold-light"
          />
        </div>
      ))}
    </div>
  );
}

function NewsModal({
  promo,
  labels,
  onClose,
}: {
  promo: PromoView;
  labels: (typeof L)[keyof typeof L];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(dialogRef, true, onClose);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={promo.title}
      className="fixed inset-0 z-[60] flex animate-in items-center justify-center bg-background/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-sm border border-border-gold bg-surface p-8 shadow-[0_0_30px_rgba(212,175,55,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={labels.close}
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border-gold text-gold transition-colors duration-300 hover:bg-gold/10"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <h2 className="font-heading pr-10 text-2xl font-bold text-gold">{promo.title}</h2>
        {promo.date && <p className="mt-1 text-xs text-muted">{promo.date}</p>}
        {promo.image && (
          <div
            className="relative mt-4 w-full overflow-hidden rounded-sm border border-border-gold/50"
            style={{ aspectRatio: `${promo.image.width} / ${promo.image.height}` }}
          >
            <Image src={promo.image.src} alt="" fill sizes="90vw" className="object-cover" />
          </div>
        )}
        <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-text">{promo.body}</p>
        <PromoLink
          url={promo.linkUrl}
          label={promo.linkLabel}
          className="mt-6 inline-flex rounded-sm border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10"
        />
      </div>
    </div>
  );
}

/** «Акції та новини» card grid. Rendered only when there is ≥1 card. */
export function PromoSection({ cards, locale }: { cards: PromoView[]; locale: string }) {
  const labels = L[(locale as keyof typeof L) in L ? (locale as keyof typeof L) : "uk"];
  const [openId, setOpenId] = useState<string | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  if (cards.length === 0) return null;

  const open = cards.find((c) => c.id === openId && c.type === "news") ?? null;

  return (
    <section id="news" className="scroll-mt-20 border-b border-border-gold/60 bg-background">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8">
        <h2 className="text-center font-heading text-3xl font-bold text-gold sm:text-4xl">
          {labels.heading}
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <article
              key={c.id}
              className="flex flex-col overflow-hidden rounded-sm border border-border-gold/40 bg-surface"
            >
              {c.image && (
                <div
                  className="relative w-full border-b border-border-gold/40"
                  style={{ aspectRatio: `${c.image.width} / ${c.image.height}` }}
                >
                  <Image src={c.image.src} alt="" fill sizes="(min-width:1024px) 30vw, 90vw" className="object-cover" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2 p-5">
                {c.date && <span className="text-xs text-muted">{c.date}</span>}
                <h3 className="font-heading text-lg font-semibold text-text">{c.title}</h3>
                {c.summary && <p className="flex-1 text-sm text-muted">{c.summary}</p>}
                {c.type === "news" && c.body ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      lastTrigger.current = e.currentTarget;
                      setOpenId(c.id);
                    }}
                    className="mt-1 w-fit text-sm font-semibold text-gold hover:text-gold-light"
                  >
                    {labels.read} →
                  </button>
                ) : (
                  <PromoLink
                    url={c.linkUrl}
                    label={c.linkLabel || labels.more}
                    className="mt-1 w-fit text-sm font-semibold text-gold hover:text-gold-light"
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      {open && (
        <NewsModal
          promo={open}
          labels={labels}
          onClose={() => {
            setOpenId(null);
            const t = lastTrigger.current;
            if (t) requestAnimationFrame(() => t.focus());
          }}
        />
      )}
    </section>
  );
}
