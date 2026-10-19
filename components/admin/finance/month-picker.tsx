"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

import {
  MONTH_SHORT,
  monthKey,
  monthLabel,
  parseMonthKey,
  shiftMonth,
} from "@/lib/admin/finance/month";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Month-by-month period control: ‹ Octubre 2026 › with a 12-month grid in a
 * popover. The month lives in `?mes=`; the current month is the default and
 * is left out of the URL. Other query params (filters) are kept, except the
 * page number, which belongs to the previous month's list.
 */
export function MonthPicker({
  value,
  current,
  param = "mes",
}: {
  value: string;
  current: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => parseMonthKey(value).year);

  const selected = parseMonthKey(value);
  const today = parseMonthKey(current);

  function go(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === current) params.delete(param);
    else params.set(param, key);
    params.delete("page");
    const query = params.toString();
    setOpen(false);
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border bg-card p-1 shadow-xs">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        aria-label="Mes anterior"
        onClick={() => go(shiftMonth(value, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setYear(selected.year);
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 min-w-40 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition-colors hover:bg-muted"
            aria-label={`Mes: ${monthLabel(value)}. Cambiar mes`}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <CalendarDays className="size-4 text-muted-foreground" />
            )}
            {monthLabel(value)}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-72 rounded-xl p-3">
          <div className="mb-3 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              aria-label="Año anterior"
              onClick={() => setYear((y) => y - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold tabular-nums">{year}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              aria-label="Año siguiente"
              onClick={() => setYear((y) => y + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_SHORT.map((name, index) => {
              const key = monthKey(year, index);
              const isSelected =
                year === selected.year && index === selected.monthIndex;
              const isCurrent = year === today.year && index === today.monthIndex;
              const isFuture =
                year > today.year ||
                (year === today.year && index > today.monthIndex);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => go(key)}
                  aria-pressed={isSelected}
                  className={cn(
                    "relative h-10 rounded-lg text-sm font-medium transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                    !isSelected && isFuture && "text-muted-foreground",
                  )}
                >
                  {name}
                  {isCurrent && !isSelected ? (
                    <span className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {value !== current ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full rounded-lg"
              onClick={() => go(current)}
            >
              Ir al mes actual
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        aria-label="Mes siguiente"
        onClick={() => go(shiftMonth(value, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
