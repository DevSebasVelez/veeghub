"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Loader2, RotateCcw, Save } from "lucide-react";

import { restoreIdeaOriginal, updateIdeaScript } from "@/lib/admin/actions/marketing/actions";
import { BEAT_LABELS, spokenStats, type Beat } from "@/lib/marketing/idea-script";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { TONE_SOLID, TONE_TEXT, type Tone } from "@/components/admin/tone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const BEAT_TONES: Record<string, Tone> = { hook: "rose", caso: "sky", giro: "amber", pantalla: "emerald", cierre: "violet" };

type Props = {
  id: string;
  title: string;
  beats: Beat[];
  alternativeHook: string | null;
  visualPrompt: string | null;
  hasOriginal: boolean;
  backHref: string;
};

/**
 * Rewrites the AI script before recording. Saves the whole script at once;
 * the teleprompter reads the saved version.
 */
export function IdeaScriptEditor({ id, title: initialTitle, beats: initialBeats, alternativeHook, visualPrompt, hasOriginal, backHref }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [beats, setBeats] = useState(initialBeats);
  const [alt, setAlt] = useState(alternativeHook ?? "");
  const [prompt, setPrompt] = useState(visualPrompt ?? "");
  const [saving, setSaving] = useState(false);

  const stats = spokenStats(beats);
  const dirty =
    title !== initialTitle ||
    alt !== (alternativeHook ?? "") ||
    prompt !== (visualPrompt ?? "") ||
    JSON.stringify(beats) !== JSON.stringify(initialBeats);

  function setBeat(index: number, patch: Partial<Beat>) {
    setBeats((current) => current.map((beat, i) => (i === index ? { ...beat, ...patch } : beat)));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await updateIdeaScript(id, {
        title,
        beats: beats.map((beat) => ({ tipo: beat.tipo, voz: beat.voz, motion: beat.motion ?? "" })),
        alternativeHook: alt,
        visualPrompt: prompt,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar el guion.");
        return;
      }
      toast.success(`Guion guardado · ~${result.data.seconds} s.`);
      router.push(backHref);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    const result = await restoreIdeaOriginal(id);
    if (!result.ok) {
      toast.error(result.error ?? "No se pudo restaurar.");
      return;
    }
    toast.success("Guion original restaurado.");
    router.push(backHref);
    router.refresh();
  }

  return (
    <div className="space-y-5 p-5">
      <div className="space-y-1.5">
        <label htmlFor="idea-title" className="text-xs font-medium text-muted-foreground">
          Título
        </label>
        <Input id="idea-title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 text-base font-semibold" />
      </div>

      <ol className="space-y-4">
        {beats.map((beat, index) => {
          const tone = BEAT_TONES[beat.tipo] ?? "zinc";
          return (
            <li key={index} className="flex gap-3">
              <span className={cn("mt-1 w-1 shrink-0 self-stretch rounded-full", TONE_SOLID[tone])} aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <label htmlFor={`beat-${index}`} className={cn("text-xs font-semibold", TONE_TEXT[tone])}>
                  {BEAT_LABELS[beat.tipo]}
                </label>
                <Textarea
                  id={`beat-${index}`}
                  value={beat.voz}
                  onChange={(event) => setBeat(index, { voz: event.target.value })}
                  rows={3}
                  className="field-sizing-content min-h-20 text-[15px] leading-7"
                />
                <div className="space-y-1">
                  <label htmlFor={`motion-${index}`} className="text-xs text-muted-foreground">
                    En pantalla (opcional)
                  </label>
                  <Textarea
                    id={`motion-${index}`}
                    value={beat.motion ?? ""}
                    onChange={(event) => setBeat(index, { motion: event.target.value })}
                    rows={1}
                    placeholder="Texto o gráfico que acompaña esta parte"
                    className="field-sizing-content min-h-10 text-sm"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="space-y-1.5">
        <label htmlFor="idea-alt" className="text-xs font-medium text-muted-foreground">
          Gancho alternativo (opcional)
        </label>
        <Textarea id="idea-alt" value={alt} onChange={(event) => setAlt(event.target.value)} rows={2} className="field-sizing-content min-h-16 text-[15px] leading-7" />
      </div>

      <details className="group">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Prompt visual</summary>
        <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} className="mt-2 text-sm" aria-label="Prompt visual" />
      </details>

      <div className="sticky bottom-24 z-10 -mx-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card/95 p-2 backdrop-blur max-lg:shadow-lg max-lg:ring-1 max-lg:ring-foreground/10 lg:bottom-4">
        <span className="inline-flex items-center gap-1.5 px-2 text-xs tabular-nums text-muted-foreground">
          <Clock className="size-3.5" />
          {stats.words} palabras · ~{stats.seconds} s
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {hasOriginal ? (
            <ConfirmationDialog
              trigger={
                <Button type="button" variant="ghost" className="h-10 sm:h-9">
                  <RotateCcw className="size-4" />
                  Restaurar original
                </Button>
              }
              title="¿Restaurar el guion original?"
              description="Se pierden tus cambios al texto y vuelve la versión importada del banco."
              confirmLabel="Restaurar"
              destructive
              onConfirm={restore}
            />
          ) : null}
          <Button type="button" variant="outline" className="h-10 sm:h-9" onClick={() => router.push(backHref)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" className="h-10 sm:h-9" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar guion
          </Button>
        </div>
      </div>
    </div>
  );
}
