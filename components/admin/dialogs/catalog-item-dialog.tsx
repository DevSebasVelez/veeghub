"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createCatalogItem, updateCatalogItem } from "@/lib/admin/actions/catalog/actions";
import { unwrap } from "@/lib/admin/actions/types";
import { CreateTrigger, DialogSubmitFooter, EditTrigger } from "@/components/admin/dialogs/_base";
import { FormSelect } from "@/components/admin/form-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type CatalogItemProps = {
  id: string;
  code: string | null;
  name: string;
  unitPrice: string;
  vatCode: string | null;
  notes: string | null;
};

const DEFAULT_VAT = "default";

export function CatalogItemDialog({
  item,
  vatOptions,
  mode = "edit",
}: {
  item?: CatalogItemProps;
  /** IVA choices of the profile in force. */
  vatOptions: Array<{ code: string; label: string }>;
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
      if (formData.get("vatCode") === DEFAULT_VAT) formData.set("vatCode", "");
      unwrap(item ? await updateCatalogItem(item.id, formData) : await createCatalogItem(formData));
      setOpen(false);
      router.refresh();
      toast.success(item ? "Producto actualizado." : "Producto agregado al catálogo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? <CreateTrigger label="Nuevo producto" /> : <EditTrigger label="" aria-label="Editar" />}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nuevo producto o servicio" : "Editar producto o servicio"}</DialogTitle>
          <DialogDescription>
            Se copia a la factura al elegirlo. Cambiarlo aquí no toca las facturas ya emitidas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Input name="name" defaultValue={item?.name ?? ""} required maxLength={300} placeholder="Desarrollo de sitio web" />
              <FieldDescription>Así aparece en la factura y en el RIDE.</FieldDescription>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Código</FieldLabel>
                <Input name="code" defaultValue={item?.code ?? ""} maxLength={25} placeholder="WEB-01" />
              </Field>
              <Field>
                <FieldLabel>Precio unitario (USD)</FieldLabel>
                <Input
                  name="unitPrice"
                  inputMode="decimal"
                  defaultValue={item?.unitPrice ?? ""}
                  required
                  placeholder="0.00"
                  className="tabular-nums"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>IVA</FieldLabel>
              <FormSelect
                name="vatCode"
                defaultValue={item?.vatCode ?? DEFAULT_VAT}
                options={[
                  { value: DEFAULT_VAT, label: "La tarifa vigente al facturar" },
                  ...vatOptions.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
            </Field>
            <Field>
              <FieldLabel>Notas</FieldLabel>
              <Textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Guardar" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
