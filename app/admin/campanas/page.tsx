import Link from "next/link";
import { after } from "next/server";
import {
  BadgeDollarSign,
  Inbox,
  Megaphone,
  Target,
  Trophy,
} from "lucide-react";

import {
  getCampaignDailySeries,
  getCampaignPerformance,
  type CampaignRow,
} from "@/lib/admin/queries/campaigns";
import prisma from "@/lib/db/prisma";
import { syncCampaignInsights } from "@/lib/meta/insights";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { CampaignRangeFilter } from "@/components/admin/campaigns/range-filter";
import { RefreshInsightsButton } from "@/components/admin/campaigns/refresh-button";
import { SpendVsLeadsChart } from "@/components/admin/campaigns/spend-vs-leads-chart";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: typeof Inbox;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:size-9">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold tabular-nums sm:text-xl">
            {value}
          </div>
          <div className="truncate text-[11px] leading-tight text-muted-foreground sm:text-xs">
            {label}
          </div>
          {helper ? (
            <div className="truncate text-[10px] text-muted-foreground/70">
              {helper}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function money(value: number | null) {
  return value == null ? "—" : formatCurrency(value);
}

function CampaignCard({ row }: { row: CampaignRow }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      {/* Los nombres de campaña son largos por convención; sin truncate
          estiran la tarjeta más allá del ancho de la pantalla. */}
      <div className="truncate font-medium leading-tight" title={row.campaignName}>
        {row.campaignName}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tabular-nums">
            {formatCurrency(row.spend)}
          </div>
          <div className="text-[10px] text-muted-foreground">Gasto</div>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tabular-nums">{row.leads}</div>
          <div className="text-[10px] text-muted-foreground">Leads</div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tabular-nums">
            {money(row.costPerLead)}
          </div>
          <div className="text-[10px] text-muted-foreground">CPL</div>
        </div>
      </div>
      <div className="mt-2 border-t pt-2 text-center text-xs text-muted-foreground">
        {row.won} cliente{row.won === 1 ? "" : "s"} ganado
        {row.won === 1 ? "" : "s"}
        {row.costPerWon != null ? ` · ${money(row.costPerWon)} c/u` : ""}
      </div>
    </div>
  );
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias } = await searchParams;
  const days = Math.min(365, Math.max(1, Number(dias ?? "30") || 30));

  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

  // A page that lands empty until someone finds the refresh button just reads
  // as broken. The first ever load pulls the data inline — one request, about a
  // second — and later loads refresh in the background so nothing blocks.
  const account = await prisma.metaAdAccount.findFirst({
    select: { lastSyncedAt: true },
  });

  if (!account?.lastSyncedAt) {
    try {
      await syncCampaignInsights({ since, until });
    } catch (error) {
      console.error("[campanas] primera sincronización falló", error);
    }
  } else {
    after(async () => {
      try {
        // The TTL guard inside makes this a no-op when it ran recently.
        await syncCampaignInsights({ since, until });
      } catch (error) {
        console.error("[campanas] refresco en segundo plano falló", error);
      }
    });
  }

  const [performance, series] = await Promise.all([
    getCampaignPerformance({ since, until }),
    getCampaignDailySeries({ since, until }),
  ]);

  const { campaigns, totals, account: adAccount } = performance;

  const chartData = series.map((point) => ({
    ...point,
    // "16 sep" reads better than an ISO date on a narrow axis.
    label: new Intl.DateTimeFormat("es-EC", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${point.day}T00:00:00.000Z`)),
  }));

  const isoSince = since.toISOString().slice(0, 10);
  const isoUntil = until.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Megaphone size={22} className="text-blue-500" />
            Campañas
          </h1>
          <p className="text-sm text-muted-foreground">
            Cuánto gastás y cuánto te cuesta cada lead y cada cliente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 md:flex-none">
            <CampaignRangeFilter />
          </div>
          <RefreshInsightsButton since={isoSince} until={isoUntil} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
        <StatCard
          label="Gasto"
          value={formatCurrency(totals.spend)}
          icon={BadgeDollarSign}
        />
        <StatCard label="Leads" value={String(totals.leads)} icon={Inbox} />
        <StatCard
          label="Costo por lead"
          value={money(totals.costPerLead)}
          icon={Target}
        />
        <StatCard
          label="Clientes ganados"
          value={String(totals.won)}
          icon={Trophy}
        />
        <div className="col-span-2 xl:col-span-1">
          <StatCard
            label="Costo por cliente"
            value={money(totals.costPerWon)}
            helper="Lo que realmente importa"
            icon={Trophy}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Gasto y leads por día</h2>
          <p className="text-xs text-muted-foreground">
            Barras: gasto. Línea: leads recibidos.
          </p>
        </div>
        <SpendVsLeadsChart data={chartData} />
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {campaigns.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sin datos en este período.
          </p>
        ) : (
          campaigns.map((row) => (
            <CampaignCard key={row.campaignId ?? row.campaignName} row={row} />
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Campaña</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Impresiones</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Costo/lead</TableHead>
                <TableHead className="text-right">Ganados</TableHead>
                <TableHead className="pr-5 text-right">
                  Costo/cliente
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Sin datos en este período. Probá con un rango más amplio o
                    tocá Actualizar.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((row) => (
                  <TableRow key={row.campaignId ?? row.campaignName}>
                    <TableCell className="max-w-64 truncate pl-5 font-medium">
                      {row.campaignName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.spend)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.impressions.toLocaleString("es-EC")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.ctr != null ? `${row.ctr.toFixed(2)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.leads}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.costPerLead)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.won}
                    </TableCell>
                    <TableCell className="pr-5 text-right font-medium tabular-nums">
                      {money(row.costPerWon)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {adAccount?.lastSyncedAt
          ? `Datos de Meta actualizados el ${formatDate(adAccount.lastSyncedAt)}.`
          : "Todavía no se han traído datos de Meta."}
        {adAccount?.usageCallCount != null
          ? ` Uso de la API: ${adAccount.usageCallCount}%${
              adAccount.accessTier ? ` (${adAccount.accessTier})` : ""
            }.`
          : ""}{" "}
        Los leads se cuentan desde{" "}
        <Link href="/admin/leads" className="underline underline-offset-2">
          tu pipeline
        </Link>
        , no desde Meta.
      </p>
    </div>
  );
}
