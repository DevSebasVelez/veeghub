import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

import { MeetingsCalendar } from "@/components/admin/meetings/meetings-calendar";
import { forMeeting } from "@/lib/admin/serialize";
import {
  getClientOptions,
  getMeetingsInRange,
} from "@/lib/admin/queries/meetings";

const VIEWS = ["mes", "semana", "agenda"] as const;
type CalendarView = (typeof VIEWS)[number];

function parseView(value: string | undefined): CalendarView {
  return VIEWS.includes(value as CalendarView)
    ? (value as CalendarView)
    : "mes";
}

// Anchor at local noon (same trick as date-picker-field) so DST edges and
// timezone offsets never shift the visible day.
function parseAnchor(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Fetch range padded ±1 day so events near boundaries survive any
// server/browser timezone difference.
function rangeFor(view: CalendarView, anchor: Date) {
  if (view === "semana") {
    return {
      start: subDays(startOfWeek(anchor, { weekStartsOn: 1 }), 1),
      end: addDays(endOfWeek(anchor, { weekStartsOn: 1 }), 1),
    };
  }
  if (view === "agenda") {
    return {
      start: subDays(startOfDay(anchor), 1),
      end: addDays(anchor, 31),
    };
  }
  return {
    start: subDays(startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }), 1),
    end: addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 1),
  };
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string }>;
}) {
  const { vista: vistaParam, fecha: fechaParam } = await searchParams;
  const vista = parseView(vistaParam);
  const anchor = parseAnchor(fechaParam);
  const { start, end } = rangeFor(vista, anchor);

  const [meetings, clients] = await Promise.all([
    getMeetingsInRange(start, end),
    getClientOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reuniones</h1>
        <p className="text-sm text-muted-foreground">
          Agenda y calendario de reuniones con tus clientes.
        </p>
      </div>

      <MeetingsCalendar
        meetings={meetings.map(forMeeting)}
        clients={clients}
        vista={vista}
        fecha={toIsoDate(anchor)}
      />
    </div>
  );
}
