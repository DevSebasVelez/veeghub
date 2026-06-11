"use client";

import { isToday, isTomorrow } from "date-fns";
import { CalendarPlus, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MEETING_BADGE_CLASSES,
  MEETING_DOT_CLASSES,
  MEETING_STATUS_LABELS,
  dayKey,
  formatDayLong,
  formatTimeRange,
  fromDayKey,
  groupByDay,
  type MeetingDTO,
} from "@/components/admin/meetings/utils";

function dayLabel(date: Date) {
  if (isToday(date)) return "Hoy";
  if (isTomorrow(date)) return "Mañana";
  return formatDayLong(date);
}

export function AgendaRow({
  meeting,
  onSelect,
}: {
  meeting: MeetingDTO;
  onSelect: (meeting: MeetingDTO) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(meeting)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(meeting);
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
    >
      <span
        className={cn(
          "h-9 w-1 shrink-0 rounded-full",
          MEETING_DOT_CLASSES[meeting.status],
        )}
      />
      <div className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
        {formatTimeRange(meeting)}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-sm font-medium",
            meeting.status === "CANCELLED" &&
              "text-muted-foreground line-through",
          )}
        >
          {meeting.title}
        </div>
        {meeting.clientName ? (
          <div className="truncate text-xs text-muted-foreground">
            {meeting.clientName}
          </div>
        ) : null}
      </div>
      <Badge
        variant="outline"
        className={cn(
          "hidden sm:inline-flex",
          MEETING_BADGE_CLASSES[meeting.status],
        )}
      >
        {MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
      </Badge>
      {meeting.meetLink && meeting.status === "SCHEDULED" ? (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <a
            href={meeting.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            <Video className="size-3.5" />
            <span className="hidden sm:inline">Unirse</span>
          </a>
        </Button>
      ) : null}
    </div>
  );
}

export function AgendaView({
  meetings,
  anchor,
  onSelect,
}: {
  meetings: MeetingDTO[];
  anchor: Date;
  onSelect: (meeting: MeetingDTO) => void;
}) {
  const anchorKey = dayKey(anchor);
  const byDay = groupByDay(meetings);
  const keys = [...byDay.keys()].filter((key) => key >= anchorKey).sort();

  if (!keys.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <CalendarPlus className="size-8 text-muted-foreground/50" />
        <div>
          <p className="font-medium">No hay reuniones próximas</p>
          <p className="text-sm text-muted-foreground">
            Crea una reunión para verla en tu agenda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {keys.map((key) => {
        const date = fromDayKey(key);
        return (
          <section key={key} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {dayLabel(date)}
            </h3>
            <div className="space-y-2">
              {byDay.get(key)!.map((meeting) => (
                <AgendaRow
                  key={meeting.id}
                  meeting={meeting}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
