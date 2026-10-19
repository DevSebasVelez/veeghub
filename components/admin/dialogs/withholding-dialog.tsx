"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createWithholding,
  updateWithholding,
} from "@/lib/admin/actions/withholdings/actions";
import {
  CreateTrigger,
  DialogSubmitFooter,
  EditTrigger,
} from "@/components/admin/dialogs/_base";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { FormSelect } from "@/components/admin/form-select";
import {
  WITHHOLDING_KIND_LABELS,
  labelOptions,
} from "@/components/admin/finance/labels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type WithholdingProps = {
  id: string;
  kind: string;
  amount: string;
  percentage: string | null;
  receiptNumber: string | null;
  issueDate: string | null;
  appliesToBalance: boolean;
  notes: string | null;
};

export function WithholdingDialog({
  invoiceId,
  withholding,
  mode = "edit",
}: {
  invoiceId: string;
  withholding?: WithholdingProps;
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
      if (withholding) {
        await updateWithholding(withholding.id, formData);
      } else {
        await createWithholding(invoiceId, formData);
      }
      setOpen(false);
      router.refresh();
      toast.success("Retención guardada.");
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
          <CreateTrigger label="Registrar retención" />
        ) : (
          <EditTrigger />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Registrar retención" : "Editar retención"}
          </DialogTitle>
          <DialogDescription>
            Retención recibida del cliente. Nunca cuenta como dinero cobrado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <FormSelect
                name="kind"
                defaultValue={withholding?.kind ?? "INCOME"}
                options={labelOptions(WITHHOLDING_KIND_LABELS)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Valor retenido</FieldLabel>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={withholding?.amount ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>Porcentaje (%)</FieldLabel>
                <Input
                  name="percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={withholding?.percentage ?? ""}
                  placeholder="Según el comprobante"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>N.º de comprobante</FieldLabel>
                <Input
                  name="receiptNumber"
                  defaultValue={withholding?.receiptNumber ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel>Fecha de emisión</FieldLabel>
                <DatePickerField
                  name="issueDate"
                  defaultValue={withholding?.issueDate}
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="appliesToBalance"
                name="appliesToBalance"
                defaultChecked={withholding?.appliesToBalance ?? true}
              />
              <div className="space-y-1">
                <FieldLabel htmlFor="appliesToBalance">
                  Descontar del saldo del cliente
                </FieldLabel>
                <FieldDescription>
                  Márcalo si el cliente te pagó el total menos esta retención:
                  el hito podrá quedar pagado sin contar la retención como
                  cobro.
                </FieldDescription>
              </div>
            </Field>
            <Field>
              <FieldLabel>Notas</FieldLabel>
              <Textarea name="notes" rows={2} defaultValue={withholding?.notes ?? ""} />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Guardar" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
