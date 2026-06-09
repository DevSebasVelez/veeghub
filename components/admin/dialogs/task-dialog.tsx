"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createTask, updateTask } from "@/lib/admin/actions/tasks/actions";
import {
  CreateTrigger,
  EditTrigger,
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
  { value: "TODO", label: "Por hacer" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "BLOCKED", label: "Bloqueada" },
  { value: "DONE", label: "Lista" },
];

const priorityOptions = [
  { value: "LOW", label: "Baja" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

type TaskProps = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
};

export function TaskDialog({
  task,
  projects,
  mode = "edit",
  fixedProjectId,
}: {
  task?: TaskProps;
  projects: EntityOption[];
  mode?: "create" | "edit";
  fixedProjectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSave(formData: FormData) {
    try {
      if (task) {
        await updateTask(task.id, formData);
      } else {
        await createTask(formData);
      }
      setOpen(false);
      router.refresh();
      toast.success("Tarea guardada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <CreateTrigger label="Nueva tarea" />
        ) : (
          <EditTrigger />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva tarea" : "Editar tarea"}
          </DialogTitle>
          <DialogDescription>
            Actualiza prioridad, estado y fecha límite.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <FieldGroup>
            {fixedProjectId ? (
              <input type="hidden" name="projectId" value={fixedProjectId} />
            ) : (
              <Field>
                <FieldLabel>Proyecto</FieldLabel>
                <FormSelect
                  name="projectId"
                  defaultValue={task?.projectId ?? projects[0]?.id}
                  options={projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />
              </Field>
            )}
            <Field>
              <FieldLabel>Tarea</FieldLabel>
              <Input name="title" defaultValue={task?.title ?? ""} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Prioridad</FieldLabel>
                <FormSelect
                  name="priority"
                  defaultValue={task?.priority ?? "MEDIUM"}
                  options={priorityOptions}
                />
              </Field>
              <Field>
                <FieldLabel>Estado</FieldLabel>
                <FormSelect
                  name="status"
                  defaultValue={task?.status ?? "TODO"}
                  options={statusOptions}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Fecha límite</FieldLabel>
              <DatePickerField name="dueDate" defaultValue={task?.dueDate} />
            </Field>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Textarea
                name="description"
                rows={3}
                defaultValue={task?.description ?? ""}
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
