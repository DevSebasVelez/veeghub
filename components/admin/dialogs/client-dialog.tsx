"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient, updateClient } from "@/lib/admin/actions/clients/actions";
import {
  CreateTrigger,
  DialogSubmitFooter,
  EditTrigger,
} from "@/components/admin/dialogs/_base";
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

type Props = {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  billingEmail: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
};

function ClientFields({ client }: { client?: Props }) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Nombre visible</FieldLabel>
        <Input name="name" defaultValue={client?.name ?? ""} required />
      </Field>
      <Field>
        <FieldLabel>Razón social</FieldLabel>
        <Input name="legalName" defaultValue={client?.legalName ?? ""} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>RUC o cédula</FieldLabel>
          <Input name="taxId" defaultValue={client?.taxId ?? ""} />
        </Field>
        <Field>
          <FieldLabel>Teléfono</FieldLabel>
          <Input name="phone" defaultValue={client?.phone ?? ""} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Email principal</FieldLabel>
          <Input
            name="email"
            type="email"
            defaultValue={client?.email ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel>Email facturación</FieldLabel>
          <Input
            name="billingEmail"
            type="email"
            defaultValue={client?.billingEmail ?? ""}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel>Sitio web</FieldLabel>
        <Input
          name="website"
          type="url"
          defaultValue={client?.website ?? ""}
        />
      </Field>
      <Field>
        <FieldLabel>Dirección</FieldLabel>
        <Textarea
          name="address"
          defaultValue={client?.address ?? ""}
          rows={2}
        />
      </Field>
      <Field>
        <FieldLabel>Notas</FieldLabel>
        <Textarea name="notes" defaultValue={client?.notes ?? ""} rows={3} />
      </Field>
    </FieldGroup>
  );
}

export function ClientEditDialog({ client }: { client: Props }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
      await updateClient(client.id, formData);
      setOpen(false);
      router.refresh();
      toast.success("Cliente actualizado.");
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
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>
            Actualiza contactos, datos fiscales y notas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ClientFields client={client} />
          <DialogSubmitFooter submitLabel="Guardar cambios" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
      await createClient(formData);
      setOpen(false);
      router.refresh();
      toast.success("Cliente creado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <CreateTrigger label="Nuevo cliente" />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Guarda datos comerciales y de envío de facturas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ClientFields />
          <DialogSubmitFooter
            submitLabel="Crear cliente"
            saving={saving}
            savingLabel="Creando..."
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
