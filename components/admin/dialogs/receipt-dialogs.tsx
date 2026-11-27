"use client";

import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Mail, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import {
  sendAccountStatement,
  sendPaymentReceipt,
} from "@/lib/admin/actions/receipts/actions";
import { type AdminFormState, unwrap } from "@/lib/admin/actions/types";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { DialogSubmitFooter } from "@/components/admin/dialogs/_base";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** To, CC and a personal message, shared by both send flows. */
function EmailFields({ defaultTo, defaultSubject }: { defaultTo: string; defaultSubject: string }) {
  return (
    <>
      <Field>
        <FieldLabel>Para</FieldLabel>
        <Input name="to" type="email" defaultValue={defaultTo} placeholder="cliente@email.com" required />
      </Field>
      <Field>
        <FieldLabel>
          CC <span className="font-normal text-muted-foreground">(opcional)</span>
        </FieldLabel>
        <Input name="cc" type="email" placeholder="copia@email.com" />
      </Field>
      <Field>
        <FieldLabel>Asunto</FieldLabel>
        <Input name="subject" defaultValue={defaultSubject} />
      </Field>
      <Field>
        <FieldLabel>
          Mensaje <span className="font-normal text-muted-foreground">(opcional)</span>
        </FieldLabel>
        <Textarea
          name="customMessage"
          rows={3}
          placeholder="Si lo dejas vacío se usa el texto por defecto."
        />
      </Field>
    </>
  );
}

function useSend(action: (formData: FormData) => Promise<AdminFormState>, onDone: () => void) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
      unwrap(await action(formData));
      onDone();
      router.refresh();
      toast.success("Enviado.", { description: `A ${formData.get("to")}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setSaving(false);
    }
  }

  return { saving, submit };
}

export type ReceiptPayment = {
  id: string;
  folio: string | null;
  receivableTitle: string;
  clientName: string;
  clientEmail: string | null;
};

/**
 * Row action for a payment: preview, download or email its receipt. The
 * first time any of them runs the receipt gets its folio.
 */
export function PaymentReceiptMenu({ payment }: { payment: ReceiptPayment }) {
  const [sendOpen, setSendOpen] = useState(false);
  const router = useRouter();
  const href = `/admin/finanzas/pagos/${payment.id}/comprobante`;
  const { saving, submit } = useSend(sendPaymentReceipt, () => setSendOpen(false));

  // Opening the PDF may assign the folio; show it in the list afterwards.
  const refreshSoon = () => {
    if (!payment.folio) setTimeout(() => router.refresh(), 1500);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            aria-label="Comprobante de pago"
            title="Comprobante de pago"
          >
            <ReceiptText className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {payment.folio ? `Comprobante ${payment.folio}` : "Comprobante de pago"}
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a href={href} target="_blank" rel="noopener" onClick={refreshSoon}>
              <ExternalLink className="size-4" />
              Ver PDF
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`${href}?download=1`} onClick={refreshSoon}>
              <Download className="size-4" />
              Descargar
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSendOpen(true)}>
            <Mail className="size-4" />
            Enviar por email…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar comprobante</DialogTitle>
            <DialogDescription className="truncate">
              {payment.receivableTitle} · {payment.clientName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <input type="hidden" name="paymentId" value={payment.id} />
            <FieldGroup>
              <EmailFields
                defaultTo={payment.clientEmail ?? ""}
                defaultSubject={`Comprobante de pago${payment.folio ? ` ${payment.folio}` : ""} · ${payment.clientName}`}
              />
            </FieldGroup>
            <DialogSubmitFooter submitLabel="Enviar comprobante" saving={saving} savingLabel="Enviando…" />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Preset = "year" | "month" | "lastMonth" | "all" | "custom";

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "year", label: "Este año" },
  { value: "month", label: "Este mes" },
  { value: "lastMonth", label: "Mes anterior" },
  { value: "all", label: "Todo" },
  { value: "custom", label: "Fechas" },
];

function presetRange(preset: Preset): { desde?: string; hasta?: string; todo?: boolean } {
  const today = dayKeyInAppZone(new Date());
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (preset) {
    case "year":
      return { desde: `${y}-01-01`, hasta: today };
    case "month":
      return { desde: `${y}-${pad(m)}-01`, hasta: today };
    case "lastMonth": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return { desde: `${py}-${pad(pm)}-01`, hasta: `${py}-${pad(pm)}-${pad(last)}` };
    }
    case "all":
      return { todo: true, hasta: today };
    default:
      return {};
  }
}

/**
 * Account statement: pick the period, then preview, download or email the
 * PDF. Pending milestones are always included, at today's cutoff.
 *
 * - From a client: every project, or one picked in the form.
 * - From a project (`project`): the whole project, every milestone paid or
 *   not; the period only narrows the payments and starts at "Todo".
 */
export function AccountStatementDialog({
  client,
  projects = [],
  project,
}: {
  client: { id: string; name: string; email: string | null };
  projects?: Array<{ id: string; name: string }>;
  project?: { id: string; name: string };
}) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>(project ? "all" : "year");
  const formRef = useRef<HTMLFormElement>(null);
  const { saving, submit } = useSend(sendAccountStatement, () => setOpen(false));

  const range = presetRange(preset);
  const thisYear = presetRange("year");

  function pdfUrl(download: boolean) {
    const form = formRef.current;
    if (!form) return "#";
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ["desde", "hasta", "todo", "proyecto"]) {
      const value = String(data.get(key) ?? "");
      if (value && value !== "all") params.set(key, value);
    }
    if (download) params.set("download", "1");
    if (project) {
      params.delete("proyecto");
      return `/admin/proyectos/${project.id}/estado-de-cuenta?${params}`;
    }
    return `/admin/clientes/${client.id}/estado-de-cuenta?${params}`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="size-4" />
          Estado de cuenta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? "Estado de cuenta del proyecto" : "Estado de cuenta"}</DialogTitle>
          <DialogDescription>
            {project
              ? `Valor, hitos y saldo de ${project.name} al día de hoy, con los pagos recibidos en el periodo.`
              : `Pagos recibidos en el periodo y saldos pendientes al día de hoy de ${client.name}.`}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={submit} className="space-y-5">
          <input type="hidden" name="clientId" value={client.id} />
          {project ? <input type="hidden" name="proyecto" value={project.id} /> : null}
          {preset !== "custom" ? (
            <>
              {range.desde ? <input type="hidden" name="desde" value={range.desde} /> : null}
              {range.hasta ? <input type="hidden" name="hasta" value={range.hasta} /> : null}
              {range.todo ? <input type="hidden" name="todo" value="1" /> : null}
            </>
          ) : null}

          <FieldGroup>
            <Field>
              <FieldLabel>Periodo</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPreset(p.value)}
                    aria-pressed={preset === p.value}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      preset === p.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>
            {preset === "custom" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Desde</FieldLabel>
                  <DatePickerField name="desde" defaultValue={thisYear.desde} />
                </Field>
                <Field>
                  <FieldLabel>Hasta</FieldLabel>
                  <DatePickerField name="hasta" defaultValue={thisYear.hasta} />
                </Field>
              </div>
            ) : null}
            {!project && projects.length > 1 ? (
              <Field>
                <FieldLabel>Proyecto</FieldLabel>
                <FormSelect
                  name="proyecto"
                  defaultValue="all"
                  options={[
                    { value: "all", label: "Todos los proyectos" },
                    ...projects.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </Field>
            ) : null}
          </FieldGroup>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" asChild>
              <a
                href="#"
                target="_blank"
                rel="noopener"
                onClick={(e) => {
                  e.currentTarget.href = pdfUrl(false);
                }}
              >
                <ExternalLink className="size-4" />
                Ver PDF
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" className="flex-1" asChild>
              <a
                href="#"
                onClick={(e) => {
                  e.currentTarget.href = pdfUrl(true);
                }}
              >
                <Download className="size-4" />
                Descargar
              </a>
            </Button>
          </div>

          <div className="rounded-xl bg-muted/40 p-4">
            <p className="mb-3 text-sm font-medium">Enviar por email</p>
            <FieldGroup>
              <EmailFields
                defaultTo={client.email ?? ""}
                defaultSubject={`Estado de cuenta · ${project?.name ?? client.name}`}
              />
            </FieldGroup>
          </div>

          <DialogSubmitFooter submitLabel="Enviar estado de cuenta" saving={saving} savingLabel="Enviando…" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
