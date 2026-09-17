"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

import { refreshCampaignInsights } from "@/lib/admin/actions/campaigns/actions";
import { Button } from "@/components/ui/button";

export function RefreshInsightsButton({
  since,
  until,
}: {
  since: string;
  until: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      try {
        // force: the button is an explicit request, so the TTL guard — which is
        // there to stop incidental calls — should not silently do nothing.
        const result = await refreshCampaignInsights({ since, until, force: true });

        if (result.status === "throttled") {
          toast.error(result.reason ?? "Límite de la API alcanzado.");
          return;
        }

        toast.success(
          result.rows === 0
            ? "Sin gasto registrado en este período."
            : `Actualizado: ${result.rows} día(s) de datos.`,
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={refresh}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RefreshCw className="size-3.5" />
      )}
      Actualizar
    </Button>
  );
}
