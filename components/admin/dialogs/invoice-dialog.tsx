"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateInvoice } from "@/app/admin/actions";
import {
  EditTrigger,
  relationOptions,
  type EntityOption,
} from "@/components/admin/dialogs/_base";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { FormSelect } from "@/components/admin/form-select";
import { Button } from "@/components/ui/button";
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

const statusOptions = [
  { value: "READY_TO_SEND", label: "Por enviar" },
  { value: "SENT", label: "Enviada" },
  { value: "PAID", label: "Pagada" },
  { value: "CANCELLED", label: "Cancelada" },
];

type InvoiceProps = {
  id: string;
  clientId: string;
  projectId: string | null;
  receivableId: string | null;
  invoiceNumber: string | null;
  accessKey: string | null;
  subtotal: string | null;
  taxAmount: string | null;
  total: string;
  issueDate: string | null;
  status: string;
};

export function InvoiceEditDialog({
  invoice,
  clients,
  projects,
  receivables,
}: {
  invoice: InvoiceProps;
  clients: EntityOption[];
  projects: EntityOption[];
  receivables: EntityOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      await updateInvoice(invoice.id, formData);
      setOpen(false);
      router.refresh();
      toast.success("Factura actualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <EditTrigger />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar factura</DialogTitle>
          <DialogDescription>
            Ajusta metadata y estado de envío/pago.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Cliente</FieldLabel>
              <FormSelect
                name="clientId"
                defaultValue={invoice.clientId}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
            <Field>
              <FieldLabel>Proyecto</FieldLabel>
              <FormSelect
                name="projectId"
                defaultValue={invoice.projectId ?? "none"}
                options={relationOptions(projects, "Sin proyecto")}
              />
            </Field>
            <Field>
              <FieldLabel>Hito relacionado</FieldLabel>
              <FormSelect
                name="receivableId"
                defaultValue={invoice.receivableId ?? "none"}
                options={relationOptions(receivables, "Sin hito")}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Número</FieldLabel>
                <Input
                  name="invoiceNumber"
                  defaultValue={invoice.invoiceNumber ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel>Fecha emisión</FieldLabel>
                <DatePickerField
                  name="issueDate"
                  defaultValue={invoice.issueDate}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Clave de acceso</FieldLabel>
              <Input name="accessKey" defaultValue={invoice.accessKey ?? ""} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel>Subtotal</FieldLabel>
                <Input
                  name="subtotal"
                  type="number"
                  step="0.01"
                  defaultValue={invoice.subtotal ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel>IVA</FieldLabel>
                <Input
                  name="taxAmount"
                  type="number"
                  step="0.01"
                  defaultValue={invoice.taxAmount ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel>Total</FieldLabel>
                <Input
                  name="total"
                  type="number"
                  step="0.01"
                  defaultValue={invoice.total}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Estado</FieldLabel>
              <FormSelect
                name="status"
                defaultValue={invoice.status}
                options={statusOptions}
              />
            </Field>
          </FieldGroup>
          <Button type="submit" className="w-full">
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
