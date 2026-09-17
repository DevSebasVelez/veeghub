"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createLead, updateLead } from "@/lib/admin/actions/leads/actions";
import {
  CreateTrigger,
  DialogSubmitFooter,
  EditTrigger,
} from "@/components/admin/dialogs/_base";
import {
  SOURCE_LABELS,
  STAGE_LABELS,
} from "@/components/admin/leads/constants";
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
import { FormSelect } from "@/components/admin/form-select";

type LeadFormValues = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  stage: string;
  source: string;
  serviceTag: string | null;
  estimatedValue: string | null;
  notes: string | null;
  lostReason: string | null;
};

const stageOptions = Object.entries(STAGE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const sourceOptions = Object.entries(SOURCE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function LeadFields({ lead }: { lead?: LeadFormValues }) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Nombre</FieldLabel>
        <Input name="name" defaultValue={lead?.name ?? ""} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Teléfono</FieldLabel>
          <Input
            name="phone"
            defaultValue={lead?.phone ?? ""}
            placeholder="+593 99 123 4567"
          />
        </Field>
        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input name="email" type="email" defaultValue={lead?.email ?? ""} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Empresa</FieldLabel>
          <Input name="company" defaultValue={lead?.company ?? ""} />
        </Field>
        <Field>
          <FieldLabel>Servicio de interés</FieldLabel>
          <Input
            name="serviceTag"
            defaultValue={lead?.serviceTag ?? ""}
            placeholder="Página web, App, Ecommerce..."
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Etapa</FieldLabel>
          <FormSelect
            name="stage"
            defaultValue={lead?.stage ?? "NEW"}
            options={stageOptions}
          />
        </Field>
        <Field>
          <FieldLabel>Origen</FieldLabel>
          <FormSelect
            name="source"
            defaultValue={lead?.source ?? "MANUAL"}
            options={sourceOptions}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Valor estimado (USD)</FieldLabel>
          <Input
            name="estimatedValue"
            inputMode="decimal"
            defaultValue={lead?.estimatedValue ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel>Próximo seguimiento</FieldLabel>
          <Input name="nextFollowUpAt" type="date" />
        </Field>
      </div>
      <Field>
        <FieldLabel>Qué necesita</FieldLabel>
        <Textarea name="message" defaultValue={lead?.message ?? ""} rows={3} />
      </Field>
      <Field>
        <FieldLabel>Notas internas</FieldLabel>
        <Textarea name="notes" defaultValue={lead?.notes ?? ""} rows={2} />
      </Field>
      {lead?.stage === "LOST" ? (
        <Field>
          <FieldLabel>Motivo de pérdida</FieldLabel>
          <Input name="lostReason" defaultValue={lead?.lostReason ?? ""} />
        </Field>
      ) : null}
    </FieldGroup>
  );
}

export function CreateLeadDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await createLead(new FormData(event.currentTarget));
      setOpen(false);
      router.refresh();
      toast.success("Lead creado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <CreateTrigger label="Nuevo lead" />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
          <DialogDescription>
            Para leads que no vienen de una campaña: referidos, WhatsApp o
            llamadas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <LeadFields />
          <DialogSubmitFooter
            submitLabel="Crear lead"
            saving={saving}
            savingLabel="Creando..."
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LeadEditDialog({ lead }: { lead: LeadFormValues }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await updateLead(lead.id, new FormData(event.currentTarget));
      setOpen(false);
      router.refresh();
      toast.success("Lead actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <EditTrigger />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar lead</DialogTitle>
          <DialogDescription>
            Actualiza los datos y el seguimiento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <LeadFields lead={lead} />
          <DialogSubmitFooter submitLabel="Guardar cambios" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
