// Which periods of a recurring expense are due, as pure calendar math on
// UTC-midnight dates (the form @db.Date columns use).

export type RecurrenceTemplate = {
  frequency: string;
  dayOfMonth: number;
  startDate: Date;
  endDate: Date | null;
};

export type DuePeriod = { period: string; expenseDate: Date };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Periods due up to the end of `today`'s month, oldest first.
 *
 * A period is due on `dayOfMonth` of its month (yearly templates: the start
 * date's month every year). It counts when that date falls inside
 * [startDate, endDate] and no later than the current month, so a monthly
 * bill appears at the start of its month instead of on the day it is due.
 * `limit` keeps only the most recent periods, so a template started long ago
 * cannot flood the ledger.
 */
export function duePeriods(
  template: RecurrenceTemplate,
  today: Date,
  limit = 24,
): DuePeriod[] {
  const day = Math.min(Math.max(template.dayOfMonth, 1), 28);
  const horizon = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0);
  const start = template.startDate.getTime();
  const end = template.endDate ? template.endDate.getTime() : Infinity;
  const yearly = template.frequency === "YEARLY";
  const step = yearly ? 12 : 1;

  const periods: DuePeriod[] = [];
  let year = template.startDate.getUTCFullYear();
  let month = template.startDate.getUTCMonth();

  for (;;) {
    const due = Date.UTC(year, month, day);
    if (due > horizon || due > end) break;
    if (due >= start) {
      periods.push({
        period: yearly ? String(year) : `${year}-${pad(month + 1)}`,
        expenseDate: new Date(due),
      });
    }
    month += step;
    year += Math.floor(month / 12);
    month %= 12;
  }

  return periods.slice(-limit);
}

/** The first due date after `today`, for display. Null once it has ended. */
export function nextDueDate(template: RecurrenceTemplate, today: Date) {
  const later = new Date(Date.UTC(today.getUTCFullYear() + 2, today.getUTCMonth(), 1));
  const all = duePeriods(template, later, 1000);
  return all.find((p) => p.expenseDate.getTime() > today.getTime())?.expenseDate ?? null;
}
