import assert from "node:assert/strict";
import { test } from "node:test";

import { dayKeyStart, hourInAppZone, scheduleWindow } from "./schedule";

test("dayKeyStart da la medianoche de Ecuador (05:00 UTC)", () => {
  assert.equal(dayKeyStart("2026-12-01").toISOString(), "2026-12-01T05:00:00.000Z");
});

test("scheduleWindow a las 20:00 de Ecuador sigue en el mismo día", () => {
  // 30-nov 20:00 Ecuador = 1-dic 01:00 UTC: el borde donde UTC ya cambió de día.
  const window = scheduleWindow(new Date("2026-12-01T01:00:00.000Z"));
  assert.equal(window.todayKey, "2026-11-30");
  assert.equal(window.tomorrowKey, "2026-12-01");
  assert.equal(window.tomorrowStart.toISOString(), "2026-12-01T05:00:00.000Z");
  assert.equal(window.dayAfterStart.toISOString(), "2026-12-02T05:00:00.000Z");
  assert.equal(window.reminderHourReached, true);
});

test("el aviso del día anterior espera hasta las 8:00 de Ecuador", () => {
  assert.equal(hourInAppZone(new Date("2026-11-30T12:59:00.000Z")), 7);
  assert.equal(scheduleWindow(new Date("2026-11-30T12:59:00.000Z")).reminderHourReached, false);
  assert.equal(scheduleWindow(new Date("2026-11-30T13:00:00.000Z")).reminderHourReached, true);
});

test("medianoche local y cambio de año", () => {
  const window = scheduleWindow(new Date("2027-01-01T05:00:00.000Z"));
  assert.equal(window.todayKey, "2027-01-01");
  assert.equal(window.reminderHourReached, false);

  const lastDay = scheduleWindow(new Date("2027-01-01T04:59:00.000Z"));
  assert.equal(lastDay.todayKey, "2026-12-31");
  assert.equal(lastDay.tomorrowKey, "2027-01-01");
});
