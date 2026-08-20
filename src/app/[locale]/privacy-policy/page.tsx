import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { emailDisplay } from "@/lib/social";
import { siteUrl, buildLanguageAlternates } from "@/lib/site";

const copy: Record<Locale, { intro: string; items: string[] }> = {
  uk: {
    intro:
      "Ця сторінка описує, як DREAM.CAR.VAVD обробляє персональні дані, надані через контактну форму, телефон, email або месенджери.",
    items: [
      "Ми збираємо лише ті дані, які ви самі надаєте (ім'я, телефон, email, деталі запиту).",
      "Дані використовуються виключно для зв'язку з вами та надання консультації чи послуги.",
      "Ми не передаємо ваші персональні дані третім сторонам без вашої згоди.",
      `З питань обробки даних звертайтесь на ${emailDisplay}.`,
    ],
  },
  ru: {
    intro:
      "Эта страница описывает, как DREAM.CAR.VAVD обрабатывает персональные данные, предоставленные через контактную форму, телефон, email или мессенджеры.",
    items: [
      "Мы собираем только те данные, которые вы сами предоставляете (имя, телефон, email, детали запроса).",
      "Данные используются исключительно для связи с вами и предоставления консультации или услуги.",
      "Мы не передаём ваши персональные данные третьим лицам без вашего согласия.",
      `По вопросам обработки данных обращайтесь на ${emailDisplay}.`,
    ],
  },
  en: {
    intro:
      "This page explains how DREAM.CAR.VAVD handles personal data submitted via the contact form, phone, email or messaging apps.",
    items: [
      "We only collect data that you provide yourself (name, phone, email, request details).",
      "Data is used solely to contact you and provide a consultation or service.",
      "We do not share your personal data with third parties without your consent.",
      `For questions about data processing, contact ${emailDisplay}.`,
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
  const title = `${dict.footer.privacy} — ${dict.meta.siteName}`;
  const description = copy[localeParam].intro;
  const canonical = `${siteUrl}/${localeParam}/privacy-policy`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildLanguageAlternates((locale) => `/${locale}/privacy-policy`),
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

export default async function PrivacyPolicyPage({
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
        {dict.footer.privacy}
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
