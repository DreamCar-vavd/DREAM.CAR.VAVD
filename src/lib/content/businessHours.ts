/**
 * Structured opening hours for the site Contacts record. Entered ONCE for all
 * languages (times never differ per locale); only the day names / labels are
 * translated, and those come from the code dictionaries.
 *
 * One source for both consumers: the Contacts block on the home page and the
 * schema.org `openingHoursSpecification` in the layout JSON-LD are built from
 * the same `BusinessHours` value, so the page and Google can never disagree.
 */

export type SundayMode = "closed" | "byAppointment";

export interface BusinessHours {
  weekdayOpen: string;
  weekdayClose: string;
  saturdayOpen: string;
  saturdayClose: string;
  sundayMode: SundayMode;
}

export type HoursField = "weekdayOpen" | "weekdayClose" | "saturdayOpen" | "saturdayClose";

export const EMPTY_HOURS: BusinessHours = {
  weekdayOpen: "",
  weekdayClose: "",
  saturdayOpen: "",
  saturdayClose: "",
  sundayMode: "byAppointment",
};

/** Strict 24h `HH:mm`: hours 00–23, minutes 00–59. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(v: string): boolean {
  return TIME_RE.test(v);
}

export function toSundayMode(v: unknown): SundayMode {
  return v === "closed" ? "closed" : "byAppointment";
}

const PAIRS: [HoursField, HoursField][] = [
  ["weekdayOpen", "weekdayClose"],
  ["saturdayOpen", "saturdayClose"],
];

/**
 * Fields that make the schedule unpublishable. A pair is either fully empty
 * (that day group is not shown) or fully filled with valid times where the
 * closing time is later than the opening time.
 */
export function hoursFieldErrors(h: BusinessHours): HoursField[] {
  const bad: HoursField[] = [];
  for (const [openKey, closeKey] of PAIRS) {
    const open = (h[openKey] ?? "").trim();
    const close = (h[closeKey] ?? "").trim();
    if (!open && !close) continue;
    if (!open || !close) {
      bad.push(openKey, closeKey); // incomplete pair
      continue;
    }
    if (!isValidTime(open)) bad.push(openKey);
    if (!isValidTime(close)) bad.push(closeKey);
    if (isValidTime(open) && isValidTime(close) && close <= open) bad.push(closeKey);
  }
  return bad;
}

function validPair(h: BusinessHours, openKey: HoursField, closeKey: HoursField) {
  const open = (h[openKey] ?? "").trim();
  const close = (h[closeKey] ?? "").trim();
  return isValidTime(open) && isValidTime(close) && close > open ? { open, close } : null;
}

export interface HoursRow {
  day: "weekdays" | "saturday" | "sunday";
  /** `{ open, close }` for a timed row; `sundayMode` for the Sunday row. */
  time: { open: string; close: string } | SundayMode;
}

/**
 * Rows to render. Empty when there is no valid timed pair at all — the whole
 * schedule block is then hidden (a lone "Sunday by appointment" line without
 * any opening hours would read as if the business were otherwise closed).
 * Invalid pairs are skipped defensively even though the publish gate already
 * blocks them.
 */
export function hoursRows(h: BusinessHours): HoursRow[] {
  const weekdays = validPair(h, "weekdayOpen", "weekdayClose");
  const saturday = validPair(h, "saturdayOpen", "saturdayClose");
  if (!weekdays && !saturday) return [];
  const rows: HoursRow[] = [];
  if (weekdays) rows.push({ day: "weekdays", time: weekdays });
  if (saturday) rows.push({ day: "saturday", time: saturday });
  rows.push({ day: "sunday", time: h.sundayMode });
  return rows;
}

export interface OpeningHoursSpecification {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

/**
 * schema.org opening hours for the same data. Sunday is never included: "by
 * appointment" is not a fixed opening time, and "closed" is expressed by
 * simply not listing the day.
 */
export function openingHoursSpecification(h: BusinessHours): OpeningHoursSpecification[] {
  const out: OpeningHoursSpecification[] = [];
  const weekdays = validPair(h, "weekdayOpen", "weekdayClose");
  const saturday = validPair(h, "saturdayOpen", "saturdayClose");
  if (weekdays) {
    out.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: weekdays.open,
      closes: weekdays.close,
    });
  }
  if (saturday) {
    out.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday"],
      opens: saturday.open,
      closes: saturday.close,
    });
  }
  return out;
}
