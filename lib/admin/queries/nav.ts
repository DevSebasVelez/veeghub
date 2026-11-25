import prisma from "@/lib/db/prisma";
import { OPEN_STATUSES } from "@/lib/marketing/constants";
import { scheduleWindow } from "@/lib/marketing/schedule";
import type { NavBadges } from "@/components/admin/nav-config";

/**
 * Counts shown next to the sidebar items. The layout renders once per
 * navigation tree and again on router.refresh(), so actions that change these
 * numbers already refresh them. A failure must never take the panel down.
 */
export async function getNavBadges(now = new Date()): Promise<NavBadges> {
  try {
    const window = scheduleWindow(now);
    const [leads, marketing] = await Promise.all([
      prisma.lead.count({ where: { stage: "NEW" } }),
      prisma.contentPost.count({
        where: {
          OR: [
            {
              scheduledAt: { gte: window.todayStart, lt: window.tomorrowStart },
              status: { in: OPEN_STATUSES },
            },
            { status: { in: ["PROGRAMADO", "FALLIDO"] } },
          ],
        },
      }),
    ]);

    return { leads, marketing };
  } catch (error) {
    console.error("[nav] no se pudieron contar los pendientes", error);
    return {};
  }
}
