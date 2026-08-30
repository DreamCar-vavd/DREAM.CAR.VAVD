import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { emailDisplay } from "@/lib/social";
import { siteUrl, buildLanguageAlternates } from "@/lib/site";

const copy: Record<Locale, { intro: string; items: string[] }> = {
  uk: {
    intro:
      "Ця сторінка описує, як DREAM.CAR.VAVD обробляє дані, надані через контактну форму, телефон, email або месенджери, а також обмежені технічні дані про використання та продуктивність сайту.",
    items: [
      "Ми збираємо лише ті контактні дані, які ви самі надаєте (ім'я, телефон, email і деталі запиту).",
      "Звернення через контактну форму обробляються сервісом Formspree для доставки повідомлення DREAM.CAR.VAVD.",
      "Для агрегованої статистики відвідувань і вимірювання продуктивності сайту та Core Web Vitals ми використовуємо Vercel Web Analytics і Vercel Speed Insights.",
      "За документацією Vercel, Web Analytics не використовує аналітичні cookie та зберігає анонімізовану агреговану інформацію. Можуть оброблятися маршрут або URL сторінки, referrer, приблизне місцезнаходження, браузер, операційна система, тип пристрою та показники продуктивності.",
      "У поточній конфігурації ми не використовуємо власні аналітичні події та не передаємо через ці компоненти значення полів контактної форми, email-адреси або телефонні номери.",
      "Vercel і Formspree виступають постачальниками технічних послуг, необхідних для роботи сайту, доставки звернень та агрегованого вимірювання використання і продуктивності.",
      `З питань обробки даних звертайтесь на ${emailDisplay}.`,
    ],
  },
  ru: {
    intro:
      "Эта страница описывает, как DREAM.CAR.VAVD обрабатывает данные, предоставленные через контактную форму, телефон, email или мессенджеры, а также ограниченные технические данные об использовании и производительности сайта.",
    items: [
      "Мы собираем только те контактные данные, которые вы предоставляете самостоятельно (имя, телефон, email и детали запроса).",
      "Обращения через контактную форму обрабатываются сервисом Formspree для доставки сообщения DREAM.CAR.VAVD.",
      "Для агрегированной статистики посещений и измерения производительности сайта и Core Web Vitals мы используем Vercel Web Analytics и Vercel Speed Insights.",
      "Согласно документации Vercel, Web Analytics не использует аналитические cookie и хранит анонимизированную агрегированную информацию. Могут обрабатываться маршрут или URL страницы, referrer, приблизительное местоположение, браузер, операционная система, тип устройства и показатели производительности.",
      "В текущей конфигурации мы не используем собственные аналитические события и не передаём через эти компоненты значения полей контактной формы, email-адреса или номера телефонов.",
      "Vercel и Formspree выступают поставщиками технических услуг, необходимых для работы сайта, доставки обращений и агрегированного измерения использования и производительности.",
      `По вопросам обработки данных обращайтесь на ${emailDisplay}.`,
    ],
  },
  en: {
    intro:
      "This page explains how DREAM.CAR.VAVD handles data submitted through the contact form, phone, email or messaging apps, as well as limited technical information about website usage and performance.",
    items: [
      "We collect only the contact information that you provide (name, phone number, email address and request details).",
      "Contact-form submissions are processed by Formspree to deliver the message to DREAM.CAR.VAVD.",
      "We use Vercel Web Analytics and Vercel Speed Insights for aggregated visit statistics and to measure website performance and Core Web Vitals.",
      "According to Vercel's documentation, Web Analytics does not use analytics cookies and stores anonymised, aggregated information. The page route or URL, referrer, approximate location, browser, operating system, device type and performance measurements may be processed.",
      "In the current configuration, we do not use custom analytics events or send contact-form field values, email addresses or phone numbers through these analytics components.",
      "Vercel and Formspree act as technical service providers required to operate the website, deliver enquiries and measure aggregated usage and performance.",
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
