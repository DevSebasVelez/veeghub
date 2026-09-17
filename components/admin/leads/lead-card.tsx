"use client";

import Link from "next/link";
import { CalendarClock, Megaphone } from "lucide-react";

import { formatCurrency } from "@/lib/admin/format";
import { LeadQuickActions } from "@/components/admin/leads/lead-quick-actions";
import { LeadStageSelect } from "@/components/admin/leads/lead-stage-select";
import {
  SOURCE_LABELS,
  STALE_MINUTES,
  minutesSince,
  shortAge,
} from "@/components/admin/leads/constants";
import type { LeadCardData } from "@/components/admin/leads/types";

export function LeadCard({ lead }: { lead: LeadCardData }) {
  // A NEW lead going cold is the one thing this board must shout about.
  const stale =
    lead.stage === "NEW" && minutesSince(lead.createdAt) >= STALE_MINUTES;

  const followUpDue =
    lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= new Date();

  return (
    <div
      className={`rounded-lg border bg-card p-3 shadow-sm transition-colors ${
        stale
          ? "border-destructive/50 bg-destructive/5"
          : "hover:border-foreground/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/admin/leads/${lead.id}`}
          className="min-w-0 flex-1 font-medium leading-tight underline-offset-4 hover:underline"
        >
          {lead.name}
        </Link>
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            stale ? "font-medium text-destructive" : "text-muted-foreground"
          }`}
        >
          {shortAge(lead.createdAt)}
        </span>
      </div>

      {lead.company ? (
        <p className="truncate text-xs text-muted-foreground">{lead.company}</p>
      ) : null}

      {lead.phone ? (
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {lead.phone}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {lead.serviceTag ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
            {lead.serviceTag}
          </span>
        ) : null}
        {lead.estimatedValue ? (
          <span className="text-[11px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(lead.estimatedValue)}
          </span>
        ) : null}
      </div>

      {lead.metaCampaignName ? (
        <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <Megaphone className="size-3 shrink-0" />
          <span className="truncate">{lead.metaCampaignName}</span>
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {SOURCE_LABELS[lead.source] ?? lead.source}
        </p>
      )}

      {followUpDue ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <CalendarClock className="size-3" />
          Seguimiento pendiente
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
        <LeadStageSelect
          id={lead.id}
          stage={lead.stage}
          className="w-32 max-w-[60%]"
        />
        <LeadQuickActions
          id={lead.id}
          name={lead.name}
          phone={lead.phone}
          email={lead.email}
          contacted={Boolean(lead.firstContactedAt)}
        />
      </div>
    </div>
  );
}
