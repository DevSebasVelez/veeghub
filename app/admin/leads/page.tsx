import Link from "next/link";
import { Flame, Inbox, Plug, TrendingUp, Trophy } from "lucide-react";

import {
  getLeadStats,
  getLeadsPageData,
  getPipelineLeads,
} from "@/lib/admin/queries/leads";
import { forLeadCard } from "@/components/admin/leads/types";
import { CreateLeadDialog } from "@/components/admin/dialogs/lead-dialog";
import { LeadFilters } from "@/components/admin/leads/lead-filters";
import { LeadTable } from "@/components/admin/leads/lead-table";
import { Pagination } from "@/components/admin/pagination";
import { PipelineBoard } from "@/components/admin/leads/pipeline-board";
import { Card, CardContent } from "@/components/ui/card";
import { AreaNav } from "@/components/admin/area-nav";

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: typeof Inbox;
  tone?: "default" | "alert";
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9 ${
            tone === "alert"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold tabular-nums sm:text-xl">
            {value}
          </div>
          <div className="truncate text-[11px] leading-tight text-muted-foreground sm:text-xs">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    stage?: string;
    source?: string;
    q?: string;
    vista?: string;
  }>;
}) {
  const filters = await searchParams;

  const view = filters.vista === "lista" ? "lista" : "pipeline";

  // Only the visible view is queried. Fetching both meant every load paid for
  // the whole pipeline plus a filtered, paginated list, and showed one of them.
  const [stats, columns, listData] = await Promise.all([
    getLeadStats(),
    view === "pipeline" ? getPipelineLeads() : Promise.resolve(null),
    view === "lista" ? getLeadsPageData(filters) : Promise.resolve(null),
  ]);

  const boardColumns =
    columns?.map((column) => ({
      stage: column.stage as string,
      leads: column.leads.map(forLeadCard),
    })) ?? [];

  const listLeads = listData?.leads.map(forLeadCard) ?? [];

  const viewHref = (value: string) => {
    const next = new URLSearchParams();
    if (value === "lista") next.set("vista", "lista");
    if (filters.stage) next.set("stage", filters.stage);
    if (filters.source) next.set("source", filters.source);
    if (filters.q) next.set("q", filters.q);

    const qs = next.toString();
    return qs ? `/admin/leads?${qs}` : "/admin/leads";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {stats.openCount} en el pipeline · {stats.newCount} sin contactar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/leads/configuracion"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted"
          >
            <Plug className="size-3.5" />
            Integración Meta
          </Link>
          <CreateLeadDialog />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatCard label="Sin contactar" value={stats.newCount} icon={Inbox} />
        <StatCard
          label="Enfriándose (+2 h)"
          value={stats.staleCount}
          icon={Flame}
          tone={stats.staleCount > 0 ? "alert" : "default"}
        />
        <StatCard
          label="Seguimientos vencidos"
          value={stats.followUpsDue}
          icon={TrendingUp}
          tone={stats.followUpsDue > 0 ? "alert" : "default"}
        />
        <StatCard label="Ganados" value={stats.wonCount} icon={Trophy} />
      </div>

      <AreaNav
        active={view}
        items={[
          { key: "pipeline", label: "Pipeline", href: viewHref("pipeline") },
          { key: "lista", label: "Lista", href: viewHref("lista") },
        ]}
      />

      {view === "pipeline" ? (
        <PipelineBoard columns={boardColumns} />
      ) : (
        <div className="space-y-4">
          <LeadFilters />
          <LeadTable leads={listLeads} />
          {listData ? (
            <Pagination
              page={listData.page}
              pageSize={listData.pageSize}
              total={listData.total}
              basePath="/admin/leads"
              searchParams={{
                stage: filters.stage,
                source: filters.source,
                q: filters.q,
                vista: "lista",
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
