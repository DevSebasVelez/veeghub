// The period a Meta report covers, read from the URL. Pure: dates are
// calendar-day keys ("2026-11-26") in the business time zone.

export type PeriodParams = { dias?: string; mes?: string; desde?: string; hasta?: string };

export type Period = {
  since: string;
  until: string;
  /** What the period filter shows as selected. */
  value: string;
  label: string;
  kind: "dias" | "mes" | "rango";
  days: number;
  previous: { since: string; until: string };
  /** "2026-11" when it is exactly one calendar month (reach can be read whole). */
  month: string | null;
};

const DAY_MS = 86_400_000;
const KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export const DAY_OPTIONS = [7, 30, 90] as const;

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function shiftKey(key: string, days: number) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(since: string, until: string) {
  return Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`)) / DAY_MS) + 1;
}

export function monthBounds(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const since = `${month}-01`;
  const until = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
  return { since, until };
}

export function monthLabel(month: string, short = false) {
  const [year, mon] = month.split("-").map(Number);
  const name = MONTH_NAMES[mon - 1] ?? month;
  if (short) return `${name.slice(0, 3)} ${String(year).slice(2)}`;
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}

/** The last `count` months, newest first, as "yyyy-MM". */
export function recentMonths(today: string, count: number) {
  const [year, mon] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, mon - 1 - index, 1));
    return date.toISOString().slice(0, 7);
  });
}

function previousOf(since: string, until: string) {
  const days = daysBetween(since, until);
  return { since: shiftKey(since, -days), until: shiftKey(since, -1) };
}

export function parsePeriod(params: PeriodParams, today: string): Period {
  if (params.mes && MONTH.test(params.mes) && params.mes <= today.slice(0, 7)) {
    const bounds = monthBounds(params.mes);
    const until = bounds.until > today ? today : bounds.until;
    const [year, mon] = params.mes.split("-").map(Number);
    const prevMonth = new Date(Date.UTC(year, mon - 2, 1)).toISOString().slice(0, 7);
    const prev = monthBounds(prevMonth);
    // A month in progress compares against the same days of last month.
    const prevUntil = until === bounds.until ? prev.until : shiftKey(prev.since, daysBetween(bounds.since, until) - 1);
    return {
      since: bounds.since,
      until,
      value: `mes:${params.mes}`,
      label: monthLabel(params.mes),
      kind: "mes",
      days: daysBetween(bounds.since, until),
      previous: { since: prev.since, until: prevUntil > prev.until ? prev.until : prevUntil },
      month: params.mes,
    };
  }

  if (params.desde && params.hasta && KEY.test(params.desde) && KEY.test(params.hasta) && params.desde <= params.hasta) {
    const until = params.hasta > today ? today : params.hasta;
    const since = params.desde > until ? until : params.desde;
    return {
      since,
      until,
      value: "rango",
      label: `${since} → ${until}`,
      kind: "rango",
      days: daysBetween(since, until),
      previous: previousOf(since, until),
      month: null,
    };
  }

  const requested = Number(params.dias);
  const days = (DAY_OPTIONS as readonly number[]).includes(requested) ? requested : 30;
  const since = shiftKey(today, -(days - 1));
  return {
    since,
    until: today,
    value: `dias:${days}`,
    label: `Últimos ${days} días`,
    kind: "dias",
    days,
    previous: previousOf(since, today),
    month: null,
  };
}

/** Query string that keeps the period (and nothing else). */
export function periodQuery(period: Period) {
  if (period.kind === "mes" && period.month) return `mes=${period.month}`;
  if (period.kind === "rango") return `desde=${period.since}&hasta=${period.until}`;
  return `dias=${period.days}`;
}
