"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EntityOption = { id: string; name: string };
export type DialogOption = { value: string; label: string };

export function relationOptions(
  items: EntityOption[],
  emptyLabel: string,
): DialogOption[] {
  return [
    { value: "none", label: emptyLabel },
    ...items.map((item) => ({ value: item.id, label: item.name })),
  ];
}

export function EditTrigger({
  label = "Editar",
  ...props
}: React.ComponentProps<typeof Button> & { label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" {...props}>
      <Pencil className="size-3.5" />
      {label}
    </Button>
  );
}
