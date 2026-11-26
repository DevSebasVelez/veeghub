"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { actionResult } from "@/lib/admin/actions/shared";
import { runMetaSync } from "@/lib/meta/sync";

/** «Actualizar»: the full sync, now. The cron keeps it fresh on its own. */
export async function refreshCampaignInsights() {
  await requireAdmin();

  return actionResult(async () => {
    const result = await runMetaSync({ mode: "full", force: true });

    revalidatePath("/admin/campanas", "layout");

    return {
      status: result.status,
      reason: result.reason ?? null,
      campaigns: result.counts?.campaigns ?? 0,
      days: result.counts?.campaignDays ?? 0,
      recovered: result.counts?.recovered ?? 0,
    };
  });
}
