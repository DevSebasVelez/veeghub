"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderPlus } from "lucide-react";

import { createFolder, updateFolder } from "@/app/admin/actions";
import {
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
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      await updateFolder(folder.id, formData);
      setOpen(false);
      router.refresh();
      toast.success("Carpeta actualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <EditTrigger />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar carpeta</DialogTitle>
          <DialogDescription>Actualiza nombre y contexto.</DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
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
          <Button type="submit" className="w-full">
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateFolderDialog({
  parentId,
  clients,
  projects,
  defaultClientId,
  defaultProjectId,
}: {
  parentId: string | null;
  clients: EntityOption[];
  projects: EntityOption[];
  defaultClientId?: string | null;
  defaultProjectId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      await createFolder(formData);
      setOpen(false);
      router.refresh();
      toast.success("Carpeta creada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva carpeta</DialogTitle>
          <DialogDescription>
            Organiza por cliente, proyecto o tema.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <FieldGroup>
            <input type="hidden" name="parentId" value={parentId ?? "none"} />
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input name="name" required autoFocus />
            </Field>
            <Field>
              <FieldLabel>Cliente</FieldLabel>
              <FormSelect
                name="clientId"
                defaultValue={defaultClientId ?? "none"}
                options={relationOptions(clients, "General")}
              />
            </Field>
            <Field>
              <FieldLabel>Proyecto</FieldLabel>
              <FormSelect
                name="projectId"
                defaultValue={defaultProjectId ?? "none"}
                options={relationOptions(projects, "Sin proyecto")}
              />
            </Field>
          </FieldGroup>
          <Button type="submit" className="w-full">
            Crear carpeta
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
