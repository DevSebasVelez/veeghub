"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Sprout } from "lucide-react";

import {
  createGuideline,
  seedGuidelines,
  updateGuideline,
} from "@/lib/admin/actions/marketing/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Guideline = {
  id: string;
  key: string;
  title: string;
  content: string;
  active: boolean;
  updatedLabel: string;
};

/** One guideline, edited in place. Markdown, as it goes into the AI prompt. */
export function GuidelineEditor({ guideline }: { guideline: Guideline }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(guideline.active);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("active", String(active));

    setSaving(true);
    try {
      const result = await updateGuideline(guideline.id, formData);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar.");
        return;
      }
      toast.success(`«${guideline.title}» guardada.`);
      setDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => setDirty(true)}
      className="scroll-mt-20 space-y-3 rounded-2xl border bg-card p-5"
      id={guideline.key}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input name="title" defaultValue={guideline.title} aria-label="Título de la directriz" className="h-10 max-w-sm font-medium sm:h-9" required />
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{guideline.key}</code>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={active}
            onCheckedChange={(value) => {
              setActive(value);
              setDirty(true);
            }}
          />
          {active ? "Activa" : "Inactiva"}
        </label>
      </div>
      <Textarea
        name="content"
        aria-label={`Contenido de «${guideline.title}»`}
        defaultValue={guideline.content}
        rows={Math.min(18, Math.max(6, guideline.content.split("\n").length + 1))}
        className="font-mono text-[13px] leading-6"
        required
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Editada {guideline.updatedLabel}</span>
        <Button type="submit" size="sm" className="max-sm:h-10" disabled={saving || !dirty}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Guardar
        </Button>
      </div>
    </form>
  );
}

export function SeedGuidelinesButton({ missing }: { missing: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function seed() {
    setBusy(true);
    try {
      const result = await seedGuidelines();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.created
          ? `${result.data.created} directrices cargadas.`
          : "Ya estaban todas las directrices base.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" className="max-sm:h-10" variant={missing ? "default" : "outline"} onClick={seed} disabled={busy}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sprout className="size-3.5" />}
      {missing ? `Cargar ${missing} directrices base` : "Cargar base"}
    </Button>
  );
}

export function NewGuidelineDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await createGuideline(new FormData(event.currentTarget));
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo crear.");
        return;
      }
      toast.success("Directriz creada.");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="max-sm:h-10">
          <Plus className="size-3.5" />
          Nueva
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva directriz</DialogTitle>
          <DialogDescription>Se agrega al final del prompt de la IA.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Clave</FieldLabel>
                <Input name="key" placeholder="instagram" required />
                <FieldDescription>Minúsculas y guiones.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Título</FieldLabel>
                <Input name="title" placeholder="Instagram" required />
              </Field>
            </div>
            <Field>
              <FieldLabel>Contenido (Markdown)</FieldLabel>
              <Textarea name="content" rows={8} className="font-mono text-[13px]" required />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
