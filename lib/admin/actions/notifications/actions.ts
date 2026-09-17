"use server";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sendPushToAdmins } from "@/lib/notifications/push";

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export async function savePushSubscription(input: PushSubscriptionInput) {
  const session = await requireAdmin();
  const userId = session.user?.id;

  if (!userId) throw new Error("Sesión inválida.");

  // The endpoint is unique per device+browser, so re-subscribing on the same
  // device updates the keys instead of piling up rows.
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
    update: {
      userId,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function removePushSubscription(endpoint: string) {
  await requireAdmin();

  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export async function sendTestPush() {
  await requireAdmin();

  const result = await sendPushToAdmins({
    title: "🔔 Veeghub",
    body: "Las notificaciones de leads están activas en este dispositivo.",
    url: "/admin/leads",
    tag: "test",
  });

  if (result.skipped) throw new Error(result.skipped);
  if (result.sent === 0) {
    throw new Error("No se pudo entregar en ningún dispositivo.");
  }

  return result;
}

export async function countPushDevices() {
  await requireAdmin();

  return prisma.pushSubscription.count();
}
