import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Clapperboard, Clock, Flame, Lightbulb, Search, Send, Video } from "lucide-react";

import { IdeaCategoryTag, IdeaStageBadge, categoryTone } from "@/components/admin/marketing/idea-badge";
import { KpiCard, IconTile, TONE_SOLID, ToneTag } from "@/components/admin/tone";
import { ImportIdeasDialog } from "@/components/admin/marketing/import-ideas-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getIdeaFacets,
  getIdeas,
  type IdeaCardDTO,
  type IdeaFilters,
} from "@/lib/admin/queries/marketing";
import { IDEA_STAGES, IDEA_STAGE_LABELS, isIdeaStage, type IdeaStage } from "@/lib/marketing/constants";
import { cn } from "@/lib/utils";

type Params = { q?: string; sector?: string; categoria?: string; etapa?: string; prioridad?: string };

const selectClass =
  "h-10 min-w-0 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-9 dark:bg-input/30";

function stageHref(stage: IdeaStage) {
  return `/admin/marketing/ideas?etapa=${stage}`;
}

export default async function IdeasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const priority = Number(params.prioridad);
  const filters: IdeaFilters = {
    q: params.q?.trim() || undefined,
    sector: params.sector?.trim() || undefined,
    category: params.categoria?.trim() || undefined,
    stage: isIdeaStage(params.etapa) ? params.etapa : undefined,
    priority: Number.isInteger(priority) && priority > 0 ? priority : undefined,
  };
  const facets = await getIdeaFacets();
  const filterKey = JSON.stringify(filters);
  const filtered = Object.values(filters).some(Boolean);
  const total = Object.entries(facets.stages).reduce(
    (sum, [stage, count]) => (stage === "ARCHIVADO" ? sum : sum + (count ?? 0)),
    0,
  );

  if (!total && !facets.stages.ARCHIVADO) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
        <IconTile icon={Lightbulb} tone="amber" size="lg" className="mx-auto" />
        <h2 className="mt-4 text-base font-semibold">El banco de ideas está vacío</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Importa los 5 HTML de <code>MARKETING/Banco de Ideas</code> para traer los ~199 guiones de
          reels con su gancho, caso, giro, solución y cierre.
        </p>
        <div className="mt-5 flex justify-center">
          <ImportIdeasDialog primary />
        </div>
      </div>
    );
  }

  const tiles = [
    { stage: undefined, icon: Lightbulb, tone: "amber" as const, label: "Ideas activas", value: total, helper: "Sin contar archivadas" },
    { stage: "GUION" as const, icon: Clapperboard, tone: "blue" as const, label: "Listas para grabar", value: facets.stages.GUION ?? 0, helper: "Abre el teleprompter" },
    { stage: "GRABADO" as const, icon: Video, tone: "rose" as const, label: "Por editar", value: facets.stages.GRABADO ?? 0, helper: "Grabadas, sin editar" },
    { stage: "PUBLICADO" as const, icon: Send, tone: "emerald" as const, label: "Publicadas", value: facets.stages.PUBLICADO ?? 0, helper: "Con su URL" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map(({ stage, icon, tone, label, value, helper }) => (
          <KpiCard
            key={label}
            href={stage ? stageHref(stage) : "/admin/marketing/ideas"}
            active={Boolean(filters.stage === stage && (stage || !filtered))}
            icon={icon}
            tone={tone}
            label={label}
            value={String(value)}
            helper={helper}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        {/* key: uncontrolled inputs reset when the URL changes. */}
        <Form key={filterKey} action="/admin/marketing/ideas" className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Buscar en títulos y guiones"
              aria-label="Buscar"
              className="h-10 w-full pl-8 sm:h-9 sm:w-64"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <select name="categoria" defaultValue={filters.category ?? ""} className={selectClass} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {facets.categories.map(({ value, count }) => (
                <option key={value} value={value}>
                  {value} ({count})
                </option>
              ))}
            </select>
            <select name="etapa" defaultValue={filters.stage ?? ""} className={selectClass} aria-label="Etapa">
              <option value="">Etapa: activas</option>
              {IDEA_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {IDEA_STAGE_LABELS[stage]} ({facets.stages[stage] ?? 0})
                </option>
              ))}
            </select>
            <select name="sector" defaultValue={filters.sector ?? ""} className={cn(selectClass, "sm:max-w-56")} aria-label="Sector">
              <option value="">Todos los sectores</option>
              {facets.sectors.map(({ value, count }) => (
                <option key={value} value={value}>
                  {value} ({count})
                </option>
              ))}
            </select>
            <select name="prioridad" defaultValue={filters.priority ?? ""} className={selectClass} aria-label="Prioridad">
              <option value="">Cualquier prioridad</option>
              <option value="1">Prioridad 1</option>
              <option value="2">Prioridad 2</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="secondary" className="max-sm:h-10 max-sm:flex-1">
              Filtrar
            </Button>
            {filtered ? (
              <Button asChild size="sm" variant="ghost" className="max-sm:h-10">
                <Link href="/admin/marketing/ideas">Limpiar</Link>
              </Button>
            ) : null}
          </div>
        </Form>
        <ImportIdeasDialog />
      </div>

      <Suspense key={filterKey} fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <IdeaGrid filters={filters} filtered={filtered} />
      </Suspense>
    </div>
  );
}

async function IdeaGrid({ filters, filtered }: { filters: IdeaFilters; filtered: boolean }) {
  const ideas = await getIdeas(filters);

  if (!ideas.length) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
        <p className="text-sm font-medium">{filtered ? "Ninguna idea coincide." : "No hay ideas activas."}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered ? "Prueba con menos filtros o con otra palabra." : "Revisa las archivadas en el filtro de etapa."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {ideas.length} idea{ideas.length === 1 ? "" : "s"}
      </p>
      <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </ul>
    </div>
  );
}

function IdeaCard({ idea }: { idea: IdeaCardDTO }) {
  const href = `/admin/marketing/ideas/${idea.id}`;

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-5 pt-6 transition-colors hover:bg-accent/30">
      {/* Category stripe: the bank's five categories read at a glance. */}
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", TONE_SOLID[categoryTone(idea.category)])} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <IdeaCategoryTag category={idea.category} />
          {idea.priority === 1 ? (
            <ToneTag tone="orange" icon={Flame}>
              Prioridad 1
            </ToneTag>
          ) : null}
        </div>
        <IdeaStageBadge stage={idea.stage} />
      </div>

      <h3 className="mt-3 text-sm font-semibold leading-snug">
        <Link href={href} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
          {idea.title}
        </Link>
      </h3>
      {idea.hook ? (
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">«{idea.hook}»</p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {idea.sector ? <span className="truncate">{idea.sector}</span> : null}
          {idea.seconds ? (
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              {idea.sector ? <span aria-hidden>·</span> : null}
              <Clock className="size-3" aria-hidden /> ~{idea.seconds} s
            </span>
          ) : null}
          {idea.legacyId ? <span className="tabular-nums">· #{idea.legacyId}</span> : null}
        </p>
        <Button
          asChild
          size="icon-lg"
          className="relative z-10 shrink-0 rounded-full bg-rose-500 text-white shadow-sm shadow-rose-500/30 hover:bg-rose-600 dark:bg-rose-500 dark:hover:bg-rose-400"
        >
          <Link href={`${href}/grabar`} aria-label={`Grabar «${idea.title}» con el teleprompter`}>
            <Clapperboard className="size-4" />
          </Link>
        </Button>
      </div>
    </li>
  );
}
