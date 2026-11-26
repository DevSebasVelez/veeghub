import { Filter } from "lucide-react";

import { IconTile, TONE_SOLID, type Tone } from "@/components/admin/tone";
import type { Metrics } from "@/lib/admin/queries/campaigns";
import { cn } from "@/lib/utils";

import { compact, money } from "./format";

/** From impression to client: where the money leaks. */
export function FunnelCard({ metrics, className }: { metrics: Metrics; className?: string }) {
  const steps: Array<{ label: string; value: number; tone: Tone; cost?: number | null }> = [
    { label: "Impresiones", value: metrics.impressions, tone: "indigo" },
    { label: "Clics", value: metrics.clicks, tone: "blue", cost: metrics.cpc },
    { label: "Leads en el CRM", value: metrics.leads, tone: "violet", cost: metrics.cpl },
    { label: "Contactados", value: metrics.contacted, tone: "sky" },
    { label: "Calificados", value: metrics.qualified, tone: "amber", cost: metrics.costPerQualified },
    { label: "Clientes", value: metrics.won, tone: "emerald", cost: metrics.costPerWon },
  ];
  const top = Math.max(metrics.impressions, 1);

  return (
    <section className={cn("rounded-2xl border bg-card", className)}>
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <IconTile icon={Filter} tone="violet" size="sm" />
        <div>
          <h2 className="text-sm font-semibold">Embudo</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">De la impresión al cliente, con lo que cuesta cada paso.</p>
        </div>
      </div>
      <ol className="space-y-3 p-5">
        {steps.map((step, index) => {
          const previous = index ? steps[index - 1].value : null;
          const rate = previous ? (step.value / previous) * 100 : null;
          // Log scale: impressions are thousands, clients are units.
          const width = step.value ? Math.max(4, (Math.log10(step.value + 1) / Math.log10(top + 1)) * 100) : 0;
          return (
            <li key={step.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{step.label}</span>
                <span className="flex items-baseline gap-2">
                  {rate != null ? <span className="text-[11px] tabular-nums text-muted-foreground">{rate < 1 ? rate.toFixed(2) : rate.toFixed(0)}%</span> : null}
                  <span className="font-semibold tabular-nums">{compact(step.value)}</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", TONE_SOLID[step.tone])} style={{ width: `${width}%` }} />
              </div>
              {step.cost != null ? <p className="text-right text-[11px] tabular-nums text-muted-foreground">{money(step.cost)} c/u</p> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
