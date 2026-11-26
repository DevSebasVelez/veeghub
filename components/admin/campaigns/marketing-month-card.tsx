import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";

import { IconTile } from "@/components/admin/tone";
import type { Metrics } from "@/lib/admin/queries/campaigns";

import { compact, money } from "./format";

/** «Marketing del mes» on /admin/reportes (F8.3): what the month's ads cost and brought. */
export function MarketingMonthCard({ month, data }: { month: string; data: (Metrics & { reach: number | null }) | null }) {
  if (!data || (!data.spend && !data.leads)) return null;

  const items = [
    { label: "Gasto en Meta", value: money(data.spend) },
    { label: "Leads", value: String(data.leads), helper: data.reach ? `Alcance ${compact(data.reach)}` : undefined },
    { label: "Costo por lead", value: money(data.cpl) },
    { label: "Clientes ganados", value: String(data.won), helper: data.won ? `${money(data.costPerWon)} c/u` : undefined },
  ];

  return (
    <section className="rounded-2xl border bg-linear-to-br from-blue-50 to-card dark:from-blue-500/10">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <IconTile icon={Megaphone} tone="blue" size="sm" />
          <div>
            <h2 className="text-sm font-semibold">Marketing del mes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Lo que costaron los anuncios y lo que trajeron.</p>
          </div>
        </div>
        <Link
          href={`/admin/campanas?mes=${month}`}
          aria-label="Ver campañas del mes"
          className="flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{item.value}</dd>
            {item.helper ? <dd className="text-xs text-muted-foreground">{item.helper}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
