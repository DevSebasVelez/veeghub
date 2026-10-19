import Link from "next/link";
import { Filter } from "lucide-react";

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
 * Plain GET form: the filters live in the URL, so a filtered view can be
 * refreshed or shared, and it works without any client state.
 */
export function FilterBar({
  basePath,
  from,
  to,
  selects = [],
  hidden = {},
}: {
  basePath: string;
  from: string;
  to: string;
  selects?: FilterSelect[];
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form
      method="get"
      action={basePath}
      className="grid grid-cols-2 gap-3 rounded-lg border bg-background p-3 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] lg:items-end"
    >
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <div className="space-y-1">
        <Label htmlFor="filter-desde" className="text-xs text-muted-foreground">
          Desde
        </Label>
        <Input id="filter-desde" type="date" name="desde" defaultValue={from} className="h-10" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-hasta" className="text-xs text-muted-foreground">
          Hasta
        </Label>
        <Input id="filter-hasta" type="date" name="hasta" defaultValue={to} className="h-10" />
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
        <Button type="submit" className="h-10 flex-1">
          <Filter className="size-4" />
          Aplicar
        </Button>
        <Button asChild variant="outline" className="h-10">
          <Link href={basePath}>Limpiar</Link>
        </Button>
      </div>
    </form>
  );
}

/** "Todos" option whose empty value drops the filter from the query. */
export function withAll(label: string, options: Array<{ value: string; label: string }>) {
  return [{ value: "all", label }, ...options];
}
