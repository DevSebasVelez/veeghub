"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  isToday,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MeetingDialog } from "@/components/admin/dialogs/meeting-dialog";
import type { EntityOption } from "@/components/admin/dialogs/_base";
import { AgendaRow, AgendaView } from "@/components/admin/meetings/agenda-view";
import { MeetingDetailsDialog } from "@/components/admin/meetings/meeting-details-dialog";
import { MonthView } from "@/components/admin/meetings/month-view";
import { WeekView } from "@/components/admin/meetings/week-view";
import {
  dayKey,
  formatDayLong,
  fromDayKey,
  groupByDay,
  type MeetingDTO,
} from "@/components/admin/meetings/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CalendarView = "mes" | "semana" | "agenda";

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function MeetingsCalendar({
  meetings,
  clients,
  vista,
  fecha,
}: {
  meetings: MeetingDTO[];
  clients: EntityOption[];
  vista: CalendarView;
  fecha: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<MeetingDTO | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  const anchor = fromDayKey(fecha);

  function navigate(view: CalendarView, date: Date) {
    router.push(`/admin/reuniones?vista=${view}&fecha=${dayKey(date)}`);
  }

  function step(direction: 1 | -1) {
    if (vista === "mes") {
      navigate(
        vista,
        direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1),
      );
    } else if (vista === "semana") {
      navigate(
        vista,
        direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1),
      );
    } else {
      navigate(
        vista,
        direction === 1 ? addDays(anchor, 30) : subDays(anchor, 30),
      );
    }
  }

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1, locale: es });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1, locale: es });
  const periodLabel =
    vista === "mes"
      ? capitalize(format(anchor, "MMMM yyyy", { locale: es }))
      : vista === "semana"
        ? `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`
        : isToday(anchor)
          ? "Próximos 30 días"
          : `Desde el ${format(anchor, "d 'de' MMMM", { locale: es })}`;

  const dayMeetings = dayOpen ? (groupByDay(meetings).get(dayOpen) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-r-none"
              onClick={() => step(-1)}
              aria-label="Período anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-none border-x"
              onClick={() => navigate(vista, new Date())}
            >
              Hoy
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-l-none"
              onClick={() => step(1)}
              aria-label="Período siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold sm:text-lg">{periodLabel}</h2>
        </div>

        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <Tabs
            value={vista}
            onValueChange={(value) => navigate(value as CalendarView, anchor)}
          >
            <TabsList>
              <TabsTrigger value="mes">Mes</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
          </Tabs>
          <MeetingDialog mode="create" clients={clients} defaultDate={fecha} />
        </div>
      </div>

      {vista === "mes" ? (
        <MonthView
          meetings={meetings}
          anchor={anchor}
          onSelect={setSelected}
          onDayOpen={setDayOpen}
        />
      ) : vista === "semana" ? (
        <WeekView meetings={meetings} anchor={anchor} onSelect={setSelected} />
      ) : (
        <AgendaView
          meetings={meetings}
          anchor={anchor}
          onSelect={setSelected}
        />
      )}

      <MeetingDetailsDialog
        meeting={selected}
        clients={clients}
        onClose={() => setSelected(null)}
      />

      <Sheet
        open={!!dayOpen}
        onOpenChange={(open) => !open && setDayOpen(null)}
      >
        <SheetContent side="bottom" className="max-h-[80svh] overflow-y-auto">
          <SheetHeader className="pb-0 text-left">
            <SheetTitle>
              {dayOpen ? formatDayLong(fromDayKey(dayOpen)) : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-2 px-4 pb-6">
            {dayMeetings.map((meeting) => (
              <AgendaRow
                key={meeting.id}
                meeting={meeting}
                onSelect={(m) => {
                  setDayOpen(null);
                  setSelected(m);
                }}
              />
            ))}
            {!dayMeetings.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay reuniones este día.
              </p>
            ) : null}
            <div className="flex justify-end pt-2">
              <MeetingDialog
                mode="create"
                clients={clients}
                defaultDate={dayOpen ?? fecha}
                onSaved={() => setDayOpen(null)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
