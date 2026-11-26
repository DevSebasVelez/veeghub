import { formatCurrency } from "@/lib/admin/format";

export function money(value: number | null | undefined) {
  return value == null ? "—" : formatCurrency(value);
}

export function compact(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-EC", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function percent(value: number | null | undefined, digits = 1) {
  return value == null ? "—" : `${value.toFixed(digits)}%`;
}

export function budgetLabel(daily: number | null, lifetime: number | null) {
  if (daily) return `${formatCurrency(daily)}/día`;
  if (lifetime) return `${formatCurrency(lifetime)} total`;
  return "Sin presupuesto";
}
