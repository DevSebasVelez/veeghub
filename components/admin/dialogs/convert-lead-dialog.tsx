"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

import { convertLeadToClient } from "@/lib/admin/actions/leads/actions";
import { DialogSubmitFooter } from "@/components/admin/dialogs/_base";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export function ConvertLeadDialog({
  lead,
}: {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    serviceTag: string | null;
    estimatedValue: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [withProject, setWithProject] = useState(true);
  const [withReceivable, setWithReceivable] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await convertLeadToClient(lead.id, new FormData(event.currentTarget));
      setOpen(false);
      router.refresh();
      toast.success("Lead convertido en cliente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al convertir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <UserPlus className="size-3.5" />
          Convertir en cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Convertir en cliente</DialogTitle>
          <DialogDescription>
            Crea el cliente y, si quieres, el proyecto y el primer hito de cobro.
            El lead queda marcado como ganado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre del cliente</FieldLabel>
              <Input
                name="clientName"
                defaultValue={lead.company ?? lead.name}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  name="email"
                  type="email"
                  defaultValue={lead.email ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel>Teléfono</FieldLabel>
                <Input name="phone" defaultValue={lead.phone ?? ""} />
              </Field>
            </div>
          </FieldGroup>

          <div className="space-y-3 rounded-lg border p-4">
            {/* Explicit hidden input: Radix's bubble input is an implementation
                detail, and an unchecked box submitting nothing would read as
                undefined rather than false. */}
            <input
              type="hidden"
              name="createProject"
              value={withProject ? "true" : "false"}
            />
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={withProject}
                onCheckedChange={(value) => setWithProject(value === true)}
              />
              Crear proyecto
            </label>

            {withProject ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Nombre del proyecto</FieldLabel>
                  <Input
                    name="projectName"
                    defaultValue={
                      lead.serviceTag
                        ? `${lead.serviceTag} — ${lead.company ?? lead.name}`
                        : (lead.company ?? lead.name)
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Presupuesto (USD)</FieldLabel>
                  <Input
                    name="budget"
                    inputMode="decimal"
                    defaultValue={lead.estimatedValue ?? ""}
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <input
              type="hidden"
              name="createReceivable"
              value={withReceivable ? "true" : "false"}
            />
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={withReceivable}
                onCheckedChange={(value) => setWithReceivable(value === true)}
              />
              Crear primer hito de cobro
            </label>

            {withReceivable ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Concepto</FieldLabel>
                  <Input name="receivableTitle" defaultValue="Anticipo" />
                </Field>
                <Field>
                  <FieldLabel>Monto (USD)</FieldLabel>
                  <Input name="receivableAmount" inputMode="decimal" />
                </Field>
              </div>
            ) : null}
          </div>

          <DialogSubmitFooter
            submitLabel="Convertir"
            saving={saving}
            savingLabel="Convirtiendo..."
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
