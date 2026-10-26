import type { LucideIcon } from "lucide-react";

import { InfoTip } from "@/components/admin/finance/info-tip";
import { TONE_STYLES, type Tone } from "@/components/admin/finance/kpi-card";
import { cn } from "@/lib/utils";

export type LeadStat = {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: string;
  hint?: string | null;
  info?: string;
};

/**
 * Cuatro datos de un vistazo en una sola tira, separados por líneas: menos
 * peso visual que cuatro tarjetas sueltas y se lee de izquierda a derecha.
 */
export function LeadStatsStrip({ stats }: { stats: LeadStat[] }) {
  return (
    <div className="grid grid-cols-2 rounded-2xl border bg-card shadow-xs lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "flex items-center gap-3 p-4",
              index % 2 === 1 && "border-l",
              index >= 2 && "border-t lg:border-t-0",
              index === 2 && "lg:border-l",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                TONE_STYLES[stat.tone],
              )}
            >
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">{stat.label}</span>
                {stat.info ? <InfoTip text={stat.info} /> : null}
              </p>
              <p className="truncate text-base font-semibold">{stat.value}</p>
              {stat.hint ? (
                <p className="truncate text-xs text-muted-foreground">{stat.hint}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
