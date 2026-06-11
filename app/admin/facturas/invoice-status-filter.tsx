"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_FILTERS = [
  { value: "_all", label: "Todas" },
  { value: "READY_TO_SEND", label: "Por enviar" },
  { value: "SENT", label: "Enviadas" },
  { value: "PAID", label: "Pagadas" },
  { value: "CANCELLED", label: "Canceladas" },
] as const;

export function InvoiceStatusFilter({ value }: { value?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentValue = value && value !== "" ? value : "_all";

  function handleChange(nextValue: string) {
    const params = new URLSearchParams(searchParams);
    params.delete("page");

    if (nextValue === "_all") {
      params.delete("status");
    } else {
      params.set("status", nextValue);
    }

    const query = params.toString();
    router.push(query ? `/admin/facturas?${query}` : "/admin/facturas");
  }

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger className="h-10 w-full justify-between rounded-lg bg-background sm:w-48">
        <span className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {STATUS_FILTERS.map((filter) => (
          <SelectItem key={filter.value} value={filter.value}>
            {filter.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
