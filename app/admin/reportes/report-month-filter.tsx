"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <Select
        value={String(year)}
        onValueChange={(v) => update({ year: Number(v) })}
      >
        <SelectTrigger
          size="sm"
          className="w-auto"
          aria-label="Año del reporte"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(month)}
        onValueChange={(v) => update({ month: Number(v) })}
      >
        <SelectTrigger
          size="sm"
          className="w-auto min-w-32"
          aria-label="Mes del reporte"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={String(m.value)}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
