// Calendar months for the finance views, as "yyyy-MM" keys. Pure and
// client-safe: the month picker and the server pages share these.

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const MONTH_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function isMonthKey(value: string | null | undefined): value is string {
  return !!value && MONTH.test(value);
}

export function monthKey(year: number, monthIndex: number) {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

/** Moves a month key by `delta` months. */
export function shiftMonth(key: string, delta: number) {
  const { year, monthIndex } = parseMonthKey(key);
  return monthKey(year, monthIndex + delta);
}

export function monthLabel(key: string, short = false) {
  const { year, monthIndex } = parseMonthKey(key);
  return `${(short ? MONTH_SHORT : MONTH_NAMES)[monthIndex]} ${year}`;
}

/** First and last calendar day of the month, as @db.Date UTC-midnight dates. */
export function monthBounds(key: string) {
  const { year, monthIndex } = parseMonthKey(key);
  const from = new Date(Date.UTC(year, monthIndex, 1));
  const to = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    from,
    to,
    fromKey: from.toISOString().slice(0, 10),
    toKey: to.toISOString().slice(0, 10),
    range: { gte: from, lte: to },
  };
}

/** The `count` month keys ending at `key`, oldest first. */
export function monthsEndingAt(key: string, count: number) {
  return Array.from({ length: count }, (_, i) => shiftMonth(key, i - count + 1));
}
