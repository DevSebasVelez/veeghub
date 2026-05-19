"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createReceivable,
  recordPayment,
  updatePayment,
  updateReceivable,
} from "@/app/admin/actions";
import {
  EditTrigger,
  relationOptions,
  type EntityOption,
} from "@/components/admin/dialogs/_base";
import { Pencil } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

const statusOptions = [
  { value: "PLANNED", label: "Planificado" },
  { value: "INVOICED", label: "Facturado" },
  { value: "PARTIALLY_PAID", label: "Pago parcial" },
  { value: "PAID", label: "Pagado" },
  { value: "OVERDUE", label: "Vencido" },
  { value: "CANCELLED", label: "Cancelado" },
];

type ReceivableProps = {
  id: string;
  clientId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  amount: string;
  dueDate: string | null;
  status: string;
};

export function ReceivableDialog({
  receivable,
  clients,
  projects,
  mode = "edit",
  fixedClientId,
  fixedProjectId,
}: {
  receivable?: ReceivableProps;
  clients: EntityOption[];
  projects: EntityOption[];
  mode?: "create" | "edit";
  fixedClientId?: string;
  fixedProjectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      if (receivable) {
        await updateReceivable(receivable.id, formData);
      } else {
        await createReceivable(formData);
      }
      setOpen(false);
      router.refresh();
      toast.success("Hito guardado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <EditTrigger label={mode === "create" ? "Nuevo hito" : "Editar"} />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo hito de cobro" : "Editar hito"}
          </DialogTitle>
          <DialogDescription>
            Gestiona entradas, avances y pagos finales.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <FieldGroup>
            {fixedClientId ? (
              <input type="hidden" name="clientId" value={fixedClientId} />
            ) : (
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <FormSelect
                  name="clientId"
                  defaultValue={receivable?.clientId ?? clients[0]?.id}
                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
            )}
            {fixedProjectId ? (
              <input type="hidden" name="projectId" value={fixedProjectId} />
            ) : (
              <Field>
                <FieldLabel>Proyecto</FieldLabel>
                <FormSelect
                  name="projectId"
                  defaultValue={receivable?.projectId ?? "none"}
                  options={relationOptions(projects, "Sin proyecto")}
                />
              </Field>
            )}
            <Field>
              <FieldLabel>Concepto</FieldLabel>
              <Input
                name="title"
                defaultValue={receivable?.title ?? ""}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Monto</FieldLabel>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={receivable?.amount ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>Fecha esperada</FieldLabel>
                <DatePickerField
                  name="dueDate"
                  defaultValue={receivable?.dueDate}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Estado</FieldLabel>
              <FormSelect
                name="status"
                defaultValue={receivable?.status ?? "PLANNED"}
                options={statusOptions}
              />
            </Field>
            <Field>
              <FieldLabel>Notas</FieldLabel>
              <Textarea
                name="description"
                rows={3}
                defaultValue={receivable?.description ?? ""}
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

export function SinglePaymentDialog({
  receivable,
}: {
  receivable: { id: string; title: string; amount: string; remaining: string };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      await recordPayment(formData);
      setOpen(false);
      router.refresh();
      toast.success("Pago registrado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
          Cobrar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription className="truncate">
            {receivable.title} · pendiente {receivable.remaining}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <input type="hidden" name="receivableId" value={receivable.id} />
          <FieldGroup>
            <Field>
              <FieldLabel>Monto</FieldLabel>
              <Input
                name="amount"
                type="number"
                step="0.01"
                placeholder={receivable.remaining}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Fecha</FieldLabel>
              <DatePickerField name="paidAt" />
            </Field>
            <Field>
              <FieldLabel>Método</FieldLabel>
              <Input name="method" placeholder="Transferencia, efectivo..." />
            </Field>
            <Field>
              <FieldLabel>Referencia</FieldLabel>
              <Input name="reference" />
            </Field>
          </FieldGroup>
          <Button type="submit" className="w-full">
            Guardar pago
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditPaymentDialog({
  payment,
}: {
  payment: {
    id: string;
    amount: string;
    paidAt: string;
    method: string | null;
    reference: string | null;
    notes: string | null;
    receivableTitle: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      await updatePayment(payment.id, formData);
      setOpen(false);
      router.refresh();
      toast.success("Pago actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="size-7 p-0">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar pago</DialogTitle>
          <DialogDescription className="truncate">
            {payment.receivableTitle}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Monto</FieldLabel>
              <Input
                name="amount"
                type="number"
                step="0.01"
                defaultValue={payment.amount}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Fecha</FieldLabel>
              <DatePickerField name="paidAt" defaultValue={payment.paidAt} />
            </Field>
            <Field>
              <FieldLabel>Método</FieldLabel>
              <Input
                name="method"
                defaultValue={payment.method ?? ""}
                placeholder="Transferencia, efectivo..."
              />
            </Field>
            <Field>
              <FieldLabel>Referencia</FieldLabel>
              <Input name="reference" defaultValue={payment.reference ?? ""} />
            </Field>
          </FieldGroup>
          <Button type="submit" className="w-full">
            Guardar cambios
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentDialog({
  receivables,
}: {
  receivables: Array<{ id: string; title: string; client: { name: string } }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      await recordPayment(formData);
      setOpen(false);
      router.refresh();
      toast.success("Pago registrado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Registrar pago</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Permite pagos parciales o completos por hito.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Hito</FieldLabel>
              <FormSelect
                name="receivableId"
                defaultValue={receivables[0]?.id}
                options={receivables.map((r) => ({
                  value: r.id,
                  label: `${r.title} · ${r.client.name}`,
                }))}
              />
            </Field>
            <Field>
              <FieldLabel>Monto pagado</FieldLabel>
              <Input name="amount" type="number" step="0.01" required />
            </Field>
            <Field>
              <FieldLabel>Fecha</FieldLabel>
              <DatePickerField name="paidAt" />
            </Field>
            <Field>
              <FieldLabel>Método</FieldLabel>
              <Input name="method" placeholder="Transferencia, efectivo..." />
            </Field>
            <Field>
              <FieldLabel>Referencia</FieldLabel>
              <Input name="reference" />
            </Field>
          </FieldGroup>
          <Button type="submit" className="w-full">
            Guardar pago
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
