"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";

import {
  generateRecurringExpenses,
  setRecurringExpenseActive,
} from "@/lib/admin/actions/recurring-expenses/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function GenerateRecurringButton({ missing }: { missing: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      variant={missing > 0 ? "default" : "outline"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await generateRecurringExpenses();
          if (!result.ok) {
            toast.error(result.error ?? "No se pudo generar.");
            return;
          }
          toast.success(result.message ?? "Listo.");
          router.refresh();
        })
      }
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Repeat className="size-3.5" />
      )}
      Generar pendientes{missing > 0 ? ` (${missing})` : ""}
    </Button>
  );
}

export function RecurringActiveSwitch({
  id,
  active,
  label,
}: {
  id: string;
  active: boolean;
  label: string;
}) {
  const [checked, setChecked] = useState(active);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Switch
      checked={checked}
      disabled={pending}
      aria-label={label}
      onCheckedChange={(value) => {
        setChecked(value);
        startTransition(async () => {
          const result = await setRecurringExpenseActive(id, value);
          if (!result.ok) {
            setChecked(!value);
            toast.error(result.error ?? "No se pudo actualizar.");
            return;
          }
          toast.success(value ? "Plantilla activada." : "Plantilla pausada.");
          router.refresh();
        });
      }}
    />
  );
}
