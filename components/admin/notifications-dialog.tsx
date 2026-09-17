"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

import { PushSubscribeButton } from "@/components/admin/push-subscribe-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Wraps the existing PushSubscribeButton, which already resolves permission,
 * browser support and the iOS install requirement. Subscriptions are per device,
 * so this has to be opened on each phone or laptop that should get the alerts.
 */
export function NotificationsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="size-4" />
            Avisos de leads
          </DialogTitle>
          <DialogDescription>
            Recibí una notificación apenas entra un lead de tus campañas, con el
            nombre, la campaña y el teléfono.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <PushSubscribeButton />
          <p className="text-xs text-muted-foreground">
            Se activa por dispositivo: repetilo en cada teléfono o computadora
            donde quieras recibirlos.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Controlled wrapper for callers that just need a trigger of their own. */
export function useNotificationsDialog() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
