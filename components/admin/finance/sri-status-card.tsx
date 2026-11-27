import { Download, ExternalLink, Landmark } from "lucide-react";

import { formatDate } from "@/lib/admin/format";
import { SriAdvanceButton } from "@/components/admin/finance/sri-advance-button";
import { IconTile } from "@/components/admin/tone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "DRAFT" | "SIGNED" | "RECEIVED" | "RETURNED" | "AUTHORIZED" | "NOT_AUTHORIZED";
type Tone = "zinc" | "amber" | "blue" | "emerald" | "red";

const STATUS: Record<Status, { label: string; tone: Tone; action: string | null }> = {
  DRAFT: { label: "Borrador", tone: "zinc", action: "Firmar y enviar de nuevo" },
  SIGNED: { label: "Firmada, sin enviar", tone: "amber", action: "Reintentar envío" },
  RECEIVED: { label: "Recibida, esperando autorización", tone: "blue", action: "Consultar autorización" },
  RETURNED: { label: "Devuelta por el SRI", tone: "red", action: null },
  AUTHORIZED: { label: "Autorizada", tone: "emerald", action: null },
  NOT_AUTHORIZED: { label: "No autorizada", tone: "red", action: null },
};

const PILL: Record<Tone, string> = {
  zinc: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

const OPERATION = { RECEPTION: "Recepción", AUTHORIZATION: "Autorización" } as const;

type Submission = {
  id: string;
  operation: "RECEPTION" | "AUTHORIZATION";
  status: string;
  error: string | null;
  messages: unknown;
  durationMs: number | null;
  createdAt: Date;
};

function messageText(messages: unknown) {
  if (!Array.isArray(messages)) return null;
  const parts = messages
    .map((m) => {
      const msg = m as { id?: string | null; text?: string | null };
      return [msg.id ? `[${msg.id}]` : null, msg.text].filter(Boolean).join(" ");
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Where an invoice issued from VeegHub stands with the SRI, and what can be done. */
export function SriStatusCard({
  invoiceId,
  status,
  environment,
  attempts,
  lastError,
  nextAttemptAt,
  authorizedAt,
  submissions,
}: {
  invoiceId: string;
  status: Status;
  environment: "PRUEBAS" | "PRODUCCION";
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date | null;
  authorizedAt: Date | null;
  submissions: Submission[];
}) {
  const state = STATUS[status];

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <IconTile icon={Landmark} tone="blue" size="sm" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">SRI</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Emitida desde VeegHub ·{" "}
            {environment === "PRUEBAS" ? (
              <span className="font-medium text-amber-700 dark:text-amber-300">Pruebas, sin validez tributaria</span>
            ) : (
              "Producción"
            )}
          </p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4 text-sm">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs", PILL[state.tone])}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {state.label}
        </span>

        {authorizedAt ? (
          <p className="text-xs text-muted-foreground">Autorizada el {formatDate(authorizedAt)}</p>
        ) : null}
        {lastError ? (
          <p className="rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">{lastError}</p>
        ) : null}
        {nextAttemptAt ? (
          <p className="text-xs text-muted-foreground">
            Próximo intento automático: {formatDate(nextAttemptAt)} · {attempts}{" "}
            {attempts === 1 ? "llamada" : "llamadas"} hasta ahora
          </p>
        ) : null}

        {state.action ? <SriAdvanceButton invoiceId={invoiceId} label={state.action} /> : null}

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <a href={`/admin/facturas/${invoiceId}/ride`} target="_blank" rel="noopener">
              <ExternalLink className="size-4" />
              {status === "AUTHORIZED" ? "Ver RIDE" : "Vista previa"}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <a href={`/admin/facturas/${invoiceId}/ride?download=1`}>
              <Download className="size-4" />
              Descargar
            </a>
          </Button>
        </div>
      </div>

      {submissions.length > 0 ? (
        <ol className="divide-y border-t">
          {submissions.map((s) => {
            const detail = s.error ?? messageText(s.messages);
            return (
              <li key={s.id} className="space-y-0.5 px-5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium">
                    {OPERATION[s.operation]} · {s.status}
                  </p>
                  <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)} s` : ""}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">{formatDate(s.createdAt)}</p>
                {detail ? <p className="text-[11px] leading-relaxed text-muted-foreground">{detail}</p> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
