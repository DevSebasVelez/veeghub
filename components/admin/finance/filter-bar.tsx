"use client";

import { type FormEvent, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Filter } from "lucide-react";

import { FormSelect } from "@/components/admin/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FilterSelect = {
  name: string;
  label: string;
  value?: string | null;
  options: Array<{ value: string; label: string }>;
};

/**
 * GET form whose values live in the URL, so a filtered view can be refreshed
 * or shared. Submitting is a client-side navigation that only writes the
 * filters actually in use: "Todos" and the default period are left out, so
 * the URL stays short. Without JavaScript it still works as a plain GET form.
 */
export function FilterBar({
  basePath,
  from,
  to,
  selects = [],
  hidden = {},
  exportHref,
  defaults = {},
}: {
  basePath: string;
  from: string;
  to: string;
  selects?: FilterSelect[];
  hidden?: Record<string, string | undefined>;
  /** CSV download for the current filters. */
  exportHref?: string;
  /** Values that mean "no filter" for a field (e.g. the default period). */
  defaults?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = new URLSearchParams();
    for (const [key, raw] of new FormData(event.currentTarget)) {
      const value = String(raw).trim();
      if (!value || value === "all" || defaults[key] === value) continue;
      search.set(key, value);
    }
    const query = search.toString();
    startTransition(() => {
      router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
    });
  }

  return (
    <form
      method="get"
      action={basePath}
      onSubmit={handleSubmit}
      className="grid grid-cols-2 gap-3 rounded-lg border bg-background p-3 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] lg:items-end"
    >
      {Object.entries(hidden).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
      <div className="space-y-1">
        <Label htmlFor="filter-desde" className="text-xs text-muted-foreground">
          Desde
        </Label>
        <Input
          id="filter-desde"
          type="date"
          name="desde"
          defaultValue={from}
          className="h-10"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-hasta" className="text-xs text-muted-foreground">
          Hasta
        </Label>
        <Input
          id="filter-hasta"
          type="date"
          name="hasta"
          defaultValue={to}
          className="h-10"
        />
      </div>
      {selects.map((select) => (
        <div key={select.name} className="min-w-0 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {select.label}
          </span>
          <FormSelect
            name={select.name}
            defaultValue={select.value || ""}
            options={select.options}
          />
        </div>
      ))}
      <div className="col-span-2 flex gap-2 lg:col-span-1">
        <Button type="submit" className="h-10 flex-1" disabled={pending}>
          <Filter className="size-4" />
          Aplicar
        </Button>
        <Button asChild variant="outline" className="h-10">
          <Link href={basePath} scroll={false}>
            Limpiar
          </Link>
        </Button>
        {exportHref ? (
          // Plain anchor: a file download, nothing for the router to prefetch.
          <Button
            asChild
            variant="outline"
            className="h-10"
            title="Exportar CSV"
          >
            <a href={exportHref} download>
              <Download className="size-4" />
              <span className="sr-only lg:not-sr-only">CSV</span>
            </a>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
