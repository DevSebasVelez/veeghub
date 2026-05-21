"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

export function ReportFilter({
  year,
  month,
  availableYears,
}: {
  year: number;
  month: number;
  availableYears: number[];
}) {
  const router = useRouter();

  function update(next: { year?: number; month?: number }) {
    const params = new URLSearchParams();
    params.set("year", String(next.year ?? year));
    params.set("month", String(next.month ?? month));
    router.push(`/admin/reportes?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <CalendarDays size={15} className="text-muted-foreground" />
      <select
        value={year}
        onChange={(e) => update({ year: Number(e.target.value) })}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        aria-label="Año del reporte"
      >
        {availableYears.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => update({ month: Number(e.target.value) })}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        aria-label="Mes del reporte"
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
