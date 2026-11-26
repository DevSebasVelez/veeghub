"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

import { refreshCampaignInsights } from "@/lib/admin/actions/campaigns/actions";
import { Button } from "@/components/ui/button";

/** Forces the full sync. The cron already runs it every hour on its own. */
export function RefreshInsightsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const outcome = await refreshCampaignInsights();
      if (!outcome.ok) {
        toast.error(outcome.error ?? "No se pudo actualizar.");
        return;
      }
      const result = outcome.data;
      if (result.status === "throttled") {
        toast.error(result.reason ?? "Límite de la API alcanzado. Prueba en unos minutos.");
      } else if (result.status === "failed") {
        toast.error(result.reason ?? "Meta no respondió.");
      } else {
        toast.success(
          `Actualizado: ${result.campaigns} campañas, ${result.days} días de datos${
            result.recovered ? `, ${result.recovered} lead(s) recuperado(s)` : ""
          }.`,
        );
        if (result.reason) toast.warning(result.reason);
      }
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={refresh} disabled={pending} className="h-10 rounded-full sm:h-9">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      {pending ? "Actualizando…" : "Actualizar"}
    </Button>
  );
}
