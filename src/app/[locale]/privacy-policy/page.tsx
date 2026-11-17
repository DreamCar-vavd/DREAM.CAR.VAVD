import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { siteUrl, buildLanguageAlternates } from "@/lib/site";

type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };
type Section = { title: string; blocks: Block[] };
type PolicyCopy = { updated: string; sections: Section[] };

// Approved owner text: privacy policy version 4 («Рекомендації 3», 17.11.2026).
// Change only with the owner's approval.
const copy: Record<Locale, PolicyCopy> = {
  "uk": {
    "updated": "Останнє оновлення: 17 листопада 2026",
    "sections": [
      {
        "title": "1. Хто ми",
        "blocks": [
          {
            "type": "p",
            "text": "Сайт dream-car-vavd.com і послуги DREAM.CAR.VAVD надає Volodymyr O., trading as DREAM.CAR.VAVD — індивідуальний підприємець (sole trader), Велика Британія. Саме ми вирішуємо, як використовуються ваші дані."
          },
          {
            "type": "p",
            "text": "Email: dream.car.vavd@gmail.com · Телефон: +44 7706 054203"
          }
        ]
      },
      {
        "title": "2. Які дані ми отримуємо",
        "blocks": [
          {
            "type": "ul",
            "items": [
              "Контактні дані, які ви надаєте самі: ім'я, телефон, email і текст вашого запиту.",
              "Дані про автомобіль, якщо вони потрібні для послуги (марка, модель, VIN, пробіг), і звіт діагностики чи огляду.",
              "Фото чи відео вашого автомобіля з номерним знаком — лише якщо ви погодилися, щоб ми показали їх у соцмережах.",
              "Разом із формою на сайті передаються мова сторінки, шлях сторінки, з якої її надіслано, і UTM-позначки, якщо вони є в адресі. Рекламні cookie для цього не використовуються.",
              "Знеособлена статистика сайту (Vercel Web Analytics і Speed Insights): сторінка, referrer, приблизне місцезнаходження, браузер, тип пристрою, показники швидкості. За документацією Vercel, аналітичні cookie не використовуються. Значення полів форми, email і телефони через ці інструменти не передаються."
            ]
          }
        ]
      },
      {
        "title": "3. Звідки дані",
        "blocks": [
          {
            "type": "p",
            "text": "Із форми на сайті, телефонних дзвінків, email, WhatsApp, Facebook, Instagram і TikTok — коли ви самі нам пишете чи телефонуєте."
          }
        ]
      },
      {
        "title": "4. Для чого ми використовуємо дані і на якій підставі",
        "blocks": [
          {
            "type": "ul",
            "items": [
              "Відповісти на ваш запит і підготувати пропозицію — на ваше прохання до укладення договору (UK GDPR, ст. 6(1)(b)).",
              "Надати послугу: підбір, діагностику, SRS, авто/мото/спецтехніку на замовлення — виконання договору (ст. 6(1)(b)).",
              "Зберігати записи про оплату — виконання юридичного обов'язку перед HMRC (ст. 6(1)(c)).",
              "Зберігати запис про виконану роботу й звіт діагностики, щоб відповісти на гарантійне питання чи захиститися в разі претензії — наш законний інтерес (ст. 6(1)(f)).",
              "Показати фото вашого авто в соцмережах — лише за вашою згодою (ст. 6(1)(a)). Згоду можна відкликати будь-коли.",
              "Знеособлена статистика сайту — наш законний інтерес зробити сайт зручним і швидким (ст. 6(1)(f))."
            ]
          },
          {
            "type": "p",
            "text": "Ми не надсилаємо рекламних розсилок і не продаємо ваші дані."
          }
        ]
      },
      {
        "title": "5. Хто бачить ваші дані",
        "blocks": [
          {
            "type": "p",
            "text": "Ваші дані бачимо ми й, за потреби, наш помічник (див. нижче). Ми нікому їх не продаємо й не передаємо для реклами. Дані проходять через сервіси, без яких сайт і зв'язок не працюють:"
          },
          {
            "type": "ul",
            "items": [
              "Помічник — наш найманий працівник. Він може мати доступ лише до тих даних, які потрібні для конкретної роботи (наприклад, марка авто, адреса виїзду), зобов'язаний зберігати їх у таємниці й не використовує їх для інших цілей. Для нього діють ті самі правила й строки зберігання.",
              "Formspree — доставляє повідомлення з форми сайту на нашу пошту.",
              "Vercel — хостинг сайту і знеособлена статистика.",
              "Google (Gmail) — пошта, куди приходять заявки.",
              "WhatsApp, Facebook, Instagram, TikTok — якщо ви самі пишете нам там; вони обробляють повідомлення за власними правилами.",
              "Перевізник — якщо потрібна доставка авто чи техніки, передаємо лише дані, потрібні для доставки, і тільки за вашою згодою."
            ]
          }
        ]
      },
      {
        "title": "6. Передача даних за межі Великої Британії",
        "blocks": [
          {
            "type": "p",
            "text": "Vercel і Google обробляють дані в США. Обидві компанії сертифіковані за UK Extension to the EU-U.S. Data Privacy Framework — механізмом, який дозволяє передавати дані з Великої Британії в США."
          },
          {
            "type": "p",
            "text": "Formspree також обробляє дані в США відповідно до своїх умов."
          }
        ]
      },
      {
        "title": "7. Скільки ми зберігаємо дані",
        "blocks": [
          {
            "type": "ul",
            "items": [
              "Запити людей, які не стали клієнтами: зберігаємо до 6 місяців. Кожні 3 місяці перевіряємо й видаляємо запити, старші за 6 місяців.",
              "Клієнти (було замовлення й оплата): контактні дані, опис виконаної роботи, звіт діагностики (з VIN і пробігом) і записи про оплату зберігаємо 6 років після кінця податкового року, у якому виконано роботу. Цього вимагає HMRC, і це строк, протягом якого за договором можна подати претензію. Після цього дані видаляємо.",
              "Фото й відео в соцмережах: доки ви не попросите їх прибрати."
            ]
          }
        ]
      },
      {
        "title": "8. Ваші права",
        "blocks": [
          {
            "type": "p",
            "text": "Ви маєте право: дізнатися, які ваші дані ми маємо, і отримати копію; виправити неточні дані; попросити видалити дані; обмежити їх використання; заперечити проти використання; отримати свої дані у зручному форматі; відкликати згоду."
          },
          {
            "type": "p",
            "text": "Напишіть на dream.car.vavd@gmail.com. Ми відповімо якнайшвидше, не пізніше ніж за 1 місяць. Це безкоштовно."
          }
        ]
      },
      {
        "title": "9. Скарги",
        "blocks": [
          {
            "type": "p",
            "text": "Якщо вас щось не влаштовує в тому, як ми використовуємо ваші дані, напишіть нам на dream.car.vavd@gmail.com. Ми підтвердимо отримання скарги протягом 30 днів, розберемося без зайвих затримок і повідомимо результат."
          },
          {
            "type": "p",
            "text": "Ви також можете поскаржитися до Information Commissioner's Office (ICO): ico.org.uk/make-a-complaint, телефон 0303 123 1113."
          }
        ]
      },
      {
        "title": "10. Cookie",
        "blocks": [
          {
            "type": "p",
            "text": "Як сайт використовує cookie, описано на сторінці «Файли cookie»."
          }
        ]
      },
      {
        "title": "11. Зміни",
        "blocks": [
          {
            "type": "p",
            "text": "Ми можемо оновлювати цю політику. Дата останнього оновлення вказана вгорі сторінки."
          }
        ]
      }
    ]
  },
  "ru": {
    "updated": "Последнее обновление: 17 ноября 2026",
    "sections": [
      {
        "title": "1. Кто мы",
        "blocks": [
          {
            "type": "p",
            "text": "Сайт dream-car-vavd.com и услуги DREAM.CAR.VAVD предоставляет Volodymyr O., trading as DREAM.CAR.VAVD — индивидуальный предприниматель (sole trader), Великобритания. Именно мы решаем, как используются ваши данные."
          },
          {
            "type": "p",
            "text": "Email: dream.car.vavd@gmail.com · Телефон: +44 7706 054203"
          }
        ]
      },
      {
        "title": "2. Какие данные мы получаем",
        "blocks": [
          {
            "type": "ul",
            "items": [
              "Контактные данные, которые вы предоставляете сами: имя, телефон, email и текст вашего запроса.",
              "Данные об автомобиле, если они нужны для услуги (марка, модель, VIN, пробег), и отчёт диагностики или осмотра.",
              "Фото или видео вашего автомобиля с номерным знаком — только если вы согласились, чтобы мы показали их в соцсетях.",
              "Вместе с формой на сайте передаются язык страницы, путь страницы, с которой она отправлена, и UTM-метки, если они есть в адресе. Рекламные cookie для этого не используются.",
              "Обезличенная статистика сайта (Vercel Web Analytics и Speed Insights): страница, referrer, приблизительное местоположение, браузер, тип устройства, показатели скорости. Согласно документации Vercel, аналитические cookie не используются. Значения полей формы, email и телефоны через эти инструменты не передаются."
            ]
          }
        ]
      },
      {
        "title": "3. Откуда данные",
        "blocks": [
          {
            "type": "p",
            "text": "Из формы на сайте, телефонных звонков, email, WhatsApp, Facebook, Instagram и TikTok — когда вы сами нам пишете или звоните."
          }
        ]
      },
      {
        "title": "4. Для чего мы используем данные и на каком основании",
        "blocks": [
          {
            "type": "ul",
            "items": [
              "Ответить на ваш запрос и подготовить предложение — по вашей просьбе до заключения договора (UK GDPR, ст. 6(1)(b)).",
              "Оказать услугу: подбор, диагностику, SRS, авто/мото/спецтехнику под заказ — исполнение договора (ст. 6(1)(b)).",
              "Хранить записи об оплате — исполнение юридической обязанности перед HMRC (ст. 6(1)(c)).",
              "Хранить запись о выполненной работе и отчёт диагностики, чтобы ответить на гарантийный вопрос или защититься в случае претензии — наш законный интерес (ст. 6(1)(f)).",
              "Показать фото вашего авто в соцсетях — только с вашего согласия (ст. 6(1)(a)). Согласие можно отозвать в любой момент.",
              "Обезличенная статистика сайта — наш законный интерес сделать сайт удобным и быстрым (ст. 6(1)(f))."
            ]
          },
          {
            "type": "p",
            "text": "Мы не отправляем рекламных рассылок и не продаём ваши данные."
          }
        ]
      },
      {
        "title": "5. Кто видит ваши данные",
        "blocks": [
          {
            "type": "p",
            "text": "Ваши данные видим мы и, при необходимости, наш помощник (см. ниже). Мы никому их не продаём и не передаём для рекламы. Данные проходят через сервисы, без которых сайт и связь не работают:"
          },
          {
            "type": "ul",
            "items": [
              "Помощник — наш наёмный работник. Он может иметь доступ только к тем данным, которые нужны для конкретной работы (например, марка авто, адрес выезда), обязан хранить их в тайне и не использует их для других целей. Для него действуют те же правила и сроки хранения.",
              "Formspree — доставляет сообщения из формы сайта на нашу почту.",
              "Vercel — хостинг сайта и обезличенная статистика.",
              "Google (Gmail) — почта, куда приходят заявки.",
              "WhatsApp, Facebook, Instagram, TikTok — если вы сами пишете нам там; они обрабатывают сообщения по собственным правилам.",
              "Перевозчик — если нужна доставка авто или техники, передаём только данные, нужные для доставки, и только с вашего согласия."
            ]
          }
        ]
      },
      {
        "title": "6. Передача данных за пределы Великобритании",
        "blocks": [
          {
            "type": "p",
            "text": "Vercel и Google обрабатывают данные в США. Обе компании сертифицированы по UK Extension to the EU-U.S. Data Privacy Framework — механизму, который позволяет передавать данные из Великобритании в США."
          },
          {
            "type": "p",
            "text": "Formspree также обрабатывает данные в США в соответствии со своими условиями."
          }
        ]
      },
      {
        "title": "7. Сколько мы храним данные",
        "blocks": [
          {
            "type": "ul",
            "items": [
              "Запросы людей, которые не стали клиентами: храним до 6 месяцев. Каждые 3 месяца проверяем и удаляем запросы старше 6 месяцев.",
              "Клиенты (был заказ и оплата): контактные данные, описание выполненной работы, отчёт диагностики (с VIN и пробегом) и записи об оплате храним 6 лет после окончания налогового года, в котором выполнена работа. Этого требует HMRC, и это срок, в течение которого по договору можно подать претензию. После этого данные удаляем.",
              "Фото и видео в соцсетях: пока вы не попросите их убрать."
            ]
          }
        ]
      },
      {
        "title": "8. Ваши права",
        "blocks": [
          {
            "type": "p",
            "text": "Вы имеете право: узнать, какие ваши данные у нас есть, и получить копию; исправить неточные данные; попросить удалить данные; ограничить их использование; возразить против использования; получить свои данные в удобном формате; отозвать согласие."
          },
          {
            "type": "p",
            "text": "Напишите на dream.car.vavd@gmail.com. Мы ответим как можно скорее, не позднее чем через 1 месяц. Это бесплатно."
          }
        ]
      },
      {
        "title": "9. Жалобы",
        "blocks": [
          {
            "type": "p",
            "text": "Если вас что-то не устраивает в том, как мы используем ваши данные, напишите нам на dream.car.vavd@gmail.com. Мы подтвердим получение жалобы в течение 30 дней, разберёмся без лишних задержек и сообщим результат."
          },
          {
            "type": "p",
            "text": "Вы также можете пожаловаться в Information Commissioner's Office (ICO): ico.org.uk/make-a-complaint, телефон 0303 123 1113."
          }
        ]
      },
      {
        "title": "10. Cookie",
        "blocks": [
          {
            "type": "p",
            "text": "Как сайт использует cookie, описано на странице «Файлы cookie»."
          }
        ]
      },
      {
        "title": "11. Изменения",
        "blocks": [
          {
            "type": "p",
            "text": "Мы можем обновлять эту политику. Дата последнего обновления указана вверху страницы."
          }
        ]
      }
    ]
  },
  "en": {
    "updated": "Last updated: 17 November 2026",
    "sections": [
      {
        "title": "1. Who we are",
        "blocks": [
          {
            "type": "p",
            "text": "The website dream-car-vavd.com and the DREAM.CAR.VAVD services are provided by Volodymyr O., trading as DREAM.CAR.VAVD, a sole trader in the United Kingdom. We decide how your personal data is used (we are the data controller)."
          },
          {
            "type": "p",
            "text": "Email: dream.car.vavd@gmail.com · Phone: +44 7706 054203"
          }
        ]
      },
      {
        "title": "2. What data we collect",
        "blocks": [
          {
            "type": "ul",
            "items": [
              "Contact details you give us yourself: name, phone number, email address and the text of your enquiry.",
              "Vehicle details where the service needs them (make, model, VIN, mileage), and the diagnostic or inspection report.",
              "Photos or videos of your vehicle showing its number plate — only if you have agreed that we may show them on social media.",
              "With a contact-form submission we send the page language, the path of the page it was sent from and any UTM tags in the page address. No advertising cookies are used for this.",
              "Anonymised website statistics (Vercel Web Analytics and Speed Insights): page, referrer, approximate location, browser, device type and performance measurements. According to Vercel's documentation, no analytics cookies are used. Form field values, email addresses and phone numbers are not sent through these tools."
            ]
          }
        ]
      },
      {
        "title": "3. Where the data comes from",
        "blocks": [
          {
            "type": "p",
            "text": "From the website form, phone calls, email, WhatsApp, Facebook, Instagram and TikTok — when you contact us yourself."
          }
        ]
      },
      {
        "title": "4. Why we use your data and our lawful basis",
        "blocks": [
          {
            "type": "ul",
            "items": [
              "To reply to your enquiry and prepare a quote — steps taken at your request before entering into a contract (UK GDPR, Article 6(1)(b)).",
              "To provide the service: car sourcing, diagnostics, SRS/airbag work, vehicles to order — performance of a contract (Article 6(1)(b)).",
              "To keep payment records — compliance with our legal obligation to HMRC (Article 6(1)(c)).",
              "To keep a record of the work done and the diagnostic report, so we can answer warranty questions or defend ourselves against a claim — our legitimate interest (Article 6(1)(f)).",
              "To show photos of your vehicle on social media — only with your consent (Article 6(1)(a)). You can withdraw consent at any time.",
              "Anonymised website statistics — our legitimate interest in keeping the website useful and fast (Article 6(1)(f))."
            ]
          },
          {
            "type": "p",
            "text": "We do not send marketing messages and we do not sell your data."
          }
        ]
      },
      {
        "title": "5. Who sees your data",
        "blocks": [
          {
            "type": "p",
            "text": "Your data is seen by us and, where needed, our assistant (see below). We do not sell it or share it for advertising. It passes through services the website and our communication depend on:"
          },
          {
            "type": "ul",
            "items": [
              "Our assistant — our employee. They may access only the data needed for a specific job (for example, the vehicle model or the call-out address), must keep it confidential and do not use it for any other purpose. The same rules and retention periods apply to them.",
              "Formspree — delivers website-form messages to our inbox.",
              "Vercel — website hosting and anonymised statistics.",
              "Google (Gmail) — the mailbox where enquiries arrive.",
              "WhatsApp, Facebook, Instagram, TikTok — if you choose to message us there; they handle messages under their own privacy policies.",
              "A carrier — if a vehicle or machine needs delivering, we pass on only the details needed for delivery, and only with your agreement."
            ]
          }
        ]
      },
      {
        "title": "6. Transfers outside the UK",
        "blocks": [
          {
            "type": "p",
            "text": "Vercel and Google process data in the USA. Both are certified under the UK Extension to the EU-U.S. Data Privacy Framework, which allows personal data to be transferred from the UK to the USA."
          },
          {
            "type": "p",
            "text": "Formspree also processes data in the USA under its own terms."
          }
        ]
      },
      {
        "title": "7. How long we keep data",
        "blocks": [
          {
            "type": "ul",
            "items": [
              "Enquiries from people who do not become clients: kept for up to 6 months. Every 3 months we review them and delete any older than 6 months.",
              "Clients (an order was placed and paid for): contact details, a description of the work done, the diagnostic report (including VIN and mileage) and payment records are kept for 6 years after the end of the tax year in which the work was done. HMRC requires this, and it is the period during which a claim can be brought under a contract. After that, the data is deleted.",
              "Photos and videos on social media: until you ask us to remove them."
            ]
          }
        ]
      },
      {
        "title": "8. Your rights",
        "blocks": [
          {
            "type": "p",
            "text": "You have the right to: find out what data we hold about you and get a copy; have inaccurate data corrected; ask us to erase your data; restrict how we use it; object to its use; receive your data in a portable format; and withdraw your consent."
          },
          {
            "type": "p",
            "text": "Email dream.car.vavd@gmail.com. We will reply as soon as possible and within 1 month at the latest. This is free of charge."
          }
        ]
      },
      {
        "title": "9. Complaints",
        "blocks": [
          {
            "type": "p",
            "text": "If you are unhappy with how we use your data, please email dream.car.vavd@gmail.com. We will acknowledge your complaint within 30 days, look into it without undue delay and tell you the outcome."
          },
          {
            "type": "p",
            "text": "You can also complain to the Information Commissioner's Office (ICO): ico.org.uk/make-a-complaint, phone 0303 123 1113."
          }
        ]
      },
      {
        "title": "10. Cookies",
        "blocks": [
          {
            "type": "p",
            "text": "How the website uses cookies is explained on the Cookies page."
          }
        ]
      },
      {
        "title": "11. Changes",
        "blocks": [
          {
            "type": "p",
            "text": "We may update this policy. The date of the last update is shown at the top of the page."
          }
        ]
      }
    ]
  }
};

// Turns contact details and references inside the approved text into links,
// without changing the wording.
const LINK_PATTERN =
  /(dream\.car\.vavd@gmail\.com|\+44 7706 054203|ico\.org\.uk\/make-a-complaint|0303 123 1113|«Файли cookie»|«Файлы cookie»|Cookies page)/g;

function linkify(text: string, locale: Locale): ReactNode[] {
  const linkClass = "text-gold underline underline-offset-2 hover:opacity-80";
  return text.split(LINK_PATTERN).map((part, i) => {
    switch (part) {
      case "dream.car.vavd@gmail.com":
        return (
          <a key={i} href="mailto:dream.car.vavd@gmail.com" className={linkClass}>
            {part}
          </a>
        );
      case "+44 7706 054203":
        return (
          <a key={i} href="tel:+447706054203" className={linkClass}>
            {part}
          </a>
        );
      case "0303 123 1113":
        return (
          <a key={i} href="tel:+443031231113" className={linkClass}>
            {part}
          </a>
        );
      case "ico.org.uk/make-a-complaint":
        return (
          <a
            key={i}
            href="https://ico.org.uk/make-a-complaint/"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {part}
          </a>
        );
      case "«Файли cookie»":
      case "«Файлы cookie»":
      case "Cookies page":
        return (
          <Link key={i} href={`/${locale}/cookies`} className={linkClass}>
            {part}
          </Link>
        );
      default:
        return part;
    }
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) return {};
  const dict = await getDictionary(localeParam);
  const title = `${dict.footer.privacy} — ${dict.meta.siteName}`;
  const first = copy[localeParam].sections[0].blocks[0];
  const description = first.type === "p" ? first.text : title;
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
      <p className="mt-3 text-sm text-muted">{text.updated}</p>
      {text.sections.map((section) => (
        <div key={section.title} className="mt-10">
          <h2 className="font-heading text-xl font-bold text-gold sm:text-2xl">{section.title}</h2>
          {section.blocks.map((block, bi) =>
            block.type === "p" ? (
              <p key={bi} className="mt-4 text-text">
                {linkify(block.text, locale)}
              </p>
            ) : (
              <ul key={bi} className="mt-4 flex flex-col gap-3">
                {block.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-text">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    <span>{linkify(item, locale)}</span>
                  </li>
                ))}
              </ul>
            ),
          )}
        </div>
      ))}
    </section>
  );
}
