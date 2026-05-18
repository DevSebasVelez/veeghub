"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateDriveFile } from "@/app/admin/actions";
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

type DriveFileProps = {
  id: string;
  name: string;
  folderId: string | null;
  clientId: string | null;
  projectId: string | null;
};

export function DriveFileEditDialog({
  file,
  clients,
  projects,
}: {
  file: DriveFileProps;
  clients: EntityOption[];
  projects: EntityOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      await updateDriveFile(file.id, formData);
      setOpen(false);
      router.refresh();
      toast.success("Archivo actualizado.");
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
          <DialogTitle>Editar archivo</DialogTitle>
          <DialogDescription>Actualiza nombre y contexto.</DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <FieldGroup>
            <input
              type="hidden"
              name="folderId"
              value={file.folderId ?? "none"}
            />
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input name="name" defaultValue={file.name} required />
            </Field>
            <Field>
              <FieldLabel>Cliente</FieldLabel>
              <FormSelect
                name="clientId"
                defaultValue={file.clientId ?? "none"}
                options={relationOptions(clients, "General")}
              />
            </Field>
            <Field>
              <FieldLabel>Proyecto</FieldLabel>
              <FormSelect
                name="projectId"
                defaultValue={file.projectId ?? "none"}
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
