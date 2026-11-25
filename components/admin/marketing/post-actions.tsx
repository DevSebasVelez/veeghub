"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
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
import { CHANNELS } from "@/lib/marketing/constants";
import { buildUtmUrl, renderFirstComment } from "@/lib/marketing/utm";
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
    <div className="flex flex-wrap gap-2">
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
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
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

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado.`);
  } catch {
    toast.error("El navegador no dejó copiar. Selecciona el texto a mano.");
  }
}

/**
 * Manual publishing kit (decision 7): what the alert points to while there is
 * no API for the channel. Downloads go through /api/admin/marketing/assets so
 * the link never expires on a page left open.
 */
export function PublishKit({ post }: { post: PostDetailDTO }) {
  const channel = CHANNELS[post.channel];
  const utmUrl = buildUtmUrl({
    linkUrl: post.linkUrl,
    channel: post.channel,
    campaignSlug: post.campaignSlug,
    postId: post.id,
  });
  const comment = channel.linkInComment ? renderFirstComment(post.firstComment, utmUrl) : null;

  function downloadAll() {
    // Staggered: browsers drop simultaneous downloads started by one click.
    post.assets.forEach((asset, index) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = `/api/admin/marketing/assets/${asset.id}?descargar=1`;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 400);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Button size="sm" variant="outline" className="justify-start" onClick={() => copy(post.body, "Texto")}>
          <Copy className="size-3.5" />
          Copiar texto
        </Button>
        {comment ? (
          <Button size="sm" variant="outline" className="justify-start" onClick={() => copy(comment, "Comentario")}>
            <Copy className="size-3.5" />
            Copiar comentario
          </Button>
        ) : utmUrl ? (
          <Button size="sm" variant="outline" className="justify-start" onClick={() => copy(utmUrl, "Enlace")}>
            <Copy className="size-3.5" />
            Copiar enlace
          </Button>
        ) : null}
        {post.assets.length ? (
          <Button size="sm" variant="outline" className="justify-start" onClick={downloadAll}>
            <Download className="size-3.5" />
            Descargar {post.assets.length} imagen{post.assets.length === 1 ? "" : "es"}
          </Button>
        ) : null}
        <Button size="sm" asChild className="justify-start">
          <a href={channel.openUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" />
            Abrir {channel.short}
          </a>
        </Button>
      </div>
      {channel.linkInComment ? (
        <p className="text-xs text-muted-foreground">
          Publica el post y, de inmediato, pega el comentario con el enlace.
        </p>
      ) : null}
    </div>
  );
}
