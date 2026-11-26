"use client";

import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

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

export function CreateTrigger({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label?: string }) {
  return (
    // 40 px on phones: it's the main action of most admin pages.
    <Button type="button" size="sm" {...props} className={cn("max-sm:h-10 max-sm:px-4", props.className)}>
      <Plus className="size-3.5" />
      {label}
    </Button>
  );
}

export function DialogSubmitFooter({
  submitLabel,
  saving = false,
  savingLabel = "Guardando...",
  disabled = false,
}: {
  submitLabel: string;
  saving?: boolean;
  savingLabel?: string;
  disabled?: boolean;
}) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline" disabled={saving}>
          Cancelar
        </Button>
      </DialogClose>
      <Button type="submit" disabled={disabled || saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {saving ? savingLabel : submitLabel}
      </Button>
    </DialogFooter>
  );
}
