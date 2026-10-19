"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createPayee, updatePayee } from "@/lib/admin/actions/payees/actions";
import { unwrap } from "@/lib/admin/actions/types";
import {
  CreateTrigger,
  DialogSubmitFooter,
  EditTrigger,
} from "@/components/admin/dialogs/_base";
import { FormSelect } from "@/components/admin/form-select";
import { PAYEE_KIND_LABELS, labelOptions } from "@/components/admin/finance/labels";
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

type PayeeProps = {
  id: string;
  name: string;
  kind: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export function PayeeDialog({
  payee,
  mode = "edit",
}: {
  payee?: PayeeProps;
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
      if (payee) {
        unwrap(await updatePayee(payee.id, formData));
      } else {
        unwrap(await createPayee(formData));
      }
      setOpen(false);
      router.refresh();
      toast.success("Beneficiario guardado.");
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
          <CreateTrigger label="Nuevo beneficiario" />
        ) : (
          <EditTrigger />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo beneficiario" : "Editar beneficiario"}
          </DialogTitle>
          <DialogDescription>
            Persona o proveedor que recibe pagos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input name="name" defaultValue={payee?.name ?? ""} required />
            </Field>
            <Field>
              <FieldLabel>Clasificación habitual</FieldLabel>
              <FormSelect
                name="kind"
                defaultValue={payee?.kind ?? "OTHER"}
                options={labelOptions(PAYEE_KIND_LABELS)}
              />
              <FieldDescription>
                Solo se sugiere al registrar un pago; cada pago guarda su propia
                clasificación según la documentación disponible.
              </FieldDescription>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>RUC / Cédula</FieldLabel>
                <Input name="taxId" defaultValue={payee?.taxId ?? ""} />
              </Field>
              <Field>
                <FieldLabel>Teléfono</FieldLabel>
                <Input name="phone" defaultValue={payee?.phone ?? ""} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input name="email" type="email" defaultValue={payee?.email ?? ""} />
            </Field>
            <Field>
              <FieldLabel>Notas</FieldLabel>
              <Textarea name="notes" rows={2} defaultValue={payee?.notes ?? ""} />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Guardar" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
