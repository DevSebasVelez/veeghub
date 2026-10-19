import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { duePeriods, nextDueDate } from "@/lib/admin/finance/recurrence";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const periods = (t: Parameters<typeof duePeriods>[0], today: string, limit?: number) =>
  duePeriods(t, d(today), limit).map((p) => `${p.period}@${p.expenseDate.toISOString().slice(0, 10)}`);

describe("recurring expense periods", () => {
  const monthly = { frequency: "MONTHLY", dayOfMonth: 5, startDate: d("2026-08-10"), endDate: null };

  it("starts at the first due date on or after the start date", () => {
    assert.deepEqual(periods(monthly, "2026-10-01"), [
      "2026-09@2026-09-05",
      "2026-10@2026-10-05",
    ]);
  });

  it("includes the current month even before its due day", () => {
    assert.deepEqual(periods({ ...monthly, dayOfMonth: 28 }, "2026-10-02").at(-1), "2026-10@2026-10-28");
  });

  it("stops at the end date", () => {
    assert.deepEqual(periods({ ...monthly, endDate: d("2026-09-30") }, "2026-12-15"), ["2026-09@2026-09-05"]);
  });

  it("crosses the year boundary", () => {
    assert.deepEqual(periods({ ...monthly, startDate: d("2026-11-01") }, "2027-01-20"), [
      "2026-11@2026-11-05",
      "2026-12@2026-12-05",
      "2027-01@2027-01-05",
    ]);
  });

  it("yearly templates repeat in the start month", () => {
    const yearly = { frequency: "YEARLY", dayOfMonth: 15, startDate: d("2025-03-01"), endDate: null };
    assert.deepEqual(periods(yearly, "2026-10-19"), ["2025@2025-03-15", "2026@2026-03-15"]);
  });

  it("keeps only the most recent periods", () => {
    const old = { ...monthly, startDate: d("2020-01-01") };
    const res = periods(old, "2026-10-19", 3);
    assert.deepEqual(res, ["2026-08@2026-08-05", "2026-09@2026-09-05", "2026-10@2026-10-05"]);
  });

  it("computes the next due date", () => {
    assert.equal(nextDueDate(monthly, d("2026-10-19"))?.toISOString().slice(0, 10), "2026-11-05");
    assert.equal(nextDueDate({ ...monthly, endDate: d("2026-10-31") }, d("2026-10-19")), null);
  });
});
