"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

type Column = { stage: string; leads: LeadCardData[] };

function columnTotal(leads: LeadCardData[]) {
  return leads.reduce((sum, lead) => sum + Number(lead.estimatedValue ?? 0), 0);
}

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
  const total = columnTotal(column.leads);
  const navigable = Boolean(onPrev || onNext);

  return (
    <header className="flex items-center gap-1 px-2 py-2 md:px-3 md:py-2.5">
      {navigable ? (
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Etapa anterior"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 active:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>
      ) : null}

      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">
          {STAGE_LABELS[column.stage]}
        </h2>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {column.leads.length}
          {total > 0 ? ` · ${formatCurrency(total)}` : ""}
        </span>
      </div>

      {navigable ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Etapa siguiente"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 active:bg-muted"
        >
          <ChevronRight className="size-4" />
        </button>
      ) : null}
    </header>
  );
}

function LeadList({ leads }: { leads: LeadCardData[] }) {
  if (leads.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-xs text-muted-foreground">
        Sin leads
      </p>
    );
  }

  return (
    <>
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} />
      ))}
    </>
  );
}

export function PipelineBoard({ columns }: { columns: Column[] }) {
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
                    <LeadList leads={column.leads} />
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
              <LeadList leads={column.leads} />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
