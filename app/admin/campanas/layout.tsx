import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, Megaphone } from "lucide-react";

import { CampaignsNav } from "@/components/admin/campaigns/campaigns-nav";
import { RefreshInsightsButton } from "@/components/admin/campaigns/refresh-button";
import { IconTile } from "@/components/admin/tone";
import { getRecommendations, getSyncInfo } from "@/lib/admin/queries/campaigns";
import { dayKeyInAppZone, minutesSince, shortAge } from "@/lib/admin/format";
import { adsManagerUrl } from "@/lib/meta/campaign-kind";
import { cn } from "@/lib/utils";

/** F8: the hub reads stored data; the cron keeps it fresh (lib/meta/sync.ts). */
export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const [sync, recommendations] = await Promise.all([getSyncInfo(), getRecommendations(dayKeyInAppZone(new Date()))]);
  const urgent = recommendations.filter((rec) => rec.level === "alta").length;

  const age = sync?.lastSyncedAt ? minutesSince(sync.lastSyncedAt) : null;
  const fresh = age != null && age <= 90;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={Megaphone} tone="blue" size="lg" className="max-sm:hidden" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Campañas</h1>
            <p className="text-sm text-muted-foreground max-sm:hidden">Qué funciona en Meta Ads, cuánto cuesta y qué mover para vender más.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3 text-xs text-muted-foreground"
            title={sync?.lastFullSyncAt ? `Completa: ${shortAge(sync.lastFullSyncAt)}` : undefined}
          >
            <span className={cn("size-2 rounded-full", sync?.lastSyncError ? "bg-amber-500" : fresh ? "bg-emerald-500" : "bg-zinc-400")} />
            {sync?.lastSyncedAt ? (
              <>
                <span className="max-sm:hidden">Actualizado</span> {shortAge(sync.lastSyncedAt)}
              </>
            ) : (
              "Sin sincronizar"
            )}
          </span>
          <RefreshInsightsButton />
          {sync ? (
            <a
              href={adsManagerUrl(sync.accountId)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir el Administrador de anuncios"
              className="inline-flex h-10 items-center rounded-full px-3 text-sm text-muted-foreground hover:text-foreground sm:h-9"
            >
              <span className="max-sm:hidden">Abrir en Meta&nbsp;</span>↗
            </a>
          ) : null}
        </div>
      </div>

      {sync?.lastSyncError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="min-w-0">
            La última sincronización tuvo un problema: <span className="[overflow-wrap:anywhere]">{sync.lastSyncError}</span>{" "}
            <Link href="/admin/leads/configuracion" className="underline underline-offset-2">
              Revisa la integración
            </Link>
            .
          </p>
        </div>
      ) : null}

      <Suspense>
        <CampaignsNav alerts={urgent} />
      </Suspense>
      {children}
    </div>
  );
}
