"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { EventChip } from "@/components/admin/meetings/event-chip";
import {
  MEETING_DOT_CLASSES,
  dayKey,
  groupByDay,
  type MeetingDTO,
} from "@/components/admin/meetings/utils";

const WEEKDAY_LABELS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MAX_VISIBLE_CHIPS = 3;

export function MonthView({
  meetings,
  anchor,
  onSelect,
  onDayOpen,
}: {
  meetings: MeetingDTO[];
  anchor: Date;
  onSelect: (meeting: MeetingDTO) => void;
  onDayOpen: (key: string) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1, locale: es }),
    end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1, locale: es }),
  });
  const byDay = groupByDay(meetings);

  return (
    <div className="overflow-hidden rounded-xl border bg-border">
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-card px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {days.map((day) => {
          const key = dayKey(day);
          const dayMeetings = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, anchor);
          const today = isToday(day);
          const overflow = dayMeetings.length - MAX_VISIBLE_CHIPS;

          return (
            <div
              key={key}
              className={cn(
                "group/day relative flex min-h-20 flex-col gap-1 bg-card p-1.5 sm:min-h-28",
                !inMonth && "bg-muted/40",
              )}
            >
              <button
                type="button"
                onClick={() => onDayOpen(key)}
                className="absolute inset-0 sm:hidden"
                aria-label={`Ver reuniones del día ${day.getDate()}`}
              />
              <div className="flex justify-center sm:justify-start">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                    today
                      ? "bg-primary text-primary-foreground"
                      : !inMonth
                        ? "text-muted-foreground/50"
                        : "text-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Mobile: status dots */}
              <div className="flex flex-wrap justify-center gap-1 sm:hidden">
                {dayMeetings.slice(0, 4).map((meeting) => (
                  <span
                    key={meeting.id}
                    className={cn(
                      "size-1.5 rounded-full",
                      MEETING_DOT_CLASSES[meeting.status],
                    )}
                  />
                ))}
              </div>

              {/* Desktop: event chips */}
              <div className="hidden flex-col gap-0.5 sm:flex">
                {dayMeetings.slice(0, MAX_VISIBLE_CHIPS).map((meeting) => (
                  <EventChip
                    key={meeting.id}
                    meeting={meeting}
                    onSelect={onSelect}
                  />
                ))}
                {overflow > 0 ? (
                  <button
                    type="button"
                    onClick={() => onDayOpen(key)}
                    className="rounded px-1.5 py-0.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    +{overflow} más
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
