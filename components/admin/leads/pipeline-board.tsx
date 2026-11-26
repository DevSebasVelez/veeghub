"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { loadMorePipelineLeads } from "@/lib/admin/actions/leads/actions";
import { Button } from "@/components/ui/button";

import { LeadCard } from "@/components/admin/leads/lead-card";
import { STAGE_LABELS } from "@/components/admin/leads/constants";
import { formatCurrency } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import type { LeadCardData } from "@/components/admin/leads/types";

/** `total` and `value` cover the whole stage; `leads` is the loaded slice. */
type Column = { stage: string; leads: LeadCardData[]; total: number; value: number };

function ColumnHeader({
  column,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  column: Column;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}) {
  const total = column.value;
  const navigable = Boolean(onPrev || onNext);

  return (
    <header className="flex items-center gap-1 px-2 py-2 md:px-3 md:py-2.5">
      {navigable ? (
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Etapa anterior"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 active:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>
      ) : null}

      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">
          {STAGE_LABELS[column.stage]}
        </h2>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {column.total}
          {total > 0 ? ` · ${formatCurrency(total)}` : ""}
        </span>
      </div>

      {navigable ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Etapa siguiente"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 active:bg-muted"
        >
          <ChevronRight className="size-4" />
        </button>
      ) : null}
    </header>
  );
}

function LeadList({
  column,
  onMore,
  loading,
}: {
  column: Column;
  onMore: () => void;
  loading: boolean;
}) {
  if (column.leads.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-xs text-muted-foreground">
        Sin leads
      </p>
    );
  }

  const remaining = column.total - column.leads.length;

  return (
    <>
      {column.leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} />
      ))}
      {remaining > 0 ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onMore}
          disabled={loading}
          className="h-10 w-full text-muted-foreground"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
          Cargar más ({remaining})
        </Button>
      ) : null}
    </>
  );
}

/**
 * Extra batches per stage. Tied to the server's first batches: after a
 * refresh (a card changed stage) they are dropped, so a moved lead never
 * shows in two columns.
 */
function usePagedColumns(columns: Column[]) {
  const signature = columns.map((column) => column.leads.map((lead) => lead.id).join(",")).join("|");
  const [state, setState] = useState<{ signature: string; extra: Record<string, LeadCardData[]> }>({ signature, extra: {} });
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const extra = state.signature === signature ? state.extra : {};

  const merged = columns.map((column) => {
    const seen = new Set(column.leads.map((lead) => lead.id));
    const more = (extra[column.stage] ?? []).filter((lead) => !seen.has(lead.id));
    return { ...column, leads: [...column.leads, ...more] };
  });

  function loadMore(stage: string) {
    const column = merged.find((item) => item.stage === stage);
    if (!column) return;
    setLoadingStage(stage);
    startTransition(async () => {
      const result = await loadMorePipelineLeads(stage, column.leads.length);
      setLoadingStage(null);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudieron cargar más leads.");
        return;
      }
      setState({ signature, extra: { ...extra, [stage]: [...(extra[stage] ?? []), ...result.data] } });
    });
  }

  return { columns: merged, loadMore, loadingStage };
}

export function PipelineBoard({ columns: initial }: { columns: Column[] }) {
  const { columns, loadMore, loadingStage } = usePagedColumns(initial);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;

    const sync = () => setCurrent(api.selectedScrollSnap());

    sync();
    api.on("select", sync);

    return () => {
      api.off("select", sync);
    };
  }, [api]);

  return (
    <>
      {/*
        Phone: one stage per slide at full width, changed by swiping or with
        the chevrons already inside the column header — no filter row above the
        board, which would just push the cards further down.
      */}
      <div className="md:hidden">
        <Carousel setApi={setApi} opts={{ align: "start", containScroll: "trimSnaps" }}>
          <CarouselContent className="-ml-0">
            {columns.map((column, index) => (
              <CarouselItem key={column.stage} className="basis-full pl-0">
                <div className="rounded-lg bg-muted/40">
                  <ColumnHeader
                    column={column}
                    onPrev={() => api?.scrollPrev()}
                    onNext={() => api?.scrollNext()}
                    canPrev={index > 0}
                    canNext={index < columns.length - 1}
                  />
                  <div className="flex flex-col gap-2 px-2 pb-2">
                    <LeadList column={column} onMore={() => loadMore(column.stage)} loading={loadingStage === column.stage} />
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Dots: which stage you are on, in 6px of height. */}
        <div className="mt-2 flex justify-center gap-1.5">
          {columns.map((column, index) => (
            <button
              key={column.stage}
              type="button"
              onClick={() => api?.scrollTo(index)}
              aria-label={`Ir a ${STAGE_LABELS[column.stage]}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === current
                  ? "w-5 bg-primary"
                  : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-3 xl:grid-cols-5">
        {columns.map((column) => (
          <section
            key={column.stage}
            className="flex min-w-0 flex-col rounded-lg bg-muted/40"
          >
            <ColumnHeader column={column} />
            <div className="flex flex-col gap-2 px-2 pb-2">
              <LeadList column={column} onMore={() => loadMore(column.stage)} loading={loadingStage === column.stage} />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
