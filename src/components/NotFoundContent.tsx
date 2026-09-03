"use client";

import { usePathname } from "next/navigation";
import { DreamLogo } from "@/components/DreamLogo";
import { GoldLink } from "@/components/GoldButton";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

const copy: Record<Locale, { title: string; message: string; button: string; alt: string }> = {
  uk: {
    title: "Сторінку не знайдено",
    message: "Такої сторінки не існує або вона була переміщена.",
    button: "На головну",
    alt: "DREAM.CAR.VAVD",
  },
  ru: {
    title: "Страница не найдена",
    message: "Такой страницы не существует или она была перемещена.",
    button: "На главную",
    alt: "DREAM.CAR.VAVD",
  },
  en: {
    title: "Page not found",
    message: "This page doesn't exist or has been moved.",
    button: "Back to homepage",
    alt: "DREAM.CAR.VAVD",
  },
};

export function NotFoundContent() {
  const pathname = usePathname();
  const segment = pathname?.split("/")[1] ?? "";
  const locale: Locale = isLocale(segment) ? segment : defaultLocale;
  const text = copy[locale];

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-20 text-center sm:px-6">
      <DreamLogo
        alt={text.alt}
        sizes="(min-width: 640px) 198px, 170px"
        wrapperClassName="h-24 w-auto sm:h-28"
      />
      <p className="font-heading mt-8 text-6xl font-bold text-gold sm:text-7xl">404</p>
      <h1 className="font-heading mt-4 text-2xl font-bold text-text sm:text-3xl">{text.title}</h1>
      <p className="mt-3 max-w-md text-muted">{text.message}</p>
      <GoldLink href={`/${locale}`} className="mt-8">
        {text.button}
      </GoldLink>
    </section>
  );
}
