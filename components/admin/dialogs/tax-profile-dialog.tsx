"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createTaxProfile,
  updateTaxProfile,
} from "@/lib/admin/actions/tax-profiles/actions";
import { unwrap } from "@/lib/admin/actions/types";
import {
  CreateTrigger,
  DialogSubmitFooter,
  EditTrigger,
} from "@/components/admin/dialogs/_base";
import { DatePickerField } from "@/components/admin/date-picker-field";
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

type TaxProfileProps = {
  id: string;
  regime: string;
  validFrom: string;
  validTo: string | null;
  vatRates: string[];
  lastVerifiedAt: string | null;
  notes: string | null;
};

export function TaxProfileDialog({
  profile,
  mode = "edit",
}: {
  profile?: TaxProfileProps;
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
      if (profile) {
        unwrap(await updateTaxProfile(profile.id, formData));
      } else {
        unwrap(await createTaxProfile(formData));
      }
      setOpen(false);
      router.refresh();
      toast.success("Configuración tributaria guardada.");
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
          <CreateTrigger label="Nueva vigencia" />
        ) : (
          <EditTrigger />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Nueva configuración tributaria"
              : "Editar configuración tributaria"}
          </DialogTitle>
          <DialogDescription>
            Referencia administrativa tomada de tu RUC. Las facturas ya
            registradas conservan la tarifa con la que se emitieron.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Régimen</FieldLabel>
              <Input
                name="regime"
                defaultValue={profile?.regime ?? ""}
                placeholder="Tal como figura en tu RUC"
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Vigente desde</FieldLabel>
                <DatePickerField name="validFrom" defaultValue={profile?.validFrom} />
              </Field>
              <Field>
                <FieldLabel>Vigente hasta</FieldLabel>
                <DatePickerField name="validTo" defaultValue={profile?.validTo} />
                <FieldDescription>Vacío si sigue vigente.</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel>Tarifas de IVA aplicables (%)</FieldLabel>
              <Input
                name="vatRates"
                defaultValue={profile?.vatRates.join(", ") ?? ""}
                placeholder="Separadas por coma"
              />
              <FieldDescription>
                Las que pueden corresponder a tus actividades. Cada factura
                registra la tarifa que realmente aplica.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Última verificación</FieldLabel>
              <DatePickerField
                name="lastVerifiedAt"
                defaultValue={profile?.lastVerifiedAt}
              />
            </Field>
            <Field>
              <FieldLabel>Notas</FieldLabel>
              <Textarea
                name="notes"
                rows={3}
                defaultValue={profile?.notes ?? ""}
                placeholder="Actividades económicas, obligaciones, fuente consultada..."
              />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Guardar" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
