import { Images } from "lucide-react";

import { AdCard } from "@/components/admin/campaigns/ad-card";
import { readPeriod } from "@/components/admin/campaigns/page-helpers";
import { CampaignsToolbar } from "@/components/admin/campaigns/toolbar";
import { IconTile } from "@/components/admin/tone";
import { getAdsReport } from "@/lib/admin/queries/campaigns";
import type { PeriodParams } from "@/lib/meta/period";

export default async function AdsPage({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const { period, months } = readPeriod(await searchParams);
  const ads = await getAdsReport(period);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CampaignsToolbar period={period.value} months={months} since={period.since} until={period.until} />
        <p className="text-xs text-muted-foreground">Ordenados por clientes y calificados, no sólo por leads.</p>
      </div>

      {ads.length ? (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {ads.map((ad, index) => (
            <AdCard key={ad.id} ad={ad} rank={index + 1} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
          <IconTile icon={Images} tone="pink" size="lg" className="mx-auto" />
          <p className="mt-4 text-sm font-medium">Ningún anuncio gastó en este período.</p>
          <p className="mt-1 text-sm text-muted-foreground">Elige un rango más amplio o toca «Actualizar».</p>
        </div>
      )}
    </div>
  );
}
