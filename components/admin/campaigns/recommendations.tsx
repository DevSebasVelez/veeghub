import Link from "next/link";
import { AlertOctagon, ArrowUpRight, Lightbulb, Rocket, TriangleAlert } from "lucide-react";

import { IconTile, TONE_TEXT, type Tone } from "@/components/admin/tone";
import type { Recommendation, RecommendationLevel } from "@/lib/meta/recommendations";
import { cn } from "@/lib/utils";

const LEVEL: Record<RecommendationLevel, { tone: Tone; icon: React.ElementType; label: string; border: string }> = {
  alta: { tone: "red", icon: AlertOctagon, label: "Urgente", border: "border-l-red-500" },
  media: { tone: "amber", icon: TriangleAlert, label: "Revisar", border: "border-l-amber-500" },
  oportunidad: { tone: "emerald", icon: Rocket, label: "Oportunidad", border: "border-l-emerald-500" },
};

/**
 * «Qué mover hoy». Each card names the number that fired it and links to the
 * campaign; changes happen in Ads Manager (no ads_management permission).
 */
export function RecommendationsCard({ items, limit = 4 }: { items: Recommendation[]; limit?: number }) {
  if (!items.length) {
    return (
      <section className="flex items-center gap-4 rounded-2xl border bg-linear-to-br from-emerald-50 to-card p-5 dark:from-emerald-500/10">
        <IconTile icon={Lightbulb} tone="emerald" />
        <div>
          <h2 className="text-sm font-semibold">Todo en orden</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ninguna regla se disparó: frecuencia, costo por lead, gasto y anuncios están dentro de lo normal.
          </p>
        </div>
      </section>
    );
  }

  const shown = items.slice(0, limit);
  const rest = items.slice(limit);

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <IconTile icon={Lightbulb} tone="amber" size="sm" />
          <div>
            <h2 className="text-sm font-semibold">Qué mover hoy</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Reglas simples sobre los últimos 7 y 30 días. Nada se cambia solo.</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      <ul className="grid gap-3 p-4 sm:grid-cols-2">
        {shown.map((item) => (
          <RecommendationItem key={item.id} item={item} />
        ))}
      </ul>
      {rest.length ? (
        <details className="group border-t">
          <summary className="cursor-pointer list-none px-5 py-3 text-sm text-muted-foreground hover:text-foreground">
            Ver {rest.length} más
          </summary>
          <ul className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            {rest.map((item) => (
              <RecommendationItem key={item.id} item={item} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function RecommendationItem({ item }: { item: Recommendation }) {
  const level = LEVEL[item.level];
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={level.icon} tone={level.tone} size="sm" />
          <div className="min-w-0">
            <p className={cn("text-[11px] font-medium uppercase tracking-wide", TONE_TEXT[level.tone])}>{level.label}</p>
            <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
          </div>
        </div>
        {item.campaignId ? <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums">{item.metric}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
    </>
  );
  const classes = cn("block h-full rounded-xl border border-l-4 bg-background/40 p-4", level.border);

  return (
    <li>
      {item.campaignId ? (
        <Link href={`/admin/campanas/${item.campaignId}`} className={cn(classes, "transition-colors hover:bg-accent/40")}>
          {content}
        </Link>
      ) : (
        <div className={classes}>{content}</div>
      )}
    </li>
  );
}
