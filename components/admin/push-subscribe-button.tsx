"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, Share } from "lucide-react";

import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/lib/admin/actions/notifications/actions";
import { Button } from "@/components/ui/button";

/** VAPID keys travel as base64url; the browser needs raw bytes. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);

  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own flag; the standard media query is false there.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

type State = "loading" | "unsupported" | "ios-needs-install" | "off" | "on";

export function PushSubscribeButton() {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iOS only exposes PushManager once the PWA is on the home screen.
        setState(isIos() && !isStandalone() ? "ios-needs-install" : "unsupported");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      setState(existing ? "on" : "off");
    }

    check().catch(() => setState("unsupported"));
  }, []);

  function subscribe() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
          toast.error("Permiso denegado. Habilitalo en los ajustes del navegador.");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          ),
        });

        const json = subscription.toJSON();

        await savePushSubscription({
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent,
        });

        setState("on");
        toast.success("Avisos activados en este dispositivo.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo activar");
      }
    });
  }

  function unsubscribe() {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await removePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }

        setState("off");
        toast.success("Avisos desactivados en este dispositivo.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function test() {
    startTransition(async () => {
      try {
        const result = await sendTestPush();
        toast.success(`Enviado a ${result.sent} dispositivo(s).`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  if (state === "loading") return null;

  if (state === "ios-needs-install") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <Share className="mt-0.5 size-4 shrink-0" />
        <span>
          Para recibir avisos de leads en el iPhone, instalá Veeghub en la
          pantalla de inicio: botón <strong>Compartir</strong> →{" "}
          <strong>Agregar a inicio</strong>. Después volvé acá y activalos.
        </span>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        Este navegador no admite notificaciones push.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "on" ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={unsubscribe}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <BellOff className="size-3.5" />
            )}
            Desactivar avisos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={test}
            disabled={pending}
          >
            Enviar prueba
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" onClick={subscribe} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Bell className="size-3.5" />
          )}
          Activar avisos en este dispositivo
        </Button>
      )}
    </div>
  );
}
