import Link from "next/link";
import { LayoutGrid, MapPin, MonitorSmartphone, Users, UsersRound } from "lucide-react";

import { BarList } from "@/components/admin/campaigns/bar-list";
import { money } from "@/components/admin/campaigns/format";
import { IconTile, type Tone } from "@/components/admin/tone";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { getAudienceReport, type BreakdownRow } from "@/lib/admin/queries/campaigns";
import { monthLabel } from "@/lib/meta/period";
import { cn } from "@/lib/utils";

const PLATFORM_TONES: Record<string, Tone> = { facebook: "blue", instagram: "pink", messenger: "violet", audience_network: "zinc", threads: "zinc", whatsapp: "emerald" };

function rows(list: BreakdownRow[], toneOf?: (row: BreakdownRow) => Tone) {
  return list.map((row) => ({
    key: row.key,
    label: row.label,
    share: row.share,
    value: money(row.spend),
    helper: row.metaLeads ? `${row.metaLeads} leads · ${money(row.cpl)}` : `${row.share.toFixed(0)}%`,
    tone: toneOf?.(row),
  }));
}

function Card({ icon, tone, title, hint, children, className }: { icon: React.ElementType; tone: Tone; title: string; hint: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border bg-card", className)}>
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <IconTile icon={icon} tone={tone} size="sm" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default async function AudiencePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const today = dayKeyInAppZone(new Date());
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : today.slice(0, 7);
  const report = await getAudienceReport(month);
  const months = report.available.length ? report.available : [month];

  // Where a lead is cheapest, not where most money went.
  const cheapest = [...report.platforms, ...report.ages, ...report.regions]
    .filter((row) => row.metaLeads >= 2 && row.cpl != null)
    .sort((a, b) => (a.cpl ?? 0) - (b.cpl ?? 0))[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {months.map((value) => (
          <Link
            key={value}
            href={`/admin/campanas/audiencia?mes=${value}`}
            scroll={false}
            aria-current={value === month ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors",
              value === month ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {monthLabel(value)}
          </Link>
        ))}
        <p className="ml-auto text-xs text-muted-foreground">Meta da los desgloses de este mes y el anterior.</p>
      </div>

      {cheapest ? (
        <div className="flex items-center gap-4 rounded-2xl border bg-linear-to-br from-emerald-50 to-card p-5 dark:from-emerald-500/10">
          <IconTile icon={Users} tone="emerald" size="lg" />
          <div>
            <p className="text-xs text-muted-foreground">Donde el lead sale más barato</p>
            <p className="text-lg font-semibold">
              {cheapest.label} · {money(cheapest.cpl)} por lead
            </p>
            <p className="text-xs text-muted-foreground">{cheapest.metaLeads} leads con {money(cheapest.spend)}. Considera darle más peso en el público.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card icon={MonitorSmartphone} tone="blue" title="Plataformas" hint="Gasto y leads según Meta por plataforma.">
          <BarList rows={rows(report.platforms, (row) => PLATFORM_TONES[row.key] ?? "indigo")} />
        </Card>
        <Card icon={LayoutGrid} tone="violet" title="Ubicaciones" hint="Feed, reels, historias… las 8 con más gasto.">
          <BarList rows={rows(report.placements)} tone="violet" />
        </Card>
        <Card icon={UsersRound} tone="amber" title="Edad" hint="Quién ve y responde, por rango de edad.">
          <BarList rows={rows(report.ages)} tone="amber" />
        </Card>
        <Card icon={Users} tone="pink" title="Sexo" hint="Reparto del gasto y costo por lead.">
          <BarList rows={rows(report.genders, (row) => (row.key === "female" ? "pink" : row.key === "male" ? "sky" : "zinc"))} />
        </Card>
        <Card icon={MapPin} tone="teal" title="Regiones" hint="Las 10 provincias con más gasto." className="lg:col-span-2">
          <BarList rows={rows(report.regions)} tone="teal" />
        </Card>
      </div>
    </div>
  );
}
