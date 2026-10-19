"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { Button } from "@/components/ui/button";

const ICONS = { trash: Trash2, archive: Archive, restore: ArchiveRestore };

/**
 * ConfirmationDialog with its trigger built on the client.
 *
 * A trigger element created in a server component reaches the client as a
 * lazy RSC reference, and Radix's Slot (DialogTrigger asChild) renders it
 * differently during hydration than on the server, which throws a hydration
 * mismatch. Building the button here avoids that. Errors from the action are
 * shown as a toast instead of being swallowed.
 */
export function ConfirmActionButton({
  icon,
  title,
  description,
  confirmLabel,
  destructive = false,
  successMessage,
  compact = false,
  action,
}: {
  icon: keyof typeof ICONS;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  successMessage?: string;
  /** Smaller icon button for dense tables. */
  compact?: boolean;
  action: () => Promise<void>;
}) {
  const Icon = ICONS[icon];

  return (
    <ConfirmationDialog
      trigger={
        <Button
          variant="ghost"
          size="sm"
          aria-label={title}
          className={cn(
            compact && "size-7 p-0",
            destructive && "text-destructive hover:text-destructive",
          )}
        >
          <Icon className={compact ? "size-3.5" : "size-4"} />
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      onConfirm={async () => {
        try {
          await action();
          if (successMessage) toast.success(successMessage);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "No se pudo completar.");
        }
      }}
    />
  );
}
