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

// Color por tipo: lo que hiciste tú (llamada, WhatsApp…) se distingue de un
// vistazo de lo que registró el sistema.
const TINTS: Record<string, string> = {
  NOTE: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
  CALL: "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
  WHATSAPP: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  EMAIL: "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
  MEETING: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300",
  STAGE_CHANGE: "bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
  SYSTEM: "bg-muted text-muted-foreground",
};

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
    <ol>
      {activities.map((activity, index) => {
        const last = index === activities.length - 1;
        const Icon = ICONS[activity.type] ?? StickyNote;

        const text =
          activity.type === "STAGE_CHANGE"
            ? `${STAGE_LABELS[activity.fromStage ?? ""] ?? activity.fromStage} → ${
                STAGE_LABELS[activity.toStage ?? ""] ?? activity.toStage
              }`
            : activity.body;

        return (
          <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Línea que une los eventos, como una línea de tiempo. */}
            {!last ? (
              <span
                aria-hidden
                className="absolute left-[17px] top-10 bottom-1 w-px bg-border"
              />
            ) : null}
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${TINTS[activity.type] ?? TINTS.SYSTEM}`}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1 pt-1">
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
