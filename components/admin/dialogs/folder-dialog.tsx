"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderPlus } from "lucide-react";

import { createFolder, updateFolder } from "@/lib/admin/actions/drive/actions";
import {
  DialogSubmitFooter,
  EditTrigger,
  relationOptions,
  type EntityOption,
} from "@/components/admin/dialogs/_base";
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

type FolderProps = {
  id: string;
  name: string;
  parentId: string | null;
  clientId: string | null;
  projectId: string | null;
};

export function FolderEditDialog({
  folder,
  clients,
  projects,
}: {
  folder: FolderProps;
  clients: EntityOption[];
  projects: EntityOption[];
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
      await updateFolder(folder.id, formData);
      setOpen(false);
      router.refresh();
      toast.success("Carpeta actualizada.");
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar carpeta</DialogTitle>
          <DialogDescription>Actualiza nombre y contexto.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <input
              type="hidden"
              name="parentId"
              value={folder.parentId ?? "none"}
            />
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input name="name" defaultValue={folder.name} required />
            </Field>
            <Field>
              <FieldLabel>Cliente</FieldLabel>
              <FormSelect
                name="clientId"
                defaultValue={folder.clientId ?? "none"}
                options={relationOptions(clients, "General")}
              />
            </Field>
            <Field>
              <FieldLabel>Proyecto</FieldLabel>
              <FormSelect
                name="projectId"
                defaultValue={folder.projectId ?? "none"}
                options={relationOptions(projects, "Sin proyecto")}
              />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Guardar" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateFolderDialog({
  parentId,
  clientId,
  projectId,
}: {
  parentId: string | null;
  clientId?: string | null;
  projectId?: string | null;
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
      await createFolder(formData);
      setOpen(false);
      router.refresh();
      toast.success("Carpeta creada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus className="size-4" />
          Nueva carpeta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva carpeta</DialogTitle>
          <DialogDescription>
            Ingresa el nombre de la carpeta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="parentId" value={parentId ?? "none"} />
          {clientId ? (
            <input type="hidden" name="clientId" value={clientId} />
          ) : null}
          {projectId ? (
            <input type="hidden" name="projectId" value={projectId} />
          ) : null}
          <Input
            name="name"
            required
            autoFocus
            placeholder="Nombre de la carpeta"
          />
          <DialogSubmitFooter
            submitLabel="Crear carpeta"
            saving={saving}
            savingLabel="Creando..."
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
