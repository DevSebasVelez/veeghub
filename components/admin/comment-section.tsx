"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, Send, Trash2 } from "lucide-react";

import { createComment, deleteComment } from "@/app/admin/actions";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/admin/format";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
};

export function CommentSection({
  comments,
  clientId,
  projectId,
}: {
  comments: Comment[];
  clientId?: string;
  projectId?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    const fd = new FormData();
    fd.set("body", body.trim());
    if (clientId) fd.set("clientId", clientId);
    if (projectId) fd.set("projectId", projectId);

    startTransition(async () => {
      try {
        await createComment(fd);
        setBody("");
        router.refresh();
        toast.success("Comentario agregado.");
      } catch {
        toast.error("Error al agregar comentario.");
      }
    });
  }

  async function handleDelete(id: string) {
    try {
      await deleteComment(id);
      router.refresh();
      toast.success("Comentario eliminado.");
    } catch {
      toast.error("Error al eliminar comentario.");
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          placeholder="Escribe una nota o comentario..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="resize-none"
          disabled={isPending}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
            <Send className="size-3.5" />
            {isPending ? "Guardando..." : "Agregar nota"}
          </Button>
        </div>
      </form>

      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <MessageSquare className="size-8 opacity-25" />
          <p className="text-sm">Sin notas aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="group flex items-start gap-2">
              <div className="flex-1 rounded-lg border bg-muted/30 px-4 py-3">
                <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatDate(comment.createdAt)}
                </p>
              </div>
              <ConfirmationDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-1 size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                }
                title="Eliminar nota"
                description="¿Eliminar este comentario? No se puede deshacer."
                confirmLabel="Eliminar"
                destructive
                onConfirm={() => handleDelete(comment.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
