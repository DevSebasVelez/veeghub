"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createExpenseCategory,
  updateExpenseCategory,
} from "@/lib/admin/actions/expense-categories/actions";
import {
  CreateTrigger,
  DialogSubmitFooter,
  EditTrigger,
} from "@/components/admin/dialogs/_base";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ExpenseCategoryDialog({
  category,
  mode = "edit",
}: {
  category?: { id: string; name: string; description: string | null };
  mode?: "create" | "edit";
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
      if (category) {
        await updateExpenseCategory(category.id, formData);
      } else {
        await createExpenseCategory(formData);
      }
      setOpen(false);
      router.refresh();
      toast.success("Categoría guardada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <CreateTrigger label="Nueva categoría" />
        ) : (
          <EditTrigger />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva categoría" : "Editar categoría"}
          </DialogTitle>
          <DialogDescription>
            Agrupa egresos para el resumen. Renombrarla no altera los egresos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input name="name" defaultValue={category?.name ?? ""} required />
            </Field>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Textarea
                name="description"
                rows={2}
                defaultValue={category?.description ?? ""}
              />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Guardar" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
