"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

import {
  createExpense,
  markExpensePaid,
  updateExpense,
} from "@/lib/admin/actions/expenses/actions";
import {
  CreateTrigger,
  DialogSubmitFooter,
  EditTrigger,
  relationOptions,
  type EntityOption,
} from "@/components/admin/dialogs/_base";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { FormSelect } from "@/components/admin/form-select";
import {
  InvoiceFileUploader,
  type UploadedFile,
} from "@/components/admin/invoice-file-uploader";
import {
  EXPENSE_STATUS_LABELS,
  PAYEE_KIND_LABELS,
  TAX_TREATMENT_LABELS,
  labelOptions,
} from "@/components/admin/finance/labels";
import type { ExpenseDTO } from "@/lib/admin/serialize";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Today as the browser sees it (the business timezone in practice), in the
// UTC-midnight form DatePickerField reads for calendar dates.
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T00:00:00.000Z`;
}

export type ExpenseCategoryOption = { id: string; name: string; archived: boolean };
export type PayeeOption = { id: string; name: string; kind: string };

export function ExpenseDialog({
  expense,
  categories,
  payees,
  projects,
  mode = "edit",
  fixedProjectId,
  defaultPayeeKind,
  triggerLabel,
}: {
  expense?: ExpenseDTO;
  categories: ExpenseCategoryOption[];
  payees: PayeeOption[];
  projects: EntityOption[];
  mode?: "create" | "edit";
  fixedProjectId?: string;
  /** Pre-selects a classification, e.g. when opened as "Pago a persona". */
  defaultPayeeKind?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [receipt, setReceipt] = useState<UploadedFile | null>(null);
  const [status, setStatus] = useState(expense?.status ?? "PENDING");
  const [payeeId, setPayeeId] = useState(expense?.payeeId ?? "none");
  const [payeeKind, setPayeeKind] = useState(
    expense?.payeeKind ?? defaultPayeeKind ?? "none",
  );
  const router = useRouter();

  // Archived categories stay selectable only for the expense already using one.
  const categoryOptions = categories.filter(
    (c) => !c.archived || c.id === expense?.categoryId,
  );

  function handlePayeeChange(value: string) {
    setPayeeId(value);
    // Suggest the payee's usual classification; it remains editable.
    const payee = payees.find((p) => p.id === value);
    if (payee && (payeeKind === "none" || !expense)) setPayeeKind(payee.kind);
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setReceipt(null);
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (uploading) {
      toast.error("Espera a que termine la subida del comprobante.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
      if (receipt) {
        formData.set("receiptObjectKey", receipt.objectKey);
        formData.set("receiptName", receipt.name);
        formData.set("receiptMimeType", receipt.mimeType);
        formData.set("receiptSize", String(receipt.size));
      }
      if (expense) {
        await updateExpense(expense.id, formData);
      } else {
        await createExpense(formData);
      }
      setOpen(false);
      setReceipt(null);
      router.refresh();
      toast.success("Egreso guardado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <CreateTrigger label={triggerLabel ?? "Nuevo egreso"} />
        ) : (
          <EditTrigger />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Registrar egreso" : "Editar egreso"}
          </DialogTitle>
          <DialogDescription>
            Gastos del negocio y pagos a personas. Se registra solo lo que
            ingreses.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="payeeId" value={payeeId} />
          <input type="hidden" name="payeeKind" value={payeeKind} />
          <FieldGroup>
            <Field>
              <FieldLabel>Concepto</FieldLabel>
              <Input
                name="description"
                defaultValue={expense?.description ?? ""}
                placeholder="Ej. Licencia anual, diseño de logo..."
                required
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Categoría</FieldLabel>
                <FormSelect
                  name="categoryId"
                  defaultValue={expense?.categoryId ?? "none"}
                  options={relationOptions(categoryOptions, "Sin categoría")}
                />
              </Field>
              {fixedProjectId ? (
                <input type="hidden" name="projectId" value={fixedProjectId} />
              ) : (
                <Field>
                  <FieldLabel>Proyecto</FieldLabel>
                  <FormSelect
                    name="projectId"
                    defaultValue={expense?.projectId ?? "none"}
                    options={relationOptions(projects, "Sin proyecto")}
                  />
                </Field>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Beneficiario o proveedor</FieldLabel>
                <Select value={payeeId} onValueChange={handlePayeeChange}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin beneficiario</SelectItem>
                    {payees.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Clasificación del pago</FieldLabel>
                <Select value={payeeKind} onValueChange={setPayeeKind}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin clasificar</SelectItem>
                    {labelOptions(PAYEE_KIND_LABELS).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel>Importe total</FieldLabel>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={expense?.amount ?? ""}
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
                  defaultValue={expense?.taxAmount ?? ""}
                  placeholder="Opcional"
                />
              </Field>
              <Field>
                <FieldLabel>Fecha del gasto</FieldLabel>
                <DatePickerField
                  name="expenseDate"
                  defaultValue={expense?.expenseDate ?? todayIso()}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Estado</FieldLabel>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {labelOptions(EXPENSE_STATUS_LABELS).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {status === "PAID" ? (
                <Field>
                  <FieldLabel>Fecha de pago</FieldLabel>
                  <DatePickerField
                    name="paidAt"
                    defaultValue={
                      expense?.paidAt ?? expense?.expenseDate ?? todayIso()
                    }
                  />
                </Field>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Método de pago</FieldLabel>
                <Input
                  name="method"
                  defaultValue={expense?.method ?? ""}
                  placeholder="Transferencia, tarjeta, efectivo..."
                />
              </Field>
              <Field>
                <FieldLabel>Referencia de pago</FieldLabel>
                <Input name="reference" defaultValue={expense?.reference ?? ""} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>N.º de factura o comprobante</FieldLabel>
                <Input
                  name="receiptNumber"
                  defaultValue={expense?.receiptNumber ?? ""}
                  placeholder="Opcional"
                />
              </Field>
              <Field>
                <FieldLabel>Tratamiento tributario</FieldLabel>
                <FormSelect
                  name="taxTreatment"
                  defaultValue={expense?.taxTreatment ?? "UNCLASSIFIED"}
                  options={labelOptions(TAX_TREATMENT_LABELS)}
                />
                <FieldDescription>
                  Clasificación informativa; confírmala con tu contador.
                </FieldDescription>
              </Field>
            </div>

            <InvoiceFileUploader
              label="Comprobante de respaldo"
              accept=".pdf,.xml,image/*,application/pdf,text/xml,application/xml"
              existingName={expense?.receiptFileName}
              onUpload={setReceipt}
              onClear={() => setReceipt(null)}
              onBusy={setUploading}
            />

            <Field>
              <FieldLabel>Observaciones</FieldLabel>
              <Textarea name="notes" rows={2} defaultValue={expense?.notes ?? ""} />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter
            submitLabel="Guardar"
            saving={saving || uploading}
            savingLabel={uploading ? "Subiendo comprobante..." : "Guardando..."}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MarkExpensePaidDialog({
  expense,
}: {
  expense: { id: string; description: string; amount: string; method: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await markExpensePaid(expense.id, new FormData(event.currentTarget));
      setOpen(false);
      router.refresh();
      toast.success("Egreso marcado como pagado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
          <CheckCircle2 className="size-3" />
          Pagar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como pagado</DialogTitle>
          <DialogDescription className="truncate">
            {expense.description} · {expense.amount}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Fecha de pago</FieldLabel>
              <DatePickerField name="paidAt" defaultValue={todayIso()} />
            </Field>
            <Field>
              <FieldLabel>Método</FieldLabel>
              <Input
                name="method"
                defaultValue={expense.method ?? ""}
                placeholder="Transferencia, tarjeta, efectivo..."
              />
            </Field>
            <Field>
              <FieldLabel>Referencia</FieldLabel>
              <Input name="reference" />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Confirmar pago" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
