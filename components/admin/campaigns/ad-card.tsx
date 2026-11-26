import Link from "next/link";
import { Crown } from "lucide-react";

import type { AdRow } from "@/lib/admin/queries/campaigns";
import { isMessagingKind } from "@/lib/admin/queries/campaigns";
import { cn } from "@/lib/utils";

import { AdThumb, DeliveryBadge, KindTag } from "./badges";
import { compact, money, percent } from "./format";

/** One ad: creative, what it cost and how far its leads went in the CRM. */
export function AdCard({ ad, rank, showCampaign = true }: { ad: AdRow; rank?: number; showCampaign?: boolean }) {
  const messaging = isMessagingKind(ad.kind);
  const best = rank === 1 && (ad.qualified > 0 || ad.won > 0);
  const steps = [
    { label: "Contactados", value: ad.contactedRate, tone: "bg-sky-500" },
    { label: "Calificados", value: ad.qualifiedRate, tone: "bg-amber-500" },
    { label: "Ganados", value: ad.wonRate, tone: "bg-emerald-500" },
  ];

  return (
    <li className={cn("flex flex-col rounded-2xl border bg-card p-4", best && "ring-2 ring-emerald-500/30")}>
      <div className="flex gap-3">
        <div className="relative">
          <AdThumb src={ad.thumbnail} alt={ad.title ?? ad.name} className="size-20" />
          {rank ? (
            <span
              className={cn(
                "absolute -left-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border-2 border-card text-[11px] font-semibold tabular-nums",
                best ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {best ? <Crown className="size-3" /> : rank}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="line-clamp-2 text-sm font-semibold leading-snug" title={ad.name}>
            {ad.name}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <DeliveryBadge state={ad.state} />
            <KindTag kind={ad.kind} />
          </div>
          {showCampaign ? (
            <Link href={`/admin/campanas/${ad.campaignId}`} className="-my-1.5 block truncate py-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
              {ad.campaignName}
            </Link>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{ad.adSetName}</p>
          )}
        </div>
      </div>

      {ad.title ? <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">«{ad.title}»</p> : null}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Gasto" value={money(ad.spend)} />
        <Metric label={messaging ? "Conversac." : "Leads"} value={String(messaging ? ad.conversations : ad.leads)} />
        <Metric label="c/u" value={money(messaging ? ad.costPerConversation : ad.cpl)} />
      </div>

      {!messaging ? (
        <div className="mt-3 space-y-1.5">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-muted-foreground">{step.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", step.tone)} style={{ width: `${Math.min(100, step.value ?? 0)}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums">{percent(step.value, 0)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs">
        <span className="text-muted-foreground">
          CTR {percent(ad.ctr, 2)} · {compact(ad.impressions)} impr.
        </span>
        <span className={cn("font-semibold tabular-nums", ad.costPerQualified != null && "text-emerald-700 dark:text-emerald-300")}>
          {ad.costPerQualified != null ? `${money(ad.costPerQualified)} / calificado` : ad.won ? `${money(ad.costPerWon)} / cliente` : "Sin calificados"}
        </span>
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-1 py-2">
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
