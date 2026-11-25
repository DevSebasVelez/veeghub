/**
 * Calendar arithmetic on "yyyy-MM-dd" day keys of the business zone.
 *
 * A post is an instant; the calendar shows the Ecuador day it falls on, which
 * the server already resolved (`dayKeyInAppZone`). From there everything is a
 * calendar date and is handled at UTC midnight — the same treatment the
 * runbook prescribes for date-only values — so no step depends on the host's
 * or the browser's timezone.
 */

const KEY = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isDayKey(value: unknown): value is string {
  // Round trip: "2026-13-01" parses (Date.UTC overflows into 2027) but is not a day.
  return typeof value === "string" && KEY.test(value) && toKey(toUtc(value)) === value;
}

export function addDays(key: string, days: number) {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toKey(date);
}

export function addMonths(key: string, months: number) {
  const date = toUtc(key);
  // Day 1 first, so 31-jan + 1 month is february and not 3-march.
  return toKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)));
}

/** Monday of the week that contains the day. */
export function weekStart(key: string) {
  const weekday = (toUtc(key).getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(key, -weekday);
}

export function weekDays(key: string) {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Weeks (Monday first) covering the month of the day. */
export function monthGrid(key: string) {
  const date = toUtc(key);
  const first = toKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
  const last = toKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
  const weeks: string[][] = [];

  for (let start = weekStart(first); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }

  return weeks;
}

export function sameMonth(a: string, b: string) {
  return a.slice(0, 7) === b.slice(0, 7);
}

function format(key: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-EC", { ...options, timeZone: "UTC" }).format(toUtc(key));
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthLabel(key: string) {
  return capitalize(format(key, { month: "long", year: "numeric" }));
}

/** "lun 1" */
export function shortDayLabel(key: string) {
  return format(key, { weekday: "short", day: "numeric" }).replace(".", "");
}

/** "Martes, 1 de diciembre" */
export function longDayLabel(key: string) {
  return capitalize(format(key, { weekday: "long", day: "numeric", month: "long" }));
}

export function rangeLabel(from: string, to: string) {
  return `${format(from, { day: "numeric", month: "short" })} – ${format(to, { day: "numeric", month: "short", year: "numeric" })}`.replace(/\./g, "");
}

export const WEEKDAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
