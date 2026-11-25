import assert from "node:assert/strict";
import { test } from "node:test";

import { addMonths, isDayKey, longDayLabel, monthGrid, weekDays, weekStart } from "./calendar";

test("weekStart va al lunes", () => {
  assert.equal(weekStart("2026-12-01"), "2026-11-30"); // martes → lunes
  assert.equal(weekStart("2026-12-06"), "2026-11-30"); // domingo → lunes
  assert.equal(weekDays("2026-12-01").at(-1), "2026-12-06");
});

test("monthGrid cubre el mes completo en semanas de lunes a domingo", () => {
  const weeks = monthGrid("2026-12-15");
  assert.equal(weeks[0][0], "2026-11-30");
  assert.equal(weeks.at(-1)?.at(-1), "2027-01-03");
  assert.ok(weeks.every((week) => week.length === 7));
});

test("addMonths no se salta febrero", () => {
  assert.equal(addMonths("2027-01-31", 1), "2027-02-01");
  assert.equal(addMonths("2027-01-05", -1), "2026-12-01");
});

test("etiquetas y validación", () => {
  assert.equal(longDayLabel("2026-12-01"), "Martes, 1 de diciembre");
  assert.equal(isDayKey("2026-12-01"), true);
  assert.equal(isDayKey("2026-13-01"), false);
  assert.equal(isDayKey("x"), false);
});
