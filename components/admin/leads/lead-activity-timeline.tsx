import {
  ArrowRight,
  CalendarDays,
  Mail,
  MessageCircle,
  Phone,
  Settings,
  StickyNote,
} from "lucide-react";

import { formatDate } from "@/lib/admin/format";
import {
  ACTIVITY_LABELS,
  STAGE_LABELS,
} from "@/components/admin/leads/constants";

const ICONS: Record<string, typeof StickyNote> = {
  NOTE: StickyNote,
  CALL: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  MEETING: CalendarDays,
  STAGE_CHANGE: ArrowRight,
  SYSTEM: Settings,
};

export function LeadActivityTimeline({
  activities,
}: {
  activities: Array<{
    id: string;
    type: string;
    body: string | null;
    fromStage: string | null;
    toStage: string | null;
    occurredAt: Date;
  }>;
}) {
  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sin actividad registrada.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {activities.map((activity) => {
        const Icon = ICONS[activity.type] ?? StickyNote;

        const text =
          activity.type === "STAGE_CHANGE"
            ? `${STAGE_LABELS[activity.fromStage ?? ""] ?? activity.fromStage} → ${
                STAGE_LABELS[activity.toStage ?? ""] ?? activity.toStage
              }`
            : activity.body;

        return (
          <li key={activity.id} className="flex gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">
                  {ACTIVITY_LABELS[activity.type] ?? activity.type}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(activity.occurredAt)}
                </span>
              </div>
              {text ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {text}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
