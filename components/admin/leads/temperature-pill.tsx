import { Flame, Snowflake, Sun } from "lucide-react";

import { TEMPERATURE_LABELS } from "@/components/admin/leads/constants";
import { cn } from "@/lib/utils";

const STYLES: Record<string, { icon: typeof Flame; className: string }> = {
  HOT: {
    icon: Flame,
    className:
      "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  },
  WARM: {
    icon: Sun,
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  COLD: {
    icon: Snowflake,
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

/**
 * Temperatura que le asignó el asistente IA. Icono y palabra van siempre
 * juntos: el color sólo refuerza, nunca es lo único que dice algo.
 */
export function TemperaturePill({
  temperature,
  className,
}: {
  temperature: string | null;
  className?: string;
}) {
  const style = temperature ? STYLES[temperature] : null;
  if (!temperature || !style) return null;

  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        style.className,
        className,
      )}
    >
      <Icon className="size-3" />
      {TEMPERATURE_LABELS[temperature] ?? temperature}
    </span>
  );
}
