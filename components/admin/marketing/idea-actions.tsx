"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, FilePlus2, Loader2 } from "lucide-react";

import { createPostFromIdea, setIdeaStage, updateIdeaNotes } from "@/lib/admin/actions/marketing/actions";
import {
  IDEA_NEXT_STAGE,
  IDEA_STAGE_BADGES,
  IDEA_STAGE_DOTS,
  IDEA_STAGES,
  IDEA_STAGE_LABELS,
  type IdeaStage,
} from "@/lib/marketing/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Shared by the ficha's control and the card's quick select: PUBLICADO asks for the URL first. */
function useIdeaStage(id: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [askUrl, setAskUrl] = useState(false);
  const [url, setUrl] = useState("");

  async function change(target: IdeaStage, publishedUrl?: string) {
    if (target === "PUBLICADO" && publishedUrl === undefined) {
      setAskUrl(true);
      return;
    }
    setPending(true);
    try {
      const result = await setIdeaStage(id, target, publishedUrl);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo cambiar la etapa.");
        return;
      }
      toast.success(`Etapa: ${IDEA_STAGE_LABELS[target]}.`);
      setAskUrl(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const dialog = (
    <Dialog open={askUrl} onOpenChange={setAskUrl}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar publicado</DialogTitle>
          <DialogDescription>Pega la URL del reel publicado (opcional), para encontrarlo después.</DialogDescription>
        </DialogHeader>
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.instagram.com/reel/…"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setAskUrl(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={() => change("PUBLICADO", url)} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { change, pending, dialog };
}

/** Stage picker plus a one-tap «advance» to the next stage. */
export function IdeaStageControl({ id, stage }: { id: string; stage: IdeaStage }) {
  const { change, pending, dialog } = useIdeaStage(id);
  const next = IDEA_NEXT_STAGE[stage];

  return (
    <div className="space-y-2">
      <Select value={stage} onValueChange={(value) => change(value as IdeaStage)} disabled={pending}>
        <SelectTrigger className="h-10 w-full" aria-label="Etapa de la idea">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {IDEA_STAGES.map((value) => (
            <SelectItem key={value} value={value}>
              {IDEA_STAGE_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {next ? (
        <Button variant="outline" className="h-10 w-full justify-between" disabled={pending} onClick={() => change(next)}>
          <span className="inline-flex items-center gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Marcar «{IDEA_STAGE_LABELS[next]}»
          </span>
          <ArrowRight className="size-4" />
        </Button>
      ) : null}
      {dialog}
    </div>
  );
}

/** The card's badge is the select: change the stage without opening the idea. */
export function IdeaStageQuick({ id, stage, title }: { id: string; stage: IdeaStage; title: string }) {
  const { change, pending, dialog } = useIdeaStage(id);

  return (
    <>
      <Select value={stage} onValueChange={(value) => change(value as IdeaStage)} disabled={pending}>
        <SelectTrigger
          size="sm"
          aria-label={`Etapa de «${title}»`}
          className={cn(
            "relative z-10 h-8 gap-1.5 rounded-full border px-2.5 text-xs font-medium shadow-none max-sm:h-9 [&_svg]:opacity-70",
            IDEA_STAGE_BADGES[stage],
          )}
        >
          {/* The selected item's own dot shows through SelectValue. */}
          {pending ? <Loader2 className="size-3 animate-spin" /> : null}
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {IDEA_STAGES.map((value) => (
            <SelectItem key={value} value={value}>
              <span className={cn("size-1.5 rounded-full", IDEA_STAGE_DOTS[value])} />
              {IDEA_STAGE_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {dialog}
    </>
  );
}

export function CreatePostFromIdeaButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      className="h-10 w-full justify-start"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await createPostFromIdea(id);
          if (!result.ok) {
            toast.error(result.error ?? "No se pudo crear el post.");
            return;
          }
          toast.success("Borrador creado: ajústalo como post de LinkedIn.");
          router.push(`/admin/marketing/calendario/${result.data.id}?vista=editar`);
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
      Crear post a partir de esta idea
    </Button>
  );
}

export function IdeaNotes({ id, notes }: { id: string; notes: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== (notes ?? "").trim();

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={4}
        placeholder="Qué grabar, dónde, qué cambiar del guion…"
        aria-label="Notas de la idea"
      />
      {dirty ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="max-sm:h-10"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const result = await updateIdeaNotes(id, value);
                if (!result.ok) {
                  toast.error(result.error ?? "No se pudieron guardar las notas.");
                  return;
                }
                toast.success("Notas guardadas.");
                router.refresh();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar notas
          </Button>
        </div>
      ) : null}
    </div>
  );
}
