"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { createInvoice, updateInvoice } from "@/app/admin/actions";
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
  hasXml?: boolean;
  hasRide?: boolean;
};

function InvoiceFields({
  invoice,
  clients,
  projects,
  receivables,
  isEdit,
}: {
  invoice?: InvoiceProps;
  clients: EntityOption[];
  projects: EntityOption[];
  receivables: EntityOption[];
  isEdit: boolean;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Cliente</FieldLabel>
        <FormSelect
          name="clientId"
          defaultValue={invoice?.clientId ?? clients[0]?.id}
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Field>
      <Field>
        <FieldLabel>Proyecto</FieldLabel>
        <FormSelect
          name="projectId"
          defaultValue={invoice?.projectId ?? "none"}
          options={relationOptions(projects, "Sin proyecto")}
        />
      </Field>
      <Field>
        <FieldLabel>Hito relacionado</FieldLabel>
        <FormSelect
          name="receivableId"
          defaultValue={invoice?.receivableId ?? "none"}
          options={relationOptions(receivables, "Sin hito")}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Número de factura</FieldLabel>
          <Input
            name="invoiceNumber"
            defaultValue={invoice?.invoiceNumber ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel>Fecha de emisión</FieldLabel>
          <DatePickerField name="issueDate" defaultValue={invoice?.issueDate} />
        </Field>
      </div>
      <Field>
        <FieldLabel>Clave de acceso SRI</FieldLabel>
        <Input name="accessKey" defaultValue={invoice?.accessKey ?? ""} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel>Subtotal</FieldLabel>
          <Input
            name="subtotal"
            type="number"
            step="0.01"
            defaultValue={invoice?.subtotal ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel>IVA</FieldLabel>
          <Input
            name="taxAmount"
            type="number"
            step="0.01"
            defaultValue={invoice?.taxAmount ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel>Total</FieldLabel>
          <Input
            name="total"
            type="number"
            step="0.01"
            defaultValue={invoice?.total ?? ""}
            required
          />
        </Field>
      </div>
      {isEdit && (
        <Field>
          <FieldLabel>Estado</FieldLabel>
          <FormSelect
            name="status"
            defaultValue={invoice?.status ?? "READY_TO_SEND"}
            options={statusOptions}
          />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>
            XML autorizado
            {invoice?.hasXml ? (
              <span className="ml-2 text-xs font-normal text-emerald-600">
                ✓ subido
              </span>
            ) : null}
          </FieldLabel>
          <Input
            name="xml"
            type="file"
            accept=".xml,text/xml,application/xml"
          />
          {isEdit && invoice?.hasXml ? (
            <p className="text-xs text-muted-foreground">
              Dejar vacío para conservar el actual
            </p>
          ) : null}
        </Field>
        <Field>
          <FieldLabel>
            RIDE PDF
            {invoice?.hasRide ? (
              <span className="ml-2 text-xs font-normal text-blue-600">
                ✓ subido
              </span>
            ) : null}
          </FieldLabel>
          <Input name="ride" type="file" accept=".pdf,application/pdf" />
          {isEdit && invoice?.hasRide ? (
            <p className="text-xs text-muted-foreground">
              Dejar vacío para conservar el actual
            </p>
          ) : null}
        </Field>
      </div>
      {!isEdit && <input type="hidden" name="status" value="READY_TO_SEND" />}
    </FieldGroup>
  );
}

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
            Ajusta metadata, estado y reemplaza archivos XML/RIDE.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <InvoiceFields
            invoice={invoice}
            clients={clients}
            projects={projects}
            receivables={receivables}
            isEdit
          />
          <Button type="submit" className="w-full">
            Guardar cambios
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateInvoiceDialog({
  clients,
  projects,
  receivables,
}: {
  clients: EntityOption[];
  projects: EntityOption[];
  receivables: EntityOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      await createInvoice(formData);
      setOpen(false);
      router.refresh();
      toast.success("Factura registrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Nueva factura
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar factura</DialogTitle>
          <DialogDescription>
            Adjunta el XML autorizado y el RIDE PDF del Facturador SRI.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <InvoiceFields
            clients={clients}
            projects={projects}
            receivables={receivables}
            isEdit={false}
          />
          <Button type="submit" disabled={!clients.length} className="w-full">
            Registrar factura
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
