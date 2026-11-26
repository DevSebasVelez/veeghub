import { dayKeyInAppZone } from "@/lib/admin/format";
import { CAMPAIGN_KIND_LABELS, CAMPAIGN_KINDS, DELIVERY_LABELS, DELIVERY_STATES } from "@/lib/meta/campaign-kind";
import { monthLabel, parsePeriod, periodQuery, recentMonths, type PeriodParams } from "@/lib/meta/period";

/** Period + the options the toolbar needs, from the page's searchParams. */
export function readPeriod(params: PeriodParams) {
  const today = dayKeyInAppZone(new Date());
  const period = parsePeriod(params, today);
  return {
    today,
    period,
    query: periodQuery(period),
    months: recentMonths(today, 12).map((value) => ({ value, label: monthLabel(value) })),
  };
}

const dayLabel = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", timeZone: "UTC" });

export function chartLabel(day: string) {
  return dayLabel.format(new Date(`${day}T00:00:00.000Z`));
}

export function stateOptions(counts: Partial<Record<string, number>>) {
  return DELIVERY_STATES.filter((state) => counts[state]).map((state) => ({ value: state, label: DELIVERY_LABELS[state], count: counts[state] }));
}

export function kindOptions(counts: Partial<Record<string, number>>) {
  return CAMPAIGN_KINDS.filter((kind) => counts[kind]).map((kind) => ({ value: kind, label: CAMPAIGN_KIND_LABELS[kind], count: counts[kind] }));
}
