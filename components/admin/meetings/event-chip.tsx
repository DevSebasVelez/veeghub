"use client";

import { cn } from "@/lib/utils";
import {
  MEETING_CHIP_CLASSES,
  formatTime,
  type MeetingDTO,
} from "@/components/admin/meetings/utils";

export function EventChip({
  meeting,
  onSelect,
}: {
  meeting: MeetingDTO;
  onSelect: (meeting: MeetingDTO) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(meeting);
      }}
      className={cn(
        "flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-xs font-medium transition-colors",
        MEETING_CHIP_CLASSES[meeting.status],
      )}
    >
      <span className="shrink-0 tabular-nums opacity-70">
        {formatTime(meeting.startsAt)}
      </span>
      <span className="truncate">{meeting.title}</span>
    </button>
  );
}
