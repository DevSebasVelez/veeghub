import { CheckCircle2, Store, XCircle } from "lucide-react";

import { ProductionPointDialog } from "@/components/admin/dialogs/production-point-dialog";
import { IconTile } from "@/components/admin/tone";
import { cn } from "@/lib/utils";

type Point = {
  id: string;
  prefix: string;
  environment: "PRUEBAS" | "PRODUCCION";
  nextNumber: string;
  active: boolean;
};

/**
 * Where VeegHub issues from: its emission points and, until production is
 * enabled, the checklist to enable it.
 */
export function SriEmissionCard({
  points,
  checks,
}: {
  points: Point[];
  checks: Array<{ label: string; ok: boolean }>;
}) {
  const hasProduction = points.some((p) => p.environment === "PRODUCCION" && p.active);

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={Store} tone="blue" size="sm" />
          <div>
            <h2 className="text-sm font-semibold">Emisión en el SRI</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Puntos desde los que VeegHub numera sus facturas. El facturador del SRI sigue con 001-001.
            </p>
          </div>
        </div>
        {hasProduction ? null : <ProductionPointDialog ready={checks.every((c) => c.ok)} />}
      </div>

      <ul className="divide-y">
        {points.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-medium tabular-nums">{p.prefix}</p>
              <p className="text-xs text-muted-foreground">Siguiente: {p.nextNumber}</p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
                p.environment === "PRUEBAS"
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
              )}
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {p.environment === "PRUEBAS" ? "Pruebas" : "Producción"}
            </span>
          </li>
        ))}
      </ul>

      {hasProduction ? null : (
        <ul className="space-y-1.5 border-t px-5 py-4">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-xs">
              {c.ok ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
              )}
              <span className={c.ok ? "text-muted-foreground" : ""}>{c.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
