"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; count?: number };

const PERIOD_KEYS = ["dias", "mes", "desde", "hasta"];

/**
 * Period (days, a calendar month or a free range) plus optional facet
 * selects. Everything lives in the URL; other params (vista, …) are kept.
 */
export function CampaignsToolbar({
  period,
  months,
  since,
  until,
  facets = [],
  className,
}: {
  period: string;
  months: Option[];
  since: string;
  until: string;
  facets?: Array<{ param: string; label: string; value: string; options: Option[] }>;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState(period === "rango");
  const [from, setFrom] = useState(since);
  const [to, setTo] = useState(until);

  function push(update: Record<string, string | null>, clearPeriod = false) {
    const next = new URLSearchParams(params.toString());
    if (clearPeriod) for (const key of PERIOD_KEYS) next.delete(key);
    for (const [key, value] of Object.entries(update)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function setPeriod(value: string) {
    if (value === "rango") {
      setCustom(true);
      return;
    }
    setCustom(false);
    const [kind, arg] = value.split(":");
    push(kind === "mes" ? { mes: arg } : { dias: arg }, true);
  }

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      <div className="flex min-w-0 items-center gap-2 rounded-xl border bg-card pl-3 pr-1">
        {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <CalendarDays className="size-4 shrink-0 text-blue-500" />}
        <Select value={custom ? "rango" : period} onValueChange={setPeriod}>
          <SelectTrigger aria-label="Período" className="h-10 w-full border-0 shadow-none sm:h-9 sm:w-48 dark:bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="dias:7">Últimos 7 días</SelectItem>
              <SelectItem value="dias:30">Últimos 30 días</SelectItem>
              <SelectItem value="dias:90">Últimos 90 días</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Por mes</SelectLabel>
              {months.map((month) => (
                <SelectItem key={month.value} value={`mes:${month.value}`}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectItem value="rango">Rango personalizado…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {custom ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (from && to) push({ desde: from <= to ? from : to, hasta: from <= to ? to : from }, true);
          }}
        >
          <Input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} aria-label="Desde" className="h-10 w-auto sm:h-9" />
          <span className="text-xs text-muted-foreground">a</span>
          <Input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} aria-label="Hasta" className="h-10 w-auto sm:h-9" />
          <Button type="submit" size="sm" variant="secondary" className="max-sm:h-10">
            Aplicar
          </Button>
        </form>
      ) : null}

      {facets.length ? (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {facets.map((facet) => (
            <Select key={facet.param} value={facet.value || "todos"} onValueChange={(value) => push({ [facet.param]: value === "todos" ? null : value })}>
              <SelectTrigger aria-label={facet.label} className="h-10 w-full rounded-xl bg-card sm:h-9 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{facet.label}: todos</SelectItem>
                {facet.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                    {option.count != null ? ` (${option.count})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      ) : null}
    </div>
  );
}
