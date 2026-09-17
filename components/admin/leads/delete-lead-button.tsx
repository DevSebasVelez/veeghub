"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { deleteLead } from "@/lib/admin/actions/leads/actions";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { Button } from "@/components/ui/button";

export function DeleteLeadButton({
  id,
  name,
  redirectTo,
  variant = "icon",
}: {
  id: string;
  name: string;
  /** Where to go after deleting — the detail page cannot stay on a gone lead. */
  redirectTo?: string;
  variant?: "icon" | "button";
}) {
  const router = useRouter();

  async function handleDelete() {
    // ConfirmationDialog does not catch, so the toast belongs here.
    try {
      await deleteLead(id);
      toast.success("Lead eliminado.");

      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  const trigger =
    variant === "icon" ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 text-muted-foreground hover:text-destructive md:size-7"
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Eliminar lead</span>
      </Button>
    ) : (
      <Button type="button" variant="outline" size="sm">
        <Trash2 className="size-3.5 text-destructive" />
        Eliminar
      </Button>
    );

  return (
    <ConfirmationDialog
      trigger={trigger}
      title="¿Eliminar este lead?"
      description={`Se borrará "${name}" de forma permanente. Si vino de Meta, no volverá a entrar aunque lo reenvíen. Esta acción no se puede deshacer.`}
      confirmLabel="Eliminar"
      destructive
      onConfirm={handleDelete}
    />
  );
}
