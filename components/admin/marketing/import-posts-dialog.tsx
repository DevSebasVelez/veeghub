"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, FileUp, Loader2 } from "lucide-react";

import { importPostsIndustriasFile } from "@/lib/admin/actions/marketing/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ImportPostsDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    try {
      const result = await importPostsIndustriasFile(new FormData(event.currentTarget));
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { created, skipped, fetchedAssets, missingAssets } = result.data;
      toast.success(
        `${created} post${created === 1 ? "" : "s"} importado${created === 1 ? "" : "s"}${skipped ? `, ${skipped} ya existían` : ""}${fetchedAssets ? `; ${fetchedAssets} imágenes traídas de veegsoft.com` : ""}.`,
      );
      if (missingAssets.length) {
        toast.warning(
          `${missingAssets.length} imágenes no se pudieron traer (el carrusel de lanzamiento no es público). Súbelas a la biblioteca si las necesitas.`,
        );
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FileUp className="size-3.5" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar cronograma de industrias</DialogTitle>
          <DialogDescription>
            Sube <code>veegsoft-web/docs/marketing/posts-industrias.md</code>. Crea la campaña
            «Lanzamiento industrias» con sus posts de LinkedIn y GBP como borradores y trae sus
            imágenes de veegsoft.com. Los posts que ya existen no se tocan. Tarda unos segundos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Input type="file" name="file" accept=".md,text/markdown,text/plain" required />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Importar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
