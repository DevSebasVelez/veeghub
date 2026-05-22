"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Calendar-date semantics: state is a plain "YYYY-MM-DD" string so the value
// never crosses a timezone boundary. Conversion to a Date only happens at the
// Calendar component boundary (local-noon construction avoids DST edge cases).

function toIsoDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function fromIsoDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function DatePickerField({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: Date | string | null;
}) {
  const [iso, setIso] = useState<string>(() => toIsoDate(defaultValue));
  const selected = fromIsoDate(iso);

  return (
    <Popover>
      <input type="hidden" name={name} value={iso} />
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon />
          {selected
            ? format(selected, "PPP", { locale: es })
            : "Seleccionar fecha"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) {
              setIso("");
              return;
            }
            setIso(
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
            );
          }}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  );
}
