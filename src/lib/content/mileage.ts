import type { ContentLocale } from "./carsGate";

/**
 * The panel stores mileage once, as a plain number of miles. The display
 * string ("47 170 миль" / "47,170 miles") is rebuilt per language here, so a
 * shared fact never has to be re-typed for each locale.
 *
 * Grouping is done by hand (space for uk/ru, comma for en) to byte-match the
 * strings the site shipped before the panel; `Intl.NumberFormat` uses a
 * narrow no-break space for ru-RU and would change the rendered output.
 */
function groupThousands(value: number, separator: string): string {
  return String(Math.trunc(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

const UNIT: Record<ContentLocale, string> = {
  uk: "миль",
  ru: "миль",
  en: "miles",
};

export function formatMileage(miles: number, locale: ContentLocale): string {
  if (!Number.isFinite(miles) || miles < 0) return "";
  const separator = locale === "en" ? "," : " ";
  return `${groupThousands(miles, separator)} ${UNIT[locale]}`;
}
