"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";

import { SOURCE_LABELS, STAGE_LABELS } from "@/components/admin/leads/constants";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LeadFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());

    if (!value || value === "all") next.delete(key);
    else next.set(key, value);

    // Any filter change invalidates the current page number.
    next.delete("page");

    startTransition(() => {
      router.push(`/admin/leads?${next.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          placeholder="Buscar por nombre, teléfono o email..."
          defaultValue={params.get("q") ?? ""}
          className="pl-8"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setParam("q", event.currentTarget.value.trim());
            }
          }}
        />
      </div>

      <Select
        value={params.get("stage") ?? "all"}
        onValueChange={(value) => setParam("stage", value)}
      >
        <SelectTrigger className="sm:w-44">
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las etapas</SelectItem>
          {Object.entries(STAGE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("source") ?? "all"}
        onValueChange={(value) => setParam("source", value)}
      >
        <SelectTrigger className="sm:w-44">
          <SelectValue placeholder="Origen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los orígenes</SelectItem>
          {Object.entries(SOURCE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
