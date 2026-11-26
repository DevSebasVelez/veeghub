import { requireAdmin } from "@/lib/auth/require-admin";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { getExportRows } from "@/lib/admin/queries/campaigns";
import { CAMPAIGN_KIND_LABELS } from "@/lib/meta/campaign-kind";
import { parsePeriod } from "@/lib/meta/period";

function cell(value: string | number) {
  const text = String(value);
  // Quote, and defuse spreadsheet formulas in campaign names.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV of the period: one row per campaign and day (F8.3). */
export async function GET(request: Request) {
  await requireAdmin();

  const search = new URL(request.url).searchParams;
  const period = parsePeriod(
    {
      dias: search.get("dias") ?? undefined,
      mes: search.get("mes") ?? undefined,
      desde: search.get("desde") ?? undefined,
      hasta: search.get("hasta") ?? undefined,
    },
    dayKeyInAppZone(new Date()),
  );
  const rows = await getExportRows(period);

  const header = ["Fecha", "Campaña", "ID campaña", "Tipo", "Gasto", "Impresiones", "Clics", "Clics al enlace", "Leads (Meta)", "Conversaciones", "Leads (CRM)", "Calificados", "Clientes"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.day,
        row.campaign,
        row.campaignId,
        CAMPAIGN_KIND_LABELS[row.kind],
        row.spend.toFixed(2),
        row.impressions,
        row.clicks,
        row.linkClicks,
        row.metaLeads,
        row.conversations,
        row.leads,
        row.qualified,
        row.won,
      ]
        .map(cell)
        .join(","),
    ),
  ];

  // BOM so Excel opens the accents right.
  return new Response(`﻿${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="meta-ads_${period.since}_${period.until}.csv"`,
      "cache-control": "no-store",
    },
  });
}
