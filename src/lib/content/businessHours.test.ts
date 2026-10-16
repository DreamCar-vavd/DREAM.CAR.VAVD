import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_HOURS,
  hoursFieldErrors,
  hoursRows,
  isValidTime,
  openingHoursSpecification,
  toSundayMode,
  type BusinessHours,
} from "./businessHours";

const AGREED: BusinessHours = {
  weekdayOpen: "09:00",
  weekdayClose: "18:00",
  saturdayOpen: "10:00",
  saturdayClose: "14:00",
  sundayMode: "byAppointment",
};

test("isValidTime accepts strict 24h HH:mm only", () => {
  for (const ok of ["00:00", "09:00", "18:30", "23:59"]) assert.equal(isValidTime(ok), true, ok);
  for (const bad of ["25:00", "24:00", "9:00", "09:60", "09.00", "0900", "", " 09:00"]) {
    assert.equal(isValidTime(bad), false, bad);
  }
});

test("the agreed schedule is valid", () => {
  assert.deepEqual(hoursFieldErrors(AGREED), []);
});

test("25:00 is rejected", () => {
  assert.deepEqual(hoursFieldErrors({ ...AGREED, weekdayClose: "25:00" }), ["weekdayClose"]);
});

test("closing before (or equal to) opening is rejected", () => {
  assert.deepEqual(hoursFieldErrors({ ...AGREED, saturdayClose: "09:00" }), ["saturdayClose"]);
  assert.deepEqual(hoursFieldErrors({ ...AGREED, weekdayClose: "09:00" }), ["weekdayClose"]);
});

test("an incomplete pair is rejected on both fields", () => {
  assert.deepEqual(hoursFieldErrors({ ...AGREED, saturdayClose: "" }), ["saturdayOpen", "saturdayClose"]);
  assert.deepEqual(hoursFieldErrors({ ...AGREED, weekdayOpen: "" }), ["weekdayOpen", "weekdayClose"]);
});

test("a fully empty schedule is valid but renders nothing and sends nothing to Google", () => {
  assert.deepEqual(hoursFieldErrors(EMPTY_HOURS), []);
  assert.deepEqual(hoursRows(EMPTY_HOURS), []);
  assert.deepEqual(openingHoursSpecification(EMPTY_HOURS), []);
});

test("rows for the agreed schedule: weekdays, Saturday, Sunday by appointment", () => {
  assert.deepEqual(hoursRows(AGREED), [
    { day: "weekdays", time: { open: "09:00", close: "18:00" } },
    { day: "saturday", time: { open: "10:00", close: "14:00" } },
    { day: "sunday", time: "byAppointment" },
  ]);
  assert.deepEqual(hoursRows({ ...AGREED, sundayMode: "closed" }).at(-1), { day: "sunday", time: "closed" });
});

test("an empty Saturday pair hides only the Saturday row", () => {
  assert.deepEqual(
    hoursRows({ ...AGREED, saturdayOpen: "", saturdayClose: "" }).map((r) => r.day),
    ["weekdays", "sunday"],
  );
});

test("invalid pairs never render or reach Google, even if they bypassed the gate", () => {
  const broken = { ...AGREED, weekdayClose: "25:00" };
  assert.deepEqual(hoursRows(broken).map((r) => r.day), ["saturday", "sunday"]);
  assert.deepEqual(openingHoursSpecification(broken).map((s) => s.dayOfWeek), [["Saturday"]]);
});

test("Google gets Mon–Fri and Saturday from the same data; Sunday is never sent", () => {
  const spec = openingHoursSpecification(AGREED);
  assert.deepEqual(spec, [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "10:00", closes: "14:00" },
  ]);
  assert.ok(!JSON.stringify(spec).includes("Sunday"));
  assert.deepEqual(openingHoursSpecification({ ...AGREED, sundayMode: "closed" }), spec);
});

test("page rows and JSON-LD carry identical times", () => {
  const timed = hoursRows(AGREED).flatMap((r) => (typeof r.time === "string" ? [] : [r.time]));
  assert.deepEqual(
    timed,
    openingHoursSpecification(AGREED).map((s) => ({ open: s.opens, close: s.closes })),
  );
});

test("unknown Sunday modes fall back to by-appointment", () => {
  assert.equal(toSundayMode("closed"), "closed");
  assert.equal(toSundayMode("byAppointment"), "byAppointment");
  assert.equal(toSundayMode(undefined), "byAppointment");
  assert.equal(toSundayMode("open"), "byAppointment");
});
