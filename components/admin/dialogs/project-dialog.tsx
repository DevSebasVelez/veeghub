"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createProject, updateProject } from "@/app/admin/actions";
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
import { Textarea } from "@/components/ui/textarea";

const statusOptions = [
  { value: "LEAD", label: "Lead" },
  { value: "ACTIVE", label: "Activo" },
  { value: "PAUSED", label: "Pausado" },
  { value: "COMPLETED", label: "Completado" },
  { value: "ARCHIVED", label: "Archivado" },
];

type ProjectProps = {
  id: string;
  name: string;
  clientId: string | null;
  status: string;
  description: string | null;
  stack: string | null;
  repositoryUrl: string | null;
  productionUrl: string | null;
  stagingUrl: string | null;
  budget: string | null;
  startDate: string | null;
  dueDate: string | null;
};

export function ProjectDialog({
  project,
  clients,
  mode = "edit",
  fixedClientId,
}: {
  project?: ProjectProps;
  clients: EntityOption[];
  mode?: "create" | "edit";
  fixedClientId?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      if (project) {
        await updateProject(project.id, formData);
      } else {
        await createProject(formData);
      }
      setOpen(false);
      router.refresh();
      toast.success("Proyecto guardado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <EditTrigger label={mode === "create" ? "Nuevo proyecto" : "Editar"} />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo proyecto" : "Editar proyecto"}
          </DialogTitle>
          <DialogDescription>
            Centraliza entregables, stack, links y fechas.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input name="name" defaultValue={project?.name ?? ""} required />
            </Field>
            {fixedClientId ? (
              <input type="hidden" name="clientId" value={fixedClientId} />
            ) : (
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <FormSelect
                  name="clientId"
                  defaultValue={project?.clientId ?? "none"}
                  options={relationOptions(clients, "Sin cliente")}
                />
              </Field>
            )}
            <Field>
              <FieldLabel>Estado</FieldLabel>
              <FormSelect
                name="status"
                defaultValue={project?.status ?? "ACTIVE"}
                options={statusOptions}
              />
            </Field>
            <Field>
              <FieldLabel>Stack</FieldLabel>
              <Input name="stack" defaultValue={project?.stack ?? ""} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Presupuesto</FieldLabel>
                <Input
                  name="budget"
                  type="number"
                  step="0.01"
                  defaultValue={project?.budget ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel>Entrega estimada</FieldLabel>
                <DatePickerField
                  name="dueDate"
                  defaultValue={project?.dueDate}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Repositorio</FieldLabel>
              <Input
                name="repositoryUrl"
                type="url"
                defaultValue={project?.repositoryUrl ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel>URL producción</FieldLabel>
              <Input
                name="productionUrl"
                type="url"
                defaultValue={project?.productionUrl ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Textarea
                name="description"
                rows={3}
                defaultValue={project?.description ?? ""}
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
