"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, ExternalLink, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { createIssued, sendIssued } from "@/lib/admin/actions/sri/emit";
import type { IssueRequest } from "@/lib/sri/issue-request";
import { SendInvoiceForm } from "@/components/admin/send-invoice-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Review → «Emitir» → live progress, in one dialog:
// 1. the RIDE preview, built on the server from what the form holds;
// 2. the confirmation: environment, number and total, and the human click;
// 3. the progress while the SRI signs off, polled from /estado;
// 4. the outcome, with «Enviar al cliente» once authorized.

type Status = "DRAFT" | "SIGNED" | "RECEIVED" | "RETURNED" | "AUTHORIZED" | "NOT_AUTHORIZED";
type Live = { status: Status | null; problem: string | null; number: string | null; documentsReady: boolean };
type Phase = "review" | "creating" | "sending" | "done";

const STEPS: Array<{ label: string; doneFrom: Status[] }> = [
  { label: "Firmando con tu firma electrónica", doneFrom: ["SIGNED", "RECEIVED", "AUTHORIZED", "NOT_AUTHORIZED", "RETURNED"] },
  { label: "Enviando al SRI", doneFrom: ["RECEIVED", "AUTHORIZED", "NOT_AUTHORIZED"] },
  { label: "Esperando la autorización", doneFrom: ["AUTHORIZED"] },
];

function Step({ label, state }: { label: string; state: "done" | "active" | "todo" | "failed" }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      {state === "done" ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : state === "active" ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
      ) : state === "failed" ? (
        <XCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground/50" />
      )}
      <span className={cn(state === "todo" && "text-muted-foreground")}>{label}</span>
    </li>
  );
}

export function IssueReviewDialog({
  request,
  disabled,
  environment,
  number,
  total,
  clientName,
  buyerEmail,
}: {
  request: IssueRequest;
  disabled: boolean;
  environment: "PRUEBAS" | "PRODUCCION";
  number: string;
  total: string;
  clientName: string;
  buyerEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("review");
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [live, setLive] = useState<Live>({ status: null, problem: null, number: null, documentsReady: false });
  const [pending, setPending] = useState(false);
  // One id per review: retrying «Emitir» after a lost answer returns the
  // invoice already created instead of issuing a second one.
  const [requestId, setRequestId] = useState("");
  // Polling: one request at a time; `polling.current` false drops late answers.
  const polling = useRef(false);

  const busy = phase === "creating" || phase === "sending";
  const isTest = environment === "PRUEBAS";

  useEffect(() => () => {
    polling.current = false;
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function openReview() {
    if (disabled || loadingPreview) return;
    setLoadingPreview(true);
    try {
      const response = await fetch("/admin/facturas/nueva/vista-previa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo armar la vista previa.");
      }
      setPreviewUrl(URL.createObjectURL(await response.blob()));
      setRequestId(crypto.randomUUID());
      setPhase("review");
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo armar la vista previa.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function readStatus(id: string) {
    const response = await fetch(`/admin/facturas/${id}/estado`, { cache: "no-store" });
    if (response.ok) setLive((await response.json()) as Live);
  }

  async function emit() {
    setPhase("creating");
    let created: Awaited<ReturnType<typeof createIssued>>;
    try {
      created = await createIssued({ ...request, requestId });
    } catch {
      created = { ok: false, error: "Se perdió la conexión. Vuelve a pulsar «Emitir»: no se duplicará la factura." };
    }
    if (!created.ok) {
      toast.error(created.error);
      setPhase("review");
      return;
    }
    const id = created.data.id;
    setInvoiceId(id);
    setLive({ status: "DRAFT", problem: null, number: created.data.number, documentsReady: false });
    setPhase("sending");

    polling.current = true;
    void (async () => {
      while (polling.current) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (!polling.current) break;
        const response = await fetch(`/admin/facturas/${id}/estado`, { cache: "no-store" }).catch(() => null);
        if (response?.ok && polling.current) setLive((await response.json()) as Live);
      }
    })();
    let sent: Awaited<ReturnType<typeof sendIssued>>;
    try {
      sent = await sendIssued(id);
    } catch {
      sent = { ok: false, error: "Se perdió la conexión con VeegHub. La factura sigue su curso: revisa su estado en la ficha." };
    }
    polling.current = false;
    await readStatus(id);
    if (!sent.ok) {
      setLive((l) => ({ ...l, problem: l.problem ?? sent.error }));
    } else {
      setPending(sent.data.busy ? true : sent.data.pending);
    }
    setPhase("done");
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    if (busy) return; // never close while the SRI is being called
    setOpen(next);
    if (!next && invoiceId) router.push(`/admin/facturas/${invoiceId}`);
  }

  const status = live.status;
  const failed = status === "RETURNED" || status === "NOT_AUTHORIZED";
  const stepState = (index: number): "done" | "active" | "todo" | "failed" => {
    if (!status) return "todo";
    if (STEPS[index].doneFrom.includes(status)) return "done";
    const firstOpen = STEPS.findIndex((s) => !s.doneFrom.includes(status));
    if (index !== firstOpen) return "todo";
    if (failed) return "failed";
    if (phase === "done") return live.problem || pending ? "failed" : "todo";
    return "active";
  };

  return (
    <>
      <Button type="button" className="w-full" disabled={disabled || loadingPreview} onClick={openReview}>
        {loadingPreview ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {loadingPreview ? "Armando la vista previa…" : "Revisar y emitir"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[95svh] overflow-y-auto sm:max-w-5xl"
          showCloseButton={!busy}
          onInteractOutside={(e) => busy && e.preventDefault()}
          onEscapeKeyDown={(e) => busy && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{phase === "review" ? "Revisa la factura" : `Factura ${live.number ?? number}`}</DialogTitle>
            <DialogDescription>
              {phase === "review"
                ? "Así saldrá el RIDE. Si algo no cuadra, cierra y corrige antes de emitir."
                : "VeegHub firma la factura, la envía al SRI y espera la autorización."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="self-start overflow-hidden rounded-xl border bg-muted/40">
              {previewUrl ? (
                <iframe
                  // Once authorized, the real RIDE replaces the preview.
                  key={live.status === "AUTHORIZED" && phase === "done" ? "authorized" : "preview"}
                  src={
                    live.status === "AUTHORIZED" && phase === "done" && invoiceId
                      ? `/admin/facturas/${invoiceId}/ride#toolbar=0&navpanes=0`
                      : `${previewUrl}#toolbar=0&navpanes=0`
                  }
                  title={live.status === "AUTHORIZED" ? "RIDE autorizado" : "Vista previa del RIDE"}
                  className="h-[45svh] w-full lg:h-[70svh]"
                />
              ) : null}
            </div>

            <div className="space-y-4">
              {phase === "review" || phase === "creating" ? (
                <>
                  <dl className="space-y-3 rounded-xl bg-muted/40 p-4 text-sm">
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">Ambiente</dt>
                      <dd
                        className={cn(
                          "font-semibold",
                          isTest ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300",
                        )}
                      >
                        {isTest ? "Pruebas (celcer) · sin validez tributaria" : "Producción · factura real ante el SRI"}
                      </dd>
                    </div>
                    {[
                      ["Número", number],
                      ["Cliente", clientName],
                    ].map(([label, value]) => (
                      <div key={label} className="space-y-1">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className={cn("font-medium", label === "Número" && "font-mono tabular-nums")}>{value}</dd>
                      </div>
                    ))}
                    <div className="space-y-1 border-t pt-3">
                      <dt className="text-xs text-muted-foreground">Total</dt>
                      <dd className="text-2xl font-semibold tabular-nums">{total}</dd>
                    </div>
                  </dl>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Al emitir se consume el número y la factura se firma y se envía al SRI. Después no se edita: una
                    corrección es una nota de crédito.
                  </p>
                  <Button type="button" className="w-full" onClick={emit} disabled={phase === "creating"}>
                    {phase === "creating" ? <Loader2 className="size-4 animate-spin" /> : null}
                    {phase === "creating" ? "Creando la factura…" : isTest ? "Emitir en pruebas" : "Emitir factura real"}
                  </Button>
                </>
              ) : (
                <>
                  <ol className="space-y-3 rounded-xl bg-muted/40 p-4">
                    {STEPS.map((step, index) => (
                      <Step key={step.label} label={step.label} state={stepState(index)} />
                    ))}
                    {status === "AUTHORIZED" ? (
                      <Step
                        label="Guardando el XML autorizado y el RIDE"
                        state={live.documentsReady ? "done" : phase === "done" ? "failed" : "active"}
                      />
                    ) : null}
                  </ol>

                  {phase === "done" ? (
                    status === "AUTHORIZED" ? (
                      <div className="space-y-4">
                        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Autorizada por el SRI{isTest ? " (pruebas)" : ""}.
                        </p>
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <a href={`/admin/facturas/${invoiceId}/ride`} target="_blank" rel="noopener">
                            <ExternalLink className="size-4" />
                            Ver RIDE autorizado
                          </a>
                        </Button>
                        {live.documentsReady && invoiceId ? (
                          <div className="space-y-2 border-t pt-4">
                            <p className="text-sm font-semibold">Enviar al cliente</p>
                            <SendInvoiceForm
                              invoiceId={invoiceId}
                              defaultTo={buyerEmail}
                              defaultSubject={`Factura ${live.number ?? ""} · ${clientName}`.trim()}
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{live.problem}</p>
                        )}
                      </div>
                    ) : (
                      <p
                        className={cn(
                          "rounded-xl p-3 text-sm",
                          failed || (live.problem && !pending)
                            ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                            : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                        )}
                      >
                        {failed
                          ? `El SRI no la aceptó. ${live.problem ?? ""}`
                          : pending
                            ? "El SRI aún no responde. VeegHub vuelve a consultar solo cada pocos minutos; el número queda reservado."
                            : (live.problem ?? "No se pudo terminar el envío.")}
                      </p>
                    )
                  ) : null}

                  {phase === "done" && invoiceId ? (
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/admin/facturas/${invoiceId}`}>Ir a la factura</Link>
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
