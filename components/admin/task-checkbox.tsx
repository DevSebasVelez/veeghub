"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { toggleTaskStatus } from "@/app/admin/actions";
import { Checkbox } from "@/components/ui/checkbox";

export function TaskCheckbox({ id, done }: { id: string; done: boolean }) {
  const router = useRouter();

  async function handleChange(checked: boolean) {
    try {
      await toggleTaskStatus(id, checked);
      router.refresh();
    } catch {
      toast.error("Error al actualizar tarea");
    }
  }

  return (
    <Checkbox
      checked={done}
      onCheckedChange={(v) => handleChange(!!v)}
      className="mt-0.5 shrink-0"
    />
  );
}
