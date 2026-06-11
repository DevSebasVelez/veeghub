"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  RotateCcw,
  Trash2,
  User,
  Video,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteMeeting,
  updateMeetingStatus,
  type MeetingStatusValue,
} from "@/lib/admin/actions/meetings/actions";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { MeetingDialog } from "@/components/admin/dialogs/meeting-dialog";
import type { EntityOption } from "@/components/admin/dialogs/_base";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  MEETING_BADGE_CLASSES,
  MEETING_STATUS_LABELS,
  formatDayLong,
  formatTimeRange,
  type MeetingDTO,
} from "@/components/admin/meetings/utils";

export function MeetingDetailsDialog({
  meeting,
  clients,
  onClose,
}: {
  meeting: MeetingDTO | null;
  clients: EntityOption[];
  onClose: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  async function changeStatus(status: MeetingStatusValue, message: string) {
    if (!meeting || updating) return;
    setUpdating(true);
    try {
      await updateMeetingStatus(meeting.id, status);
      router.refresh();
      toast.success(message);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!meeting) return;
    try {
      await deleteMeeting(meeting.id);
      router.refresh();
      toast.success("Reunión eliminada.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <Dialog open={!!meeting} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        {meeting ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3 pr-6">
                <DialogTitle
                  className={cn(
                    meeting.status === "CANCELLED" && "line-through",
                  )}
                >
                  {meeting.title}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0",
                    MEETING_BADGE_CLASSES[meeting.status],
                  )}
                >
                  {MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  {formatDayLong(new Date(meeting.startsAt))}
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatTimeRange(meeting)}
                  </span>
                </span>
              </div>
              {meeting.clientId && meeting.clientName ? (
                <div className="flex items-center gap-2.5">
                  <User className="size-4 shrink-0 text-muted-foreground" />
                  <Link
                    href={`/admin/clientes/${meeting.clientId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {meeting.clientName}
                  </Link>
                </div>
              ) : null}
              {meeting.meetLink ? (
                <Button asChild className="w-full">
                  <a
                    href={meeting.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Video className="size-4" />
                    Unirse a la reunión
                  </a>
                </Button>
              ) : null}
              {meeting.notes ? (
                <>
                  <Separator />
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {meeting.notes}
                  </p>
                </>
              ) : null}
            </div>

            <Separator />

            <DialogFooter className="gap-2 sm:justify-between">
              <div className="flex gap-2">
                <MeetingDialog
                  meeting={meeting}
                  clients={clients}
                  onSaved={onClose}
                />
                <ConfirmationDialog
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <Trash2 className="size-3.5 text-destructive" />
                      Eliminar
                    </Button>
                  }
                  title="¿Eliminar reunión?"
                  description="Esta acción no se puede deshacer."
                  confirmLabel="Eliminar"
                  destructive
                  onConfirm={handleDelete}
                />
              </div>
              <div className="flex gap-2">
                {meeting.status === "SCHEDULED" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updating}
                      onClick={() =>
                        changeStatus("CANCELLED", "Reunión cancelada.")
                      }
                    >
                      <XCircle className="size-3.5" />
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={updating}
                      onClick={() =>
                        changeStatus("COMPLETED", "Reunión completada.")
                      }
                    >
                      <CheckCircle2 className="size-3.5" />
                      Completar
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={updating}
                    onClick={() =>
                      changeStatus("SCHEDULED", "Reunión reprogramada.")
                    }
                  >
                    <RotateCcw className="size-3.5" />
                    Reabrir
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
