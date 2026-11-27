import { FileKey2 } from "lucide-react";

import { formatDateOnly } from "@/lib/admin/format";
import { EXPIRY_WARNING_DAYS, daysUntilExpiry } from "@/lib/sri/certificate";
import { SriCertificateDialog } from "@/components/admin/dialogs/sri-certificate-dialog";
import { IconTile } from "@/components/admin/tone";
import { cn } from "@/lib/utils";

type ActiveCertificate = {
  holder: string;
  holderId: string | null;
  issuer: string;
  validTo: Date;
  createdAt: Date;
};

const ENV_LABELS: Record<string, string> = {
  SRI_CERT_KEY: "llave de cifrado",
  SRI_CERT_PASSWORD: "clave del .p12",
};

const PILL = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  zinc: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
};

function standing(certificate: ActiveCertificate | null) {
  if (!certificate) return { label: "Sin cargar", tone: "zinc" as const, detail: null };
  const days = daysUntilExpiry(certificate.validTo);
  if (days < 0) return { label: "Caducada", tone: "red" as const, detail: "Renuévala en Security Data y súbela de nuevo." };
  if (days <= EXPIRY_WARNING_DAYS) {
    return {
      label: `Caduca en ${days} ${days === 1 ? "día" : "días"}`,
      tone: "amber" as const,
      detail: "Renuévala antes de que caduque: sin firma vigente no se puede emitir.",
    };
  }
  return { label: "Vigente", tone: "emerald" as const, detail: null };
}

/**
 * Electronic signature used to sign the invoices VeegHub issues. Shows who it
 * belongs to and until when; the file itself never leaves the server.
 */
export function SriCertificateCard({
  certificate,
  signatures,
  missingEnv,
}: {
  certificate: ActiveCertificate | null;
  signatures: number;
  /** Server variables not set yet (names only, never values). */
  missingEnv: string[];
}) {
  const state = standing(certificate);
  const serverReady = missingEnv.length === 0;

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <IconTile icon={FileKey2} tone="indigo" size="sm" />
          <div>
            <h2 className="text-sm font-semibold">Firma electrónica</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Firma las facturas que emite VeegHub.
            </p>
          </div>
        </div>
        {serverReady ? <SriCertificateDialog replacing={Boolean(certificate)} /> : null}
      </div>

      <div className="space-y-3 p-5 text-sm">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs", PILL[state.tone])}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {state.label}
        </span>

        {certificate ? (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Titular</dt>
              <dd className="font-medium">{certificate.holder}</dd>
              {certificate.holderId ? (
                <dd className="text-xs text-muted-foreground">{certificate.holderId}</dd>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Emitida por</dt>
              <dd className="font-medium">{certificate.issuer}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vigente hasta</dt>
              <dd className="font-medium">{formatDateOnly(certificate.validTo)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Firmas registradas</dt>
              <dd className="font-medium tabular-nums">{signatures}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground">
            Sube el .p12 de Security Data para poder emitir facturas desde VeegHub.
          </p>
        )}

        {state.detail ? <p className="text-xs text-muted-foreground">{state.detail}</p> : null}

        {!serverReady ? (
          <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Falta configurar en el servidor{" "}
            {missingEnv.map((name, i) => (
              <span key={name}>
                {i ? " y " : null}
                <code>{name}</code> ({ENV_LABELS[name]})
              </span>
            ))}
            . Se definen como variables <em>Sensitive</em> en Vercel (en local, en{" "}
            <code>.env</code>); nunca se escriben en esta pantalla.
          </p>
        ) : null}
      </div>
    </section>
  );
}
