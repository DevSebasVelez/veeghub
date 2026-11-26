"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  deletePost,
  markPostPublished,
  setPostStatus,
} from "@/lib/admin/actions/marketing/actions";
import type { PostDetailDTO } from "@/lib/admin/queries/marketing";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
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
import { Input } from "@/components/ui/input";

type Target = "EN_REVISION" | "APROBADO" | "BORRADOR" | "DESCARTADO";

/** Status buttons. The only path to APROBADO is a person clicking «Aprobar». */
export function PostStatusActions({ post }: { post: PostDetailDTO }) {
  const router = useRouter();
  const [pending, setPending] = useState<Target | null>(null);

  async function go(status: Target, message: string) {
    setPending(status);
    try {
      const result = await setPostStatus(post.id, status);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo cambiar el estado.");
        return;
      }
      toast.success(message);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const s = post.status;
  const canReview = ["IDEA", "BORRADOR", "FALLIDO"].includes(s);
  const canApprove = ["IDEA", "BORRADOR", "EN_REVISION", "FALLIDO"].includes(s);
  const canDraft = ["EN_REVISION", "APROBADO", "PROGRAMADO", "FALLIDO", "DESCARTADO"].includes(s);
  const canDiscard = !["PUBLICADO", "DESCARTADO"].includes(s);
  const canPublish = ["APROBADO", "PROGRAMADO", "FALLIDO"].includes(s);

  const spinner = (target: Target) =>
    pending === target ? <Loader2 className="size-3.5 animate-spin" /> : null;

  return (
    <div className="flex flex-wrap gap-2 [&_[data-slot=button]]:max-sm:h-10 [&_[data-slot=button]]:max-sm:px-3.5">
      {canApprove ? (
        <Button size="sm" disabled={!!pending} onClick={() => go("APROBADO", "Aprobado. Se avisará a la hora programada.")}>
          {spinner("APROBADO") ?? <Check className="size-3.5" />}
          Aprobar
        </Button>
      ) : null}
      {canReview ? (
        <Button size="sm" variant="outline" disabled={!!pending} onClick={() => go("EN_REVISION", "Enviado a revisión.")}>
          {spinner("EN_REVISION") ?? <Send className="size-3.5" />}
          A revisión
        </Button>
      ) : null}
      {canPublish ? <MarkPublishedDialog postId={post.id} /> : null}
      {canDraft ? (
        <Button size="sm" variant="outline" disabled={!!pending} onClick={() => go("BORRADOR", "Volvió a borrador.")}>
          {spinner("BORRADOR") ?? <RotateCcw className="size-3.5" />}
          {s === "DESCARTADO" ? "Recuperar" : "Volver a borrador"}
        </Button>
      ) : null}
      {canDiscard ? (
        <Button size="sm" variant="ghost" disabled={!!pending} onClick={() => go("DESCARTADO", "Post descartado.")}>
          {spinner("DESCARTADO") ?? <XCircle className="size-3.5" />}
          Descartar
        </Button>
      ) : null}
      <ConfirmationDialog
        title="¿Eliminar este post?"
        description="Se borra del calendario. Las imágenes siguen en la biblioteca."
        confirmLabel="Eliminar"
        destructive
        trigger={
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive max-sm:h-10 max-sm:px-3.5">
            <Trash2 className="size-3.5" />
            Eliminar
          </Button>
        }
        onConfirm={async () => {
          const result = await deletePost(post.id);
          if (!result.ok) {
            toast.error(result.error ?? "No se pudo eliminar.");
            return;
          }
          toast.success("Post eliminado.");
          router.push("/admin/marketing/calendario");
        }}
      />
    </div>
  );
}

function MarkPublishedDialog({ postId }: { postId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const result = await markPostPublished(postId, url);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Marcado como publicado.");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Check className="size-3.5" />
          Marcar publicado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar publicado</DialogTitle>
          <DialogDescription>
            Pega la URL del post publicado. Sirve para las métricas y para encontrarlo después.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.linkedin.com/feed/update/urn:li:activity:…"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
