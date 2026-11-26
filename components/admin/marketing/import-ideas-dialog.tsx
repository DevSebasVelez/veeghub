"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, FileUp, Loader2 } from "lucide-react";

import { importIdeasFiles } from "@/lib/admin/actions/marketing/actions";
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

export function ImportIdeasDialog({ primary = false }: { primary?: boolean }) {
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
      const result = await importIdeasFiles(new FormData(event.currentTarget));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { created, updated } = result.data;
      toast.success(
        `${created} idea${created === 1 ? "" : "s"} nueva${created === 1 ? "" : "s"}${updated ? `, ${updated} actualizada${updated === 1 ? "" : "s"}` : ""}.`,
      );
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={primary ? "default" : "outline"} size="sm" className="max-sm:h-10">
          <FileUp className="size-3.5" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar banco de ideas</DialogTitle>
          <DialogDescription>
            Sube los 5 HTML de <code>MARKETING/Banco de Ideas</code> (puedes elegirlos juntos). Volver a
            importar actualiza los guiones y conserva la etapa y las notas de cada idea.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Input type="file" name="files" accept=".html,text/html" multiple required />
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
