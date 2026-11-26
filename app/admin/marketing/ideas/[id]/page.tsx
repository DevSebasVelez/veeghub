import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ExternalLink,
  FileText,
  Mic,
  NotebookPen,
  Shuffle,
  Sparkles,
  Wand2,
} from "lucide-react";

import { CopyButton } from "@/components/admin/marketing/copy-button";
import { IdeaCategoryTag, IdeaStageBadge } from "@/components/admin/marketing/idea-badge";
import { IconTile, TONE_TEXT, type Tone } from "@/components/admin/tone";
import {
  CreatePostFromIdeaButton,
  IdeaNotes,
  IdeaStageControl,
} from "@/components/admin/marketing/idea-actions";
import { StatusBadge, postHref } from "@/components/admin/marketing/post-chip";
import { Button } from "@/components/ui/button";
import { getIdeaDetail, getIdeaNeighbors } from "@/lib/admin/queries/marketing";
import { BEAT_LABELS, scriptText, voiceText } from "@/lib/marketing/ideas-import";
import { cn } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

const BEAT_TONES: Record<string, Tone> = {
  hook: "rose",
  caso: "sky",
  giro: "amber",
  pantalla: "emerald",
  cierre: "violet",
};

const BEAT_ACCENTS: Record<string, string> = {
  hook: "bg-rose-500",
  caso: "bg-sky-500",
  giro: "bg-amber-500",
  pantalla: "bg-emerald-500",
  cierre: "bg-violet-500",
};

function SectionTitle({ icon, tone, title, hint }: { icon: React.ElementType; tone: Tone; title: string; hint?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <IconTile icon={icon} tone={tone} size="sm" />
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [idea, neighbors] = await Promise.all([getIdeaDetail(id), getIdeaNeighbors(id)]);
  if (!idea) notFound();

  const base = "/admin/marketing/ideas";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={base}
          className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Ideas
        </Link>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs tabular-nums text-muted-foreground">
            {neighbors.position} de {neighbors.total}
          </span>
          <Button asChild={!!neighbors.prev} variant="outline" size="icon-lg" className="rounded-full" disabled={!neighbors.prev}>
            {neighbors.prev ? (
              <Link href={`${base}/${neighbors.prev}`} aria-label="Idea anterior">
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span aria-hidden><ChevronLeft className="size-4" /></span>
            )}
          </Button>
          <Button asChild={!!neighbors.next} variant="outline" size="icon-lg" className="rounded-full" disabled={!neighbors.next}>
            {neighbors.next ? (
              <Link href={`${base}/${neighbors.next}`} aria-label="Idea siguiente">
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span aria-hidden><ChevronRight className="size-4" /></span>
            )}
          </Button>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{idea.title}</h2>
          <IdeaStageBadge stage={idea.stage} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <IdeaCategoryTag category={idea.category} />
          <span>{[idea.sector, idea.seconds ? `~${idea.seconds} s` : null].filter(Boolean).join(" · ")}</span>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="max-lg:contents lg:sticky lg:top-20 lg:order-2 lg:space-y-4">
          <section className="space-y-2 rounded-2xl border bg-linear-to-br from-rose-50 to-card p-5 max-lg:order-1 dark:from-rose-500/10">
            <SectionTitle icon={Clapperboard} tone="rose" title="Grabar" hint="Teleprompter a pantalla completa: velocidad, tamaño, espejo y pausa con un toque." />
            <Button asChild className="mt-2 h-11 w-full bg-rose-500 text-white shadow-sm shadow-rose-500/30 hover:bg-rose-600 dark:bg-rose-500 dark:hover:bg-rose-400">
              <Link href={`${base}/${idea.id}/grabar`}>
                <Clapperboard className="size-4" />
                Abrir teleprompter
              </Link>
            </Button>
            <div className="pt-3">
              <IdeaStageControl id={idea.id} stage={idea.stage} />
            </div>
            <CreatePostFromIdeaButton id={idea.id} />
          </section>

          <section className="rounded-2xl border bg-card px-5 py-3 max-lg:order-3">
            <div className="divide-y">
              {idea.sector ? <Row label="Sector">{idea.sector}</Row> : null}
              {idea.audience ? <Row label="Para">{idea.audience}</Row> : null}
              {idea.category ? <Row label="Categoría">{idea.category}</Row> : null}
              {idea.format ? <Row label="Formato">{idea.format}</Row> : null}
              <Row label="Duración">
                <span className="tabular-nums">
                  {idea.words ?? "—"} palabras · ~{idea.seconds ?? "—"} s
                </span>
              </Row>
              {idea.priority ? <Row label="Prioridad">{idea.priority}</Row> : null}
              {idea.offer ? <Row label="Solución">{idea.offer}</Row> : null}
              {idea.legacyId ? (
                <Row label="Origen">
                  <span className="tabular-nums">#{idea.legacyId}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{idea.source}</span>
                </Row>
              ) : null}
              {idea.publishedUrl ? (
                <Row label="Publicado">
                  <a href={idea.publishedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Ver reel <ExternalLink className="size-3.5" />
                  </a>
                </Row>
              ) : null}
            </div>
          </section>

          {idea.posts.length ? (
            <section className="overflow-hidden rounded-2xl border bg-card max-lg:order-4">
              <div className="border-b px-5 py-3">
                <SectionTitle icon={FileText} tone="blue" title="Posts de esta idea" />
              </div>
              <div className="divide-y">
                {idea.posts.map((post) => (
                  <Link key={post.id} href={postHref(post.id)} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-accent/40">
                    <span className="truncate">{post.title}</span>
                    <StatusBadge status={post.status} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3 rounded-2xl border bg-card p-5 max-lg:order-5">
            <SectionTitle icon={NotebookPen} tone="amber" title="Notas" />
            <IdeaNotes id={idea.id} notes={idea.notes} />
          </section>
        </aside>

        <div className="min-w-0 space-y-4 max-lg:order-2 lg:order-1">
          <section className="rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <SectionTitle icon={Mic} tone="violet" title="Texto para cámara" hint="Lo que se dice, en orden. Debajo, lo que se ve." />
              <div className="flex flex-wrap gap-2">
                <CopyButton text={voiceText(idea.beats)} label="Copiar texto" />
                <CopyButton text={scriptText(idea)} label="Guion completo" />
              </div>
            </div>
            <ol className="divide-y">
              {idea.beats.map((beat, index) => (
                <li key={index} className="flex gap-3 px-5 py-4">
                  <span className={cn("mt-1.5 w-1 shrink-0 self-stretch rounded-full", BEAT_ACCENTS[beat.tipo] ?? "bg-zinc-400")} aria-hidden />
                  <div className="min-w-0 space-y-1.5">
                    <p className={cn("text-xs font-semibold", TONE_TEXT[BEAT_TONES[beat.tipo] ?? "zinc"])}>{BEAT_LABELS[beat.tipo]}</p>
                    <p className="text-[15px] leading-7">{beat.voz}</p>
                    {beat.motion ? (
                      <p className="whitespace-pre-line rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">En pantalla: </span>
                        {beat.motion}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {idea.alternativeHook ? (
            <section className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle icon={Shuffle} tone="orange" title="Gancho alternativo" hint="Para probar otra entrada; el teleprompter te deja elegirlo." />
                <CopyButton text={idea.alternativeHook} label="Copiar" />
              </div>
              <p className="mt-3 rounded-xl bg-orange-50 p-4 text-[15px] leading-7 dark:bg-orange-500/10">{idea.alternativeHook}</p>
            </section>
          ) : null}

          {idea.visual.length ? (
            <section className="rounded-2xl border bg-card p-5">
              <SectionTitle icon={Sparkles} tone="pink" title="Secuencia de motion graphics" />
              <ol className="mt-3 space-y-2">
                {idea.visual.map((step, index) => (
                  <li key={index} className="flex gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-pink-100 text-xs font-medium tabular-nums text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">{index + 1}</span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {idea.visualPrompt ? (
            <section className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle icon={Wand2} tone="teal" title="Prompt visual" hint="Para generar la pantalla o el motion con IA." />
                <CopyButton text={idea.visualPrompt} label="Copiar prompt" />
              </div>
              <details className="group mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Ver prompt</summary>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-sm leading-6 [overflow-wrap:anywhere]">{idea.visualPrompt}</p>
              </details>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
