"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createRecurringExpense,
  updateRecurringExpense,
} from "@/lib/admin/actions/recurring-expenses/actions";
import { unwrap } from "@/lib/admin/actions/types";
import {
  CreateTrigger,
  DialogSubmitFooter,
  EditTrigger,
  relationOptions,
  type EntityOption,
} from "@/components/admin/dialogs/_base";
import type {
  ExpenseCategoryOption,
  PayeeOption,
} from "@/components/admin/dialogs/expense-dialog";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { FormSelect } from "@/components/admin/form-select";
import {
  FREQUENCY_LABELS,
  PAYEE_KIND_LABELS,
  TAX_TREATMENT_LABELS,
  labelOptions,
} from "@/components/admin/finance/labels";
import type { RecurringExpenseDTO } from "@/lib/admin/serialize";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function RecurringExpenseDialog({
  template,
  categories,
  payees,
  projects,
  mode = "edit",
}: {
  template?: RecurringExpenseDTO;
  categories: ExpenseCategoryOption[];
  payees: PayeeOption[];
  projects: EntityOption[];
  mode?: "create" | "edit";
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const categoryOptions = categories.filter(
    (c) => !c.archived || c.id === template?.categoryId,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
      if (template) {
        unwrap(await updateRecurringExpense(template.id, formData));
      } else {
        unwrap(await createRecurringExpense(formData));
      }
      setOpen(false);
      router.refresh();
      toast.success("Plantilla guardada.");
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
          <CreateTrigger label="Nueva plantilla" />
        ) : (
          <EditTrigger />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Nuevo egreso recurrente"
              : "Editar egreso recurrente"}
          </DialogTitle>
          <DialogDescription>
            Plantilla para gastos que se repiten. Los egresos pendientes solo
            se crean cuando pulsas &quot;Generar pendientes&quot;. Cambiarla no
            altera los ya generados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Concepto</FieldLabel>
              <Input
                name="description"
                defaultValue={template?.description ?? ""}
                placeholder="Ej. Hosting VPS, licencia de diseño..."
                required
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel>Importe</FieldLabel>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={template?.amount ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>IVA del comprobante</FieldLabel>
                <Input
                  name="taxAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={template?.taxAmount ?? ""}
                  placeholder="Opcional"
                />
              </Field>
              <Field>
                <FieldLabel>Método de pago</FieldLabel>
                <Input
                  name="method"
                  defaultValue={template?.method ?? ""}
                  placeholder="Tarjeta, débito..."
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Frecuencia</FieldLabel>
                <FormSelect
                  name="frequency"
                  defaultValue={template?.frequency ?? "MONTHLY"}
                  options={labelOptions(FREQUENCY_LABELS)}
                />
              </Field>
              <Field>
                <FieldLabel>Día de cobro (1–28)</FieldLabel>
                <Input
                  name="dayOfMonth"
                  type="number"
                  min="1"
                  max="28"
                  step="1"
                  defaultValue={template?.dayOfMonth ?? 1}
                  required
                />
                <FieldDescription>
                  En plantillas anuales, el mes es el de la fecha de inicio.
                </FieldDescription>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Desde</FieldLabel>
                <DatePickerField
                  name="startDate"
                  defaultValue={template?.startDate}
                />
              </Field>
              <Field>
                <FieldLabel>Hasta</FieldLabel>
                <DatePickerField name="endDate" defaultValue={template?.endDate} />
                <FieldDescription>Vacío si no tiene fin.</FieldDescription>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Categoría</FieldLabel>
                <FormSelect
                  name="categoryId"
                  defaultValue={template?.categoryId ?? "none"}
                  options={relationOptions(categoryOptions, "Sin categoría")}
                />
              </Field>
              <Field>
                <FieldLabel>Proyecto</FieldLabel>
                <FormSelect
                  name="projectId"
                  defaultValue={template?.projectId ?? "none"}
                  options={relationOptions(projects, "Sin proyecto")}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Beneficiario o proveedor</FieldLabel>
                <FormSelect
                  name="payeeId"
                  defaultValue={template?.payeeId ?? "none"}
                  options={relationOptions(payees, "Sin beneficiario")}
                />
              </Field>
              <Field>
                <FieldLabel>Clasificación del pago</FieldLabel>
                <FormSelect
                  name="payeeKind"
                  defaultValue={template?.payeeKind ?? "none"}
                  options={[
                    { value: "none", label: "Sin clasificar" },
                    ...labelOptions(PAYEE_KIND_LABELS),
                  ]}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Tratamiento tributario</FieldLabel>
              <FormSelect
                name="taxTreatment"
                defaultValue={template?.taxTreatment ?? "UNCLASSIFIED"}
                options={labelOptions(TAX_TREATMENT_LABELS)}
              />
            </Field>

            <Field>
              <FieldLabel>Observaciones</FieldLabel>
              <Textarea
                name="notes"
                rows={2}
                defaultValue={template?.notes ?? ""}
              />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Guardar" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
