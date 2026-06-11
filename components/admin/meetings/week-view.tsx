"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import {
  MEETING_BLOCK_CLASSES,
  dayKey,
  formatTimeRange,
  groupByDay,
  layoutDayMeetings,
  type MeetingDTO,
} from "@/components/admin/meetings/utils";

const HOUR_HEIGHT = 64; // px, matches h-16
const SCROLL_TO_HOUR = 7;

function subscribeToMinute(callback: () => void) {
  const interval = setInterval(callback, 60_000);
  return () => clearInterval(interval);
}

// Server snapshot is null so SSR and hydration match; the real time appears
// right after hydration and ticks every minute.
function useCurrentMinute() {
  return useSyncExternalStore(
    subscribeToMinute,
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
}

export function WeekView({
  meetings,
  anchor,
  onSelect,
}: {
  meetings: MeetingDTO[];
  anchor: Date;
  onSelect: (meeting: MeetingDTO) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentMinute = useCurrentMinute();
  const now = currentMinute === null ? null : new Date(currentMinute * 60_000);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: SCROLL_TO_HOUR * HOUR_HEIGHT });
  }, []);

  const days = eachDayOfInterval({
    start: startOfWeek(anchor, { weekStartsOn: 1, locale: es }),
    end: endOfWeek(anchor, { weekStartsOn: 1, locale: es }),
  });
  const byDay = groupByDay(meetings);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const nowOffset = now
    ? ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100
    : 0;

  return (
    <div
      ref={scrollRef}
      className="max-h-[70svh] overflow-auto overscroll-contain rounded-xl border bg-card"
    >
      <div className="min-w-4xl">
        <div className="sticky top-0 z-30 grid grid-cols-[3.25rem_repeat(7,1fr)] border-b bg-card/95 backdrop-blur">
          <div className="sticky left-0 z-10 bg-card" />
          {days.map((day) => {
            const today = isToday(day);
            return (
              <div
                key={dayKey(day)}
                className="flex items-center justify-center gap-1.5 border-l py-2 text-sm"
              >
                <span className="capitalize text-muted-foreground">
                  {format(day, "EEE", { locale: es })}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-semibold",
                    today && "bg-primary text-primary-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[3.25rem_repeat(7,1fr)]">
          <div className="sticky left-0 z-20 bg-card">
            {hours.map((hour) => (
              <div key={hour} className="relative h-16">
                {hour > 0 ? (
                  <span className="absolute -top-2 right-2 text-[10px] tabular-nums text-muted-foreground">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const positioned = layoutDayMeetings(
              byDay.get(dayKey(day)) ?? [],
              day,
            );
            const showNow = now ? isSameDay(day, now) : false;

            return (
              <div key={dayKey(day)} className="relative border-l">
                {hours.map((hour) => (
                  <div key={hour} className="h-16 border-b border-border/60" />
                ))}

                {positioned.map(({ meeting, top, height, left, width }) => (
                  <button
                    key={meeting.id}
                    type="button"
                    onClick={() => onSelect(meeting)}
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      left: `${left}%`,
                      width: `calc(${width}% - 3px)`,
                    }}
                    className={cn(
                      "absolute z-10 overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left text-xs transition-colors",
                      MEETING_BLOCK_CLASSES[meeting.status],
                    )}
                  >
                    <div className="truncate font-medium">{meeting.title}</div>
                    <div className="truncate tabular-nums opacity-70">
                      {formatTimeRange(meeting)}
                    </div>
                  </button>
                ))}

                {showNow ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20"
                    style={{ top: `${nowOffset}%` }}
                  >
                    <div className="relative h-px bg-red-500">
                      <span className="absolute -left-1 top-[-3.5px] size-2 rounded-full bg-red-500" />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
