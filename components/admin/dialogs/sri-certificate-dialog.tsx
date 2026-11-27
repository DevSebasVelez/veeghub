"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadSriCertificate } from "@/lib/admin/actions/sri/certificate";
import { unwrap } from "@/lib/admin/actions/types";
import { DialogSubmitFooter } from "@/components/admin/dialogs/_base";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Upload (or replace) the .p12 with its password. The server checks both
 * before saving and keeps them encrypted; the password is never shown again.
 */
export function SriCertificateDialog({ replacing }: { replacing: boolean }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      unwrap(await uploadSriCertificate(new FormData(event.currentTarget)));
      setOpen(false);
      router.refresh();
      toast.success("Firma electrónica guardada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la firma.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4" />
          {replacing ? "Reemplazar" : "Subir .p12"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{replacing ? "Reemplazar firma electrónica" : "Subir firma electrónica"}</DialogTitle>
          <DialogDescription>
            El archivo y su clave se guardan cifrados y solo se usan para firmar las
            facturas que emitas. La clave no se vuelve a mostrar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Archivo .p12</FieldLabel>
              <Input name="p12" type="file" accept=".p12,.pfx,application/x-pkcs12" required />
            </Field>
            <Field>
              <FieldLabel>Clave de la firma</FieldLabel>
              <Input name="password" type="password" autoComplete="off" required />
              <FieldDescription>
                La que te dio Security Data. VeegHub abre el archivo y hace una firma de
                prueba antes de guardar; si no coincide, no guarda nada.
                {replacing ? " La firma anterior deja de usarse." : null}
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Guardar firma" saving={saving} savingLabel="Verificando…" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
