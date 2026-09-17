import webpush from "web-push";

import prisma from "@/lib/db/prisma";

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@veegsoft.com",
    publicKey,
    privateKey,
  );

  configured = true;
  return true;
}

export function pushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushResult = {
  sent: number;
  failed: number;
  removed: number;
  skipped?: string;
};

/**
 * Sends a notification to every registered device.
 *
 * Endpoints answering 404/410 belong to uninstalled apps or cleared browsers and
 * are deleted, otherwise every future send would keep retrying dead devices.
 */
export async function sendPushToAdmins(
  payload: PushPayload,
): Promise<PushResult> {
  if (!ensureConfigured()) {
    return { sent: 0, failed: 0, removed: 0, skipped: "VAPID no configurado" };
  }

  const subscriptions = await prisma.pushSubscription.findMany();

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, removed: 0, skipped: "Sin dispositivos" };
  }

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;

        if (status === 404 || status === 410) {
          dead.push(subscription.id);
        } else {
          failed += 1;
          console.error("[push] fallo al enviar", status, error);
        }
      }
    }),
  );

  if (dead.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  }

  if (sent > 0) {
    await prisma.pushSubscription.updateMany({
      where: { id: { notIn: dead } },
      data: { lastUsedAt: new Date() },
    });
  }

  return { sent, failed, removed: dead.length };
}
