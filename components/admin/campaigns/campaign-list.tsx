import Link from "next/link";
import { ChevronRight, Megaphone } from "lucide-react";

import { IconTile } from "@/components/admin/tone";
import { isMessagingKind, type CampaignListRow } from "@/lib/admin/queries/campaigns";

import { AdThumb, DeliveryBadge, KindTag } from "./badges";
import { budgetLabel, money } from "./format";

/** Leads for form campaigns, conversations for messaging ones. */
function result(row: CampaignListRow) {
  if (isMessagingKind(row.kind)) {
    return { value: row.conversations, label: "conversaciones", cost: row.costPerConversation };
  }
  return { value: row.leads, label: "leads", cost: row.cpl };
}

export function CampaignList({ rows, query }: { rows: CampaignListRow[]; query: string }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
        <IconTile icon={Megaphone} tone="blue" size="lg" className="mx-auto" />
        <p className="mt-4 text-sm font-medium">Ninguna campaña en este período.</p>
        <p className="mt-1 text-sm text-muted-foreground">Prueba con otro mes, quita los filtros o toca «Actualizar».</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Campañas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Primero las que necesitan atención; luego por gasto.</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{rows.length}</span>
      </div>

      {/* Phone: one card per campaign. */}
      <ul className="divide-y md:hidden">
        {rows.map((row) => {
          const res = result(row);
          return (
            <li key={row.id}>
              <Link href={`/admin/campanas/${row.id}${query ? `?${query}` : ""}`} className="flex gap-3 px-4 py-4 active:bg-accent/40">
                <AdThumb src={row.thumbnail} alt="" className="size-14" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{row.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DeliveryBadge state={row.state} />
                    <KindTag kind={row.kind} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <Stat label="Gasto" value={money(row.spend)} />
                    <Stat label={res.label} value={String(res.value)} />
                    <Stat label="c/u" value={money(res.cost)} />
                  </div>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2.5 pl-5 pr-3 font-normal">Campaña</th>
              <th className="px-3 font-normal">Estado</th>
              <th className="px-3 text-right font-normal">Gasto</th>
              <th className="px-3 text-right font-normal">Resultados</th>
              <th className="px-3 text-right font-normal">Costo c/u</th>
              <th className="px-3 text-right font-normal">Calificados</th>
              <th className="px-3 text-right font-normal">Clientes</th>
              <th className="py-2.5 pl-3 pr-5 text-right font-normal">Costo/cliente</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const res = result(row);
              return (
                <tr key={row.id} className="group relative hover:bg-accent/30">
                  <td className="max-w-md py-3 pl-5 pr-3">
                    <div className="flex items-center gap-3">
                      <AdThumb src={row.thumbnail} alt="" className="size-10" />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/campanas/${row.id}${query ? `?${query}` : ""}`}
                          className="block truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                          title={row.name}
                        >
                          {row.name}
                        </Link>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <KindTag kind={row.kind} />
                          <span>{budgetLabel(row.dailyBudget, row.lifetimeBudget)}</span>
                          {row.adsTotal ? <span>· {row.adsActive}/{row.adsTotal} anuncios</span> : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3">
                    <DeliveryBadge state={row.state} />
                  </td>
                  <td className="px-3 text-right font-medium tabular-nums">{money(row.spend)}</td>
                  <td className="px-3 text-right tabular-nums">
                    {res.value}
                    <span className="ml-1 text-xs text-muted-foreground">{res.label}</span>
                  </td>
                  <td className="px-3 text-right tabular-nums">{money(res.cost)}</td>
                  <td className="px-3 text-right tabular-nums">{row.qualified}</td>
                  <td className="px-3 text-right tabular-nums">{row.won}</td>
                  <td className="py-3 pl-3 pr-5 text-right font-medium tabular-nums">{money(row.costPerWon)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-1 py-1.5">
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
