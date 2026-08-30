import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { siteUrl, buildLanguageAlternates } from "@/lib/site";

const copy: Record<Locale, { intro: string; items: string[] }> = {
  uk: {
    intro: "Цей сайт використовує мінімальний набір технічних файлів cookie для коректної роботи.",
    items: [
      "Технічні cookie необхідні для базової роботи сайту та не використовуються для реклами.",
      "Сайт не використовує сторонні рекламні або трекінгові cookie.",
      "Vercel Web Analytics і Vercel Speed Insights у поточній конфігурації не використовують аналітичні cookie; вони застосовуються для агрегованої статистики відвідувань і показників продуктивності. Детальніше — у Політиці конфіденційності.",
      "Ви можете видалити cookie у налаштуваннях свого браузера в будь-який момент.",
    ],
  },
  ru: {
    intro: "Этот сайт использует минимальный набор технических файлов cookie для корректной работы.",
    items: [
      "Технические cookie необходимы для базовой работы сайта и не используются для рекламы.",
      "Сайт не использует сторонние рекламные или трекинговые cookie.",
      "Vercel Web Analytics и Vercel Speed Insights в текущей конфигурации не используют аналитические cookie; они применяются для агрегированной статистики посещений и показателей производительности. Подробнее — в Политике конфиденциальности.",
      "Вы можете удалить cookie в настройках своего браузера в любой момент.",
    ],
  },
  en: {
    intro: "This website uses a minimal set of technical cookies required for it to function correctly.",
    items: [
      "Technical cookies are required for the site to work and are not used for advertising.",
      "The site does not use third-party advertising or tracking cookies.",
      "Vercel Web Analytics and Vercel Speed Insights do not use analytics cookies in the current configuration; they are used for aggregated visit statistics and performance measurements. See the Privacy Policy for more information.",
      "You can remove cookies in your browser settings at any time.",
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) return {};
  const dict = await getDictionary(localeParam);
  const title = `${dict.footer.cookies} — ${dict.meta.siteName}`;
  const description = copy[localeParam].intro;
  const canonical = `${siteUrl}/${localeParam}/cookies`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildLanguageAlternates((locale) => `/${locale}/cookies`),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: "/images/dream-car-logo.png" }],
    },
  };
}

export default async function CookiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  const dict = await getDictionary(locale);
  const text = copy[locale];

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold text-gold sm:text-4xl">
        {dict.footer.cookies}
      </h1>
      <p className="mt-6 text-muted">{text.intro}</p>
      <ul className="mt-6 flex flex-col gap-3">
        {text.items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-text">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
