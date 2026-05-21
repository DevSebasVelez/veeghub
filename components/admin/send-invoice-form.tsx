"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { sendInvoiceEmail } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function SendInvoiceForm({
  invoiceId,
  defaultTo,
  defaultSubject,
}: {
  invoiceId: string;
  defaultTo: string;
  defaultSubject: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await sendInvoiceEmail(formData);
        toast.success("Factura enviada correctamente.", {
          description: `Enviada a ${formData.get("to")}`,
          duration: 5000,
        });
        formRef.current?.reset();
        router.refresh();
      } catch (err) {
        toast.error("Error al enviar la factura.", {
          description: err instanceof Error ? err.message : "Intenta de nuevo.",
          duration: 6000,
        });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <FieldGroup>
        <Field>
          <FieldLabel>Para</FieldLabel>
          <Input
            name="to"
            type="email"
            defaultValue={defaultTo}
            placeholder="cliente@email.com"
            required
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel>CC (opcional)</FieldLabel>
          <Input
            name="cc"
            type="email"
            placeholder="copia@email.com"
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel>Asunto</FieldLabel>
          <Input
            name="subject"
            defaultValue={defaultSubject}
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel>
            Mensaje personalizado{" "}
            <span className="font-normal text-muted-foreground">
              (opcional)
            </span>
          </FieldLabel>
          <Textarea
            name="customMessage"
            rows={3}
            placeholder="Añade un mensaje personal. Si lo dejas vacío se usará el texto por defecto."
            disabled={pending}
          />
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" size="sm" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <Send className="size-3.5" />
            Enviar factura
          </>
        )}
      </Button>
    </form>
  );
}
