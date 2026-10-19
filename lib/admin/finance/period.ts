import { dayKeyInAppZone } from "@/lib/admin/format";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A "yyyy-MM-dd" search param as the UTC-midnight value @db.Date stores. */
export function parseDayParam(value: string | undefined) {
  if (!value || !DAY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Period filter for the finance views. Defaults to the current year to date,
 * counted in the business timezone. Both ends are inclusive calendar days.
 */
export function resolvePeriod(params: { desde?: string; hasta?: string }) {
  const today = dayKeyInAppZone(new Date());
  const from = parseDayParam(params.desde) ?? parseDayParam(`${today.slice(0, 4)}-01-01`)!;
  const to = parseDayParam(params.hasta) ?? parseDayParam(today)!;

  return {
    from,
    to,
    fromKey: from.toISOString().slice(0, 10),
    toKey: to.toISOString().slice(0, 10),
    /** Prisma range for @db.Date columns. */
    range: { gte: from, lte: to },
  };
}

/** Query string with the set params only (for links that keep the filters). */
export function queryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "all") search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** Filter params from FilterBar; "all" and empty mean no filter. */
export function cleanParam(value: string | undefined) {
  return value && value !== "all" ? value : undefined;
}
