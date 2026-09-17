"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const RANGE_OPTIONS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Último año" },
] as const;

export function CampaignRangeFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function setRange(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("dias", value);

    startTransition(() => {
      router.push(`/admin/campanas?${next.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <CalendarDays size={15} className="shrink-0 text-muted-foreground" />
      <Select value={params.get("dias") ?? "30"} onValueChange={setRange}>
        <SelectTrigger size="sm" aria-label="Período" className="border-0 shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
