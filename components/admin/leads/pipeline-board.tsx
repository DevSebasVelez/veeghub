import { LeadCard } from "@/components/admin/leads/lead-card";
import { STAGE_LABELS } from "@/components/admin/leads/constants";
import { formatCurrency } from "@/lib/admin/format";
import type { LeadCardData } from "@/components/admin/leads/types";

export function PipelineBoard({
  columns,
}: {
  columns: Array<{ stage: string; leads: LeadCardData[] }>;
}) {
  return (
    <div className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:snap-none md:px-0">
      <div className="flex min-w-max gap-3 md:grid md:min-w-0 md:grid-cols-3 xl:grid-cols-5">
        {columns.map((column) => {
          const total = column.leads.reduce(
            (sum, lead) => sum + Number(lead.estimatedValue ?? 0),
            0,
          );

          return (
            <section
              key={column.stage}
              className="flex w-[85vw] max-w-[20rem] shrink-0 snap-start flex-col rounded-lg bg-muted/40 md:w-auto md:max-w-none md:shrink"
            >
              <header className="flex items-baseline justify-between gap-2 px-3 py-2.5">
                <h2 className="text-sm font-semibold">
                  {STAGE_LABELS[column.stage]}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {column.leads.length}
                  {total > 0 ? ` · ${formatCurrency(total)}` : ""}
                </span>
              </header>

              <div className="flex flex-col gap-2 px-2 pb-2">
                {column.leads.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                    Sin leads
                  </p>
                ) : (
                  column.leads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
