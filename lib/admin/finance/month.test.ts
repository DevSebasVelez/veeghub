import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isMonthKey,
  monthBounds,
  monthLabel,
  monthsEndingAt,
  shiftMonth,
} from "@/lib/admin/finance/month";

describe("month keys", () => {
  it("validates yyyy-MM", () => {
    assert.equal(isMonthKey("2026-10"), true);
    assert.equal(isMonthKey("2026-13"), false);
    assert.equal(isMonthKey("2026-1"), false);
    assert.equal(isMonthKey(undefined), false);
  });

  it("shifts across year boundaries", () => {
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(shiftMonth("2026-10", -12), "2025-10");
  });

  it("gives the calendar bounds of the month", () => {
    assert.equal(monthBounds("2026-02").toKey, "2026-02-28");
    assert.equal(monthBounds("2028-02").toKey, "2028-02-29");
    assert.equal(monthBounds("2026-10").fromKey, "2026-10-01");
  });

  it("labels months in Spanish", () => {
    assert.equal(monthLabel("2026-10"), "Octubre 2026");
    assert.equal(monthLabel("2026-01", true), "Ene 2026");
  });

  it("lists the trailing months oldest first", () => {
    assert.deepEqual(monthsEndingAt("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
  });
});
