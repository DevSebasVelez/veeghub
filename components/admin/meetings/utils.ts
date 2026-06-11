import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { MeetingDTO } from "@/lib/admin/serialize";

export type { MeetingDTO };

export type MeetingStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export const MEETING_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Programada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

// Month-view chips and day-sheet rows.
export const MEETING_CHIP_CLASSES: Record<string, string> = {
  SCHEDULED:
    "bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-300",
  COMPLETED:
    "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300",
  CANCELLED:
    "bg-zinc-500/10 text-zinc-500 line-through hover:bg-zinc-500/20 dark:text-zinc-400",
};

// Week-view time blocks.
export const MEETING_BLOCK_CLASSES: Record<string, string> = {
  SCHEDULED:
    "border-blue-500 bg-blue-500/15 text-blue-800 hover:bg-blue-500/25 dark:text-blue-200",
  COMPLETED:
    "border-emerald-500 bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-200",
  CANCELLED:
    "border-zinc-400 bg-zinc-500/10 text-zinc-500 line-through hover:bg-zinc-500/20 dark:text-zinc-400",
};

export const MEETING_DOT_CLASSES: Record<string, string> = {
  SCHEDULED: "bg-blue-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-zinc-400",
};

export const MEETING_BADGE_CLASSES: Record<string, string> = {
  SCHEDULED:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  COMPLETED:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
};

export function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

// Local-noon construction so a "yyyy-MM-dd" string never drifts across DST.
export function fromDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function groupByDay(meetings: MeetingDTO[]) {
  const groups = new Map<string, MeetingDTO[]>();
  for (const meeting of meetings) {
    const key = dayKey(new Date(meeting.startsAt));
    const group = groups.get(key);
    if (group) {
      group.push(meeting);
    } else {
      groups.set(key, [meeting]);
    }
  }
  return groups;
}

export function formatTime(value: string) {
  return format(new Date(value), "HH:mm");
}

export function formatTimeRange(meeting: MeetingDTO) {
  return `${formatTime(meeting.startsAt)} – ${formatTime(meeting.endsAt)}`;
}

export function formatDayLong(date: Date) {
  const label = format(date, "EEEE d 'de' MMMM", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export type PositionedMeeting = {
  meeting: MeetingDTO;
  /** Percentages relative to a 24h column. */
  top: number;
  height: number;
  left: number;
  width: number;
};

const DAY_MINUTES = 24 * 60;
const MIN_BLOCK_MINUTES = 30;

// Greedy column packing: transitively overlapping meetings form a cluster and
// share the column width equally.
export function layoutDayMeetings(
  meetings: MeetingDTO[],
  day: Date,
): PositionedMeeting[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const base = dayStart.getTime();

  const items = meetings
    .map((meeting) => {
      const startMin = Math.max(
        0,
        (new Date(meeting.startsAt).getTime() - base) / 60000,
      );
      const endMin = Math.min(
        DAY_MINUTES,
        (new Date(meeting.endsAt).getTime() - base) / 60000,
      );
      return {
        meeting,
        startMin,
        endMin: Math.max(endMin, startMin + MIN_BLOCK_MINUTES),
        column: 0,
      };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const positioned: PositionedMeeting[] = [];
  let clusterStart = 0;

  const flushCluster = (end: number) => {
    const cluster = items.slice(clusterStart, end);
    const columnEnds: number[] = [];
    for (const item of cluster) {
      let column = columnEnds.findIndex((colEnd) => colEnd <= item.startMin);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(0);
      }
      columnEnds[column] = item.endMin;
      item.column = column;
    }
    const width = 100 / columnEnds.length;
    for (const item of cluster) {
      positioned.push({
        meeting: item.meeting,
        top: (item.startMin / DAY_MINUTES) * 100,
        height: ((item.endMin - item.startMin) / DAY_MINUTES) * 100,
        left: item.column * width,
        width,
      });
    }
  };

  let clusterEnd = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].startMin >= clusterEnd && i > clusterStart) {
      flushCluster(i);
      clusterStart = i;
      clusterEnd = -1;
    }
    clusterEnd = Math.max(clusterEnd, items[i].endMin);
  }
  if (items.length) flushCluster(items.length);

  return positioned;
}
