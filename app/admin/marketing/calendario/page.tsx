import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { AreaNav } from "@/components/admin/area-nav";
import { ChannelFilter } from "@/components/admin/marketing/channel-filter";
import { ImportPostsDialog } from "@/components/admin/marketing/import-posts-dialog";
import { PostChip, PostRow, STATUS_DOTS } from "@/components/admin/marketing/post-chip";
import { MarketingSummary } from "@/components/admin/marketing/summary-strip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dayKeyInAppZone } from "@/lib/admin/format";
import {
  getPostsInRange,
  getUnscheduledPosts,
  type PostCardDTO,
} from "@/lib/admin/queries/marketing";
import {
  addDays,
  addMonths,
  isDayKey,
  longDayLabel,
  monthGrid,
  monthLabel,
  rangeLabel,
  sameMonth,
  shortDayLabel,
  WEEKDAY_HEADERS,
  weekDays,
} from "@/lib/marketing/calendar";
import {
  CHANNELS,
  CONTENT_CHANNELS,
  STATUS_LABELS,
  isChannel,
  type ContentChannelValue,
} from "@/lib/marketing/constants";
import { dayKeyStart } from "@/lib/marketing/schedule";
import { cn } from "@/lib/utils";

const VIEWS = ["mes", "semana", "lista"] as const;
type View = (typeof VIEWS)[number];

type Params = { vista?: string; fecha?: string; canal?: string };

function hrefFor(params: { vista: View; fecha: string; canal?: string }) {
  const search = new URLSearchParams({ vista: params.vista, fecha: params.fecha });
  if (params.canal) search.set("canal", params.canal);
  return `/admin/marketing/calendario?${search}`;
}

function groupByDay(posts: PostCardDTO[]) {
  const groups = new Map<string, PostCardDTO[]>();
  for (const post of posts) {
    if (!post.dayKey) continue;
    groups.set(post.dayKey, [...(groups.get(post.dayKey) ?? []), post]);
  }
  return groups;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const vista: View = VIEWS.includes(params.vista as View) ? (params.vista as View) : "mes";
  const today = dayKeyInAppZone(new Date());
  const fecha = isDayKey(params.fecha) ? params.fecha : today;
  const canal = isChannel(params.canal) ? params.canal : undefined;

  const step =
    vista === "mes"
      ? { prev: addMonths(fecha, -1), next: addMonths(fecha, 1) }
      : vista === "semana"
        ? { prev: addDays(fecha, -7), next: addDays(fecha, 7) }
        : { prev: addDays(fecha, -14), next: addDays(fecha, 14) };

  const week = weekDays(fecha);
  const period =
    vista === "mes"
      ? monthLabel(fecha)
      : vista === "semana"
        ? rangeLabel(week[0], week[6])
        : fecha === today
          ? "Próximos 14 días"
          : rangeLabel(fecha, addDays(fecha, 13));

  return (
    <div className="space-y-4">
      <Suspense fallback={<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[76px] rounded-2xl sm:h-[92px]" />)}</div>}>
        <MarketingSummary />
      </Suspense>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border">
            <Button asChild variant="ghost" size="icon-sm" className="rounded-r-none max-sm:size-10">
              <Link href={hrefFor({ vista, fecha: step.prev, canal })} aria-label="Período anterior">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-none border-x max-sm:h-10">
              <Link href={hrefFor({ vista, fecha: today, canal })}>Hoy</Link>
            </Button>
            <Button asChild variant="ghost" size="icon-sm" className="rounded-l-none max-sm:size-10">
              <Link href={hrefFor({ vista, fecha: step.next, canal })} aria-label="Período siguiente">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
          <h2 className="text-base font-semibold sm:text-lg">{period}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <AreaNav
            active={vista}
            className="mb-0 border-b-0"
            items={VIEWS.map((key) => ({
              key,
              label: key === "mes" ? "Mes" : key === "semana" ? "Semana" : "Lista",
              href: hrefFor({ vista: key, fecha, canal }),
            }))}
          />
          <ChannelFilter current={canal ?? "all"} />
          <ImportPostsDialog />
          <Button asChild size="sm" className="max-sm:h-10">
            <Link href={`/admin/marketing/calendario/nuevo?fecha=${fecha === today ? today : fecha}`}>
              <Plus className="size-3.5" />
              Nuevo post
            </Link>
          </Button>
        </div>
      </div>

      <Suspense key={`${vista}-${fecha}-${canal ?? ""}`} fallback={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
        {vista === "mes" ? (
          <MonthView fecha={fecha} today={today} canal={canal} />
        ) : vista === "semana" ? (
          <WeekView days={week} today={today} canal={canal} />
        ) : (
          <ListView from={fecha} canal={canal} />
        )}
      </Suspense>

      <Legend />
    </div>
  );
}

async function MonthView({
  fecha,
  today,
  canal,
}: {
  fecha: string;
  today: string;
  canal?: ContentChannelValue;
}) {
  const weeks = monthGrid(fecha);
  const posts = await getPostsInRange(
    dayKeyStart(weeks[0][0]),
    dayKeyStart(addDays(weeks.at(-1)!.at(-1)!, 1)),
    canal,
  );
  const byDay = groupByDay(posts);

  const selected = byDay.get(fecha) ?? [];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAY_HEADERS.map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((day) => {
            const items = byDay.get(day) ?? [];
            const outside = !sameMonth(day, fecha);
            const isSelected = day === fecha;

            return (
              <div
                key={day}
                className={cn(
                  "group relative min-w-0 border-b border-r [&:nth-child(7n)]:border-r-0 sm:min-h-28 sm:p-1",
                  outside && "bg-muted/40 text-muted-foreground/60",
                )}
              >
                {/* Phone: the whole cell is a tap target that opens the day's agenda below. */}
                <Link
                  href={hrefFor({ vista: "mes", fecha: day, canal })}
                  scroll={false}
                  aria-label={`${longDayLabel(day)}: ${items.length ? `${items.length} publicación${items.length === 1 ? "" : "es"}` : "sin publicaciones"}`}
                  aria-current={isSelected ? "date" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center gap-1 py-1.5 sm:hidden",
                    isSelected && "bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                      day === today && "bg-primary font-semibold text-primary-foreground",
                      isSelected && day !== today && "ring-2 ring-primary",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {items.length ? (
                    <span className="flex flex-wrap justify-center gap-0.5 px-1">
                      {items.slice(0, 4).map((post) => (
                        <span key={post.id} className={cn("size-1.5 rounded-full", CHANNELS[post.channel].dot)} />
                      ))}
                    </span>
                  ) : null}
                </Link>

                <div className="hidden sm:block">
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                        day === today && "bg-primary font-semibold text-primary-foreground",
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <Link
                      href={`/admin/marketing/calendario/nuevo?fecha=${day}`}
                      aria-label={`Nuevo post el ${longDayLabel(day)}`}
                      className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Plus className="size-3.5" />
                    </Link>
                  </div>
                  <div className="space-y-0.5">
                    {items.slice(0, 4).map((post) => (
                      <PostChip key={post.id} post={post} />
                    ))}
                    {items.length > 4 ? (
                      <Link
                        href={hrefFor({ vista: "semana", fecha: day, canal })}
                        className="block px-1.5 text-xs text-muted-foreground hover:underline"
                      >
                        +{items.length - 4} más
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card sm:hidden">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold first-letter:uppercase">{longDayLabel(fecha)}</h3>
            <p className="text-xs text-muted-foreground">
              {selected.length
                ? `${selected.length} publicación${selected.length === 1 ? "" : "es"}`
                : "Toca un día para ver lo que sale."}
            </p>
          </div>
          <Button asChild variant="outline" size="icon-lg" className="rounded-full">
            <Link href={`/admin/marketing/calendario/nuevo?fecha=${fecha}`} aria-label={`Nuevo post el ${longDayLabel(fecha)}`}>
              <Plus className="size-4" />
            </Link>
          </Button>
        </div>
        {selected.length ? (
          <div className="divide-y">
            {selected.map((post) => (
              <PostRow key={post.id} post={post} timeOnly />
            ))}
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nada programado este día.</p>
        )}
      </div>
    </div>
  );
}

/** Week planner: one row per channel, one column per day. */
async function WeekView({
  days,
  today,
  canal,
}: {
  days: string[];
  today: string;
  canal?: ContentChannelValue;
}) {
  const posts = await getPostsInRange(dayKeyStart(days[0]), dayKeyStart(addDays(days[6], 1)), canal);
  const channels = canal
    ? [canal]
    : CONTENT_CHANNELS.filter(
        (channel) =>
          posts.some((post) => post.channel === channel) ||
          channel === "LINKEDIN_PERSONAL" ||
          channel === "GBP",
      );

  return (
    <>
    <div className="overflow-hidden rounded-2xl border bg-card sm:hidden">
      {days.map((day) => {
        const items = posts.filter((post) => post.dayKey === day);
        return (
          <div key={day} className="border-b last:border-b-0">
            <div
              className={cn(
                "flex items-center justify-between bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground",
                day === today && "text-foreground",
              )}
            >
              <span className="first-letter:uppercase">{longDayLabel(day)}</span>
              {day === today ? <span>Hoy</span> : null}
            </div>
            {items.length ? (
              <div className="divide-y">
                {items.map((post) => (
                  <PostRow key={post.id} post={post} timeOnly />
                ))}
              </div>
            ) : (
              <p className="px-4 py-2.5 text-xs text-muted-foreground">Sin publicaciones.</p>
            )}
          </div>
        );
      })}
    </div>
    <div className="hidden overflow-x-auto rounded-2xl border bg-card sm:block">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="w-32 px-3 py-2 text-left font-medium">Canal</th>
            {days.map((day) => (
              <th
                key={day}
                className={cn("px-2 py-2 text-left font-medium", day === today && "text-primary")}
              >
                {shortDayLabel(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {channels.map((channel) => (
            <tr key={channel} className="border-b last:border-b-0">
              <th className="px-3 py-2 text-left align-top text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", CHANNELS[channel].dot)} />
                  {CHANNELS[channel].short}
                </span>
              </th>
              {days.map((day) => (
                <td key={day} className={cn("border-l p-1 align-top", day === today && "bg-primary/5")}>
                  <div className="min-h-14 space-y-0.5">
                    {posts
                      .filter((post) => post.channel === channel && post.dayKey === day)
                      .map((post) => (
                        <PostChip key={post.id} post={post} showChannel={false} />
                      ))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

async function ListView({ from, canal }: { from: string; canal?: ContentChannelValue }) {
  const [posts, unscheduled] = await Promise.all([
    getPostsInRange(dayKeyStart(from), dayKeyStart(addDays(from, 14)), canal),
    getUnscheduledPosts(canal),
  ]);
  const byDay = groupByDay(posts);

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <div className="overflow-hidden rounded-2xl border bg-card">
        {byDay.size ? (
          [...byDay.entries()].map(([day, items]) => (
            <div key={day} className="border-b last:border-b-0">
              <div className="bg-muted/40 px-5 py-1.5 text-xs font-medium text-muted-foreground">
                {longDayLabel(day)}
              </div>
              <div className="divide-y">
                {items.map((post) => (
                  <PostRow key={post.id} post={post} timeOnly />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium">No hay publicaciones en estos 14 días.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea un post o importa un cronograma con «Importar».
            </p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold">Sin fecha</h3>
          <p className="text-xs text-muted-foreground">Borradores que todavía no están en el calendario.</p>
        </div>
        <div className="divide-y">
          {unscheduled.length ? (
            unscheduled.map((post) => <PostRow key={post.id} post={post} />)
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nada pendiente.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** What the chip colors and dots mean. */
function Legend() {
  const channels = ["LINKEDIN_PERSONAL", "GBP", "INSTAGRAM"] as const;
  const statuses = ["BORRADOR", "EN_REVISION", "APROBADO", "PROGRAMADO", "PUBLICADO"] as const;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {channels.map((channel) => (
        <span key={channel} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-5 rounded", CHANNELS[channel].chip)} />
          {CHANNELS[channel].short}
        </span>
      ))}
      <span className="h-3 w-px bg-border" />
      {statuses.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", STATUS_DOTS[status])} />
          {STATUS_LABELS[status]}
        </span>
      ))}
    </div>
  );
}
