"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createCredential, updateCredential } from "@/app/admin/actions";
import {
  CreateTrigger,
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
import { Textarea } from "@/components/ui/textarea";

const kindOptions = [
  { value: "LOGIN", label: "Login" },
  { value: "OAUTH", label: "OAuth / iniciar con..." },
  { value: "API_KEY", label: "API key" },
  { value: "DATABASE", label: "Base de datos" },
  { value: "HOSTING", label: "Hosting" },
  { value: "SOCIAL_MEDIA", label: "Red social" },
  { value: "EMAIL", label: "Email" },
  { value: "OTHER", label: "Otro" },
];

type CredentialProps = {
  id: string;
  clientId: string | null;
  projectId: string | null;
  title: string;
  kind: string;
  url: string | null;
  username: string | null;
  accessMethod: string | null;
  notes: string | null;
};

export function CredentialDialog({
  credential,
  clients,
  projects,
  mode = "edit",
  fixedClientId,
  fixedProjectId,
}: {
  credential?: CredentialProps;
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
      if (credential) {
        await updateCredential(credential.id, formData);
      } else {
        await createCredential(formData);
      }
      setOpen(false);
      router.refresh();
      toast.success("Credencial guardada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <CreateTrigger label="Nueva credencial" />
        ) : (
          <EditTrigger />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva credencial" : "Editar credencial"}
          </DialogTitle>
          <DialogDescription>
            Puedes guardar password/token o solo método de acceso.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSave} className="space-y-4">
          <FieldGroup>
            {credential ? (
              <input type="hidden" name="existingSecret" value="true" />
            ) : null}
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                name="title"
                defaultValue={credential?.title ?? ""}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <FormSelect
                name="kind"
                defaultValue={credential?.kind ?? "LOGIN"}
                options={kindOptions}
              />
            </Field>
            {fixedClientId ? (
              <input type="hidden" name="clientId" value={fixedClientId} />
            ) : (
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <FormSelect
                  name="clientId"
                  defaultValue={credential?.clientId ?? "none"}
                  options={relationOptions(clients, "General")}
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
                  defaultValue={credential?.projectId ?? "none"}
                  options={relationOptions(projects, "Sin proyecto")}
                />
              </Field>
            )}
            <Field>
              <FieldLabel>URL</FieldLabel>
              <Input
                name="url"
                type="url"
                defaultValue={credential?.url ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel>Usuario / correo</FieldLabel>
              <Input
                name="username"
                defaultValue={credential?.username ?? ""}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel>Método de acceso</FieldLabel>
              <Input
                name="accessMethod"
                defaultValue={credential?.accessMethod ?? ""}
                placeholder="Iniciar con Google, acceso por invitación..."
              />
            </Field>
            <Field>
              <FieldLabel>Contraseña / token</FieldLabel>
              <Textarea
                name="secret"
                rows={3}
                placeholder={
                  mode === "edit"
                    ? "Deja vacío para conservar el secreto actual"
                    : ""
                }
              />
            </Field>
            <Field>
              <FieldLabel>Notas</FieldLabel>
              <Textarea
                name="notes"
                rows={3}
                defaultValue={credential?.notes ?? ""}
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
