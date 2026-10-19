"use client";

import { type FormEvent, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Loader2, SlidersHorizontal } from "lucide-react";

import { FormSelect } from "@/components/admin/form-select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type FilterField = {
  name: string;
  label: string;
  value?: string | null;
  options: Array<{ value: string; label: string }>;
};

/**
 * Secondary filters behind one "Filtros" button, so the toolbar stays a single
 * row on any width. Applying rewrites only these fields in the URL and keeps
 * the rest (the month, the status tab); "all" values are dropped.
 */
export function FilterPopover({ fields }: { fields: FilterField[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = fields.filter((f) => f.value && f.value !== "all").length;

  function navigate(values: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const field of fields) {
      const value = values[field.name];
      if (!value || value === "all") params.delete(field.name);
      else params.set(field.name, value);
    }
    params.delete("page");
    const query = params.toString();
    setOpen(false);
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    navigate(
      Object.fromEntries(fields.map((f) => [f.name, String(data.get(f.name) ?? "")])),
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-10 rounded-full">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SlidersHorizontal className="size-4" />
          )}
          Filtros
          {active ? (
            <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground tabular-nums">
              {active}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {field.label}
              </span>
              <FormSelect
                name={field.name}
                defaultValue={field.value || "all"}
                options={field.options}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1">
              Aplicar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!active}
              onClick={() => navigate({})}
            >
              Limpiar
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** CSV download for what is on screen. A plain anchor: nothing to prefetch. */
export function ExportButton({ href }: { href: string }) {
  return (
    <Button asChild variant="outline" className="h-10 rounded-full" title="Exportar CSV">
      <a href={href} download>
        <Download className="size-4" />
        <span className="hidden sm:inline">Exportar</span>
      </a>
    </Button>
  );
}
