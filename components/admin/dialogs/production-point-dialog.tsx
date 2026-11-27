"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

import { createProductionEmissionPoint } from "@/lib/admin/actions/sri/emission-points";
import { unwrap } from "@/lib/admin/actions/types";
import { DialogSubmitFooter } from "@/components/admin/dialogs/_base";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export function ProductionPointDialog({ ready }: { ready: boolean }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
      if (confirmed) formData.set("confirm", "on");
      unwrap(await createProductionEmissionPoint(formData));
      setOpen(false);
      router.refresh();
      toast.success("Producción habilitada: el punto 001-002 ya emite facturas reales.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el punto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" disabled={!ready}>
          <Rocket className="size-3.5" />
          Habilitar producción
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Habilitar emisión en producción</DialogTitle>
          <DialogDescription>
            Crea el punto 001-002 de producción. Desde ahí, cada «Emitir» manda una factura real al SRI, con validez
            tributaria.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Primer número</FieldLabel>
              <Input name="nextSequential" defaultValue="1" inputMode="numeric" className="tabular-nums" required />
              <FieldDescription>
                1 si nunca emitiste con 001-002. Si lo usaste en el facturador del SRI, pon el siguiente al último.
              </FieldDescription>
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
              Entiendo que las facturas de este punto son reales ante el SRI y que una corrección es una nota de
              crédito.
            </label>
          </FieldGroup>
          <DialogSubmitFooter submitLabel="Habilitar producción" saving={saving} disabled={!confirmed} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
