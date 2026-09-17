"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { syncCampaignInsights } from "@/lib/meta/insights";

export async function refreshCampaignInsights({
  since,
  until,
  force = false,
}: {
  since: string;
  until: string;
  force?: boolean;
}) {
  await requireAdmin();

  const result = await syncCampaignInsights({
    since: new Date(`${since}T00:00:00.000Z`),
    until: new Date(`${until}T00:00:00.000Z`),
    force,
  });

  revalidatePath("/admin/campanas");

  return result;
}
