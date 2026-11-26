import { BadgeDollarSign, CalendarRange, Download, Inbox, Target, Trophy } from "lucide-react";

import { compact, money } from "@/components/admin/campaigns/format";
import { MonthlyChart } from "@/components/admin/campaigns/monthly-chart";
import { Delta, IconTile, KpiCard } from "@/components/admin/tone";
import { Button } from "@/components/ui/button";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { getMonthlyReport } from "@/lib/admin/queries/campaigns";

export default async function MonthlyPage() {
  const today = dayKeyInAppZone(new Date());
  const rows = await getMonthlyReport(today, 12);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
        <IconTile icon={CalendarRange} tone="indigo" size="lg" className="mx-auto" />
        <p className="mt-4 text-sm font-medium">Todavía no hay meses con gasto.</p>
        <p className="mt-1 text-sm text-muted-foreground">Toca «Actualizar»: la primera sincronización trae 12 meses de Meta.</p>
      </div>
    );
  }

  const year = rows.filter((row) => row.month.startsWith(today.slice(0, 4)));
  const sum = (key: "spend" | "leads" | "won") => year.reduce((total, row) => total + row[key], 0);
  const spendYear = sum("spend");
  const leadsYear = sum("leads");
  const wonYear = sum("won");
  const newest = [...rows].reverse();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={BadgeDollarSign} tone="blue" label={`Gasto ${today.slice(0, 4)}`} value={money(spendYear)} helper={`${money(spendYear / Math.max(year.length, 1))} al mes`} />
        <KpiCard icon={Inbox} tone="violet" label={`Leads ${today.slice(0, 4)}`} value={String(leadsYear)} helper="Llegados al CRM" />
        <KpiCard icon={Target} tone="amber" label="Costo por lead del año" value={money(leadsYear ? spendYear / leadsYear : null)} />
        <KpiCard icon={Trophy} tone="emerald" label="Clientes del año" value={String(wonYear)} helper={wonYear ? `${money(spendYear / wonYear)} c/u` : "Aún ninguno desde Meta"} />
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Gasto mes a mes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Barras: gasto. Verde: leads. Ámbar: costo por lead.</p>
          </div>
          <Button asChild variant="outline" size="icon" className="size-9 rounded-full" aria-label="Exportar 12 meses en CSV">
            <a href={`/api/admin/campanas/exportar?desde=${rows[0].month}-01&hasta=${today}`} download>
              <Download className="size-4" />
            </a>
          </Button>
        </div>
        <MonthlyChart data={rows.map((row) => ({ label: row.shortLabel, spend: Number(row.spend.toFixed(2)), leads: row.leads, cpl: row.cpl == null ? null : Number(row.cpl.toFixed(2)) }))} />
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Detalle por mes</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">El mes en curso va hasta hoy. La variación compara con el mes anterior.</p>
        </div>
        <ul className="divide-y md:hidden">
          {newest.map((row) => (
            <li key={row.month} className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <a href={`/admin/campanas?mes=${row.month}`} className="font-medium hover:underline">{row.label}</a>
                <span className="flex items-center gap-1.5 font-semibold tabular-nums">
                  {money(row.spend)} <Delta value={row.spendChange} goodWhen="neutral" />
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.leads} leads · {money(row.cpl)} c/u · {row.won} clientes{row.reach ? ` · alcance ${compact(row.reach)}` : ""}
              </p>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2.5 pl-5 pr-3 font-normal">Mes</th>
                <th className="px-3 text-right font-normal">Gasto</th>
                <th className="px-3 text-right font-normal">Alcance</th>
                <th className="px-3 text-right font-normal">Frecuencia</th>
                <th className="px-3 text-right font-normal">Leads</th>
                <th className="px-3 text-right font-normal">Costo por lead</th>
                <th className="px-3 text-right font-normal">Conversaciones</th>
                <th className="px-3 text-right font-normal">Clientes</th>
                <th className="py-2.5 pl-3 pr-5 text-right font-normal">Costo/cliente</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {newest.map((row) => (
                <tr key={row.month} className="hover:bg-accent/30">
                  <td className="py-3 pl-5 pr-3">
                    <a href={`/admin/campanas?mes=${row.month}`} className="font-medium hover:underline">{row.label}</a>
                  </td>
                  <td className="px-3 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Delta value={row.spendChange} goodWhen="neutral" />
                      <span className="font-medium">{money(row.spend)}</span>
                    </span>
                  </td>
                  <td className="px-3 text-right tabular-nums text-muted-foreground">{row.reach ? compact(row.reach) : "—"}</td>
                  <td className="px-3 text-right tabular-nums text-muted-foreground">{row.frequency ? `${row.frequency.toFixed(1)}×` : "—"}</td>
                  <td className="px-3 text-right tabular-nums">{row.leads}</td>
                  <td className="px-3 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Delta value={row.cplChange} goodWhen="down" />
                      {money(row.cpl)}
                    </span>
                  </td>
                  <td className="px-3 text-right tabular-nums">{row.conversations}</td>
                  <td className="px-3 text-right tabular-nums">{row.won}</td>
                  <td className="py-3 pl-3 pr-5 text-right font-medium tabular-nums">{money(row.costPerWon)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
