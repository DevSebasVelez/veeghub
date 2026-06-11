"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  createMeeting,
  updateMeeting,
} from "@/lib/admin/actions/meetings/actions";
import {
  CreateTrigger,
  DialogSubmitFooter,
  EditTrigger,
  relationOptions,
  type EntityOption,
} from "@/components/admin/dialogs/_base";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { FormSelect } from "@/components/admin/form-select";
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
  { value: "SCHEDULED", label: "Programada" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
];

type MeetingProps = {
  id: string;
  title: string;
  clientId: string | null;
  startsAt: string;
  endsAt: string;
  meetLink: string | null;
  notes: string | null;
  status: string;
};

export function MeetingDialog({
  meeting,
  clients,
  mode = "edit",
  defaultDate,
  trigger,
  onSaved,
}: {
  meeting?: MeetingProps;
  clients: EntityOption[];
  mode?: "create" | "edit";
  defaultDate?: string;
  trigger?: ReactNode;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const formData = new FormData(event.currentTarget);
    const fecha = String(formData.get("fecha") ?? "");
    const horaInicio = String(formData.get("horaInicio") ?? "");
    const horaFin = String(formData.get("horaFin") ?? "");

    if (!fecha) {
      toast.error("Selecciona una fecha.");
      return;
    }

    const [y, m, d] = fecha.split("-").map(Number);
    const [sh, sm] = horaInicio.split(":").map(Number);
    const [eh, em] = horaFin.split(":").map(Number);
    const startsAt = new Date(y, m - 1, d, sh, sm);
    const endsAt = new Date(y, m - 1, d, eh, em);

    if (endsAt <= startsAt) {
      toast.error("La hora de fin debe ser posterior a la de inicio.");
      return;
    }

    formData.set("startsAt", startsAt.toISOString());
    formData.set("endsAt", endsAt.toISOString());
    formData.delete("fecha");
    formData.delete("horaInicio");
    formData.delete("horaFin");

    setSaving(true);
    try {
      if (meeting) {
        await updateMeeting(meeting.id, formData);
      } else {
        await createMeeting(formData);
      }
      setOpen(false);
      router.refresh();
      toast.success("Reunión guardada.");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const meetingStart = meeting ? new Date(meeting.startsAt) : null;
  const meetingEnd = meeting ? new Date(meeting.endsAt) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ??
          (mode === "create" ? (
            <CreateTrigger label="Nueva reunión" />
          ) : (
            <EditTrigger />
          ))}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva reunión" : "Editar reunión"}
          </DialogTitle>
          <DialogDescription>
            Define el horario, el cliente y el enlace de la videollamada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Título</FieldLabel>
              <Input
                name="title"
                defaultValue={meeting?.title ?? ""}
                placeholder="Reunión de seguimiento"
                required
              />
            </Field>
            <Field>
              <FieldLabel>Cliente</FieldLabel>
              <FormSelect
                name="clientId"
                defaultValue={meeting?.clientId ?? "none"}
                options={relationOptions(clients, "Sin cliente")}
              />
            </Field>
            <Field>
              <FieldLabel>Fecha</FieldLabel>
              <DatePickerField
                name="fecha"
                defaultValue={
                  meetingStart
                    ? format(meetingStart, "yyyy-MM-dd")
                    : (defaultDate ?? format(new Date(), "yyyy-MM-dd"))
                }
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Hora de inicio</FieldLabel>
                <Input
                  type="time"
                  name="horaInicio"
                  defaultValue={
                    meetingStart ? format(meetingStart, "HH:mm") : "09:00"
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel>Hora de fin</FieldLabel>
                <Input
                  type="time"
                  name="horaFin"
                  defaultValue={
                    meetingEnd ? format(meetingEnd, "HH:mm") : "10:00"
                  }
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Enlace de videollamada</FieldLabel>
              <Input
                type="url"
                name="meetLink"
                defaultValue={meeting?.meetLink ?? ""}
                placeholder="https://meet.google.com/abc-defg-hij"
              />
            </Field>
            {mode === "edit" ? (
              <Field>
                <FieldLabel>Estado</FieldLabel>
                <FormSelect
                  name="status"
                  defaultValue={meeting?.status ?? "SCHEDULED"}
                  options={statusOptions}
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel>Notas</FieldLabel>
              <Textarea
                name="notes"
                rows={3}
                defaultValue={meeting?.notes ?? ""}
                placeholder="Agenda, acuerdos, pendientes..."
              />
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Guardar" saving={saving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
