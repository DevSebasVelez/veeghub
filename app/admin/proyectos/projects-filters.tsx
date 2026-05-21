"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "LEAD", label: "Lead" },
  { value: "ACTIVE", label: "Activo" },
  { value: "PAUSED", label: "Pausado" },
  { value: "COMPLETED", label: "Completado" },
  { value: "ARCHIVED", label: "Archivado" },
];

export function ProjectsFilters({
  clients,
  view,
}: {
  clients: Array<{ id: string; name: string }>;
  view: "grid" | "list";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      push({ q: q || null });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function push(next: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [key, value] of Object.entries(next)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters =
    !!searchParams.get("q") ||
    !!searchParams.get("status") ||
    !!searchParams.get("clientId");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar proyecto..."
          className="pl-8 pr-8"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <Select
        value={searchParams.get("status") || "_all"}
        onValueChange={(v) => push({ status: v === "_all" ? null : v })}
      >
        <SelectTrigger className="w-auto min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value || "_all"} value={opt.value || "_all"}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("clientId") || "_all"}
        onValueChange={(v) => push({ clientId: v === "_all" ? null : v })}
      >
        <SelectTrigger className="w-auto min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos los clientes</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <button
          onClick={() => {
            setQ("");
            push({ q: null, status: null, clientId: null });
          }}
          className="flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          <X size={13} />
          Limpiar
        </button>
      )}

      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => push({ view: "grid" })}
          className={`rounded p-1.5 transition-colors ${
            view === "grid"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Vista cuadrícula"
        >
          <LayoutGrid size={15} />
        </button>
        <button
          onClick={() => push({ view: "list" })}
          className={`rounded p-1.5 transition-colors ${
            view === "list"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Vista lista"
        >
          <List size={15} />
        </button>
      </div>
    </div>
  );
}
