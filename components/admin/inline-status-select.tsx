"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateReceivableStatus } from "@/app/admin/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const options = [
  { value: "PLANNED", label: "Planificado" },
  { value: "INVOICED", label: "Facturado" },
  { value: "PARTIALLY_PAID", label: "Pago parcial" },
  { value: "PAID", label: "Pagado" },
  { value: "OVERDUE", label: "Vencido" },
  { value: "CANCELLED", label: "Cancelado" },
];

const colorClass: Record<string, string> = {
  PLANNED: "text-muted-foreground",
  INVOICED: "text-blue-600",
  PARTIALLY_PAID: "text-amber-600",
  PAID: "text-emerald-600",
  OVERDUE: "text-destructive",
  CANCELLED: "text-muted-foreground line-through",
};

export function InlineStatusSelect({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();

  async function handleChange(value: string) {
    try {
      await updateReceivableStatus(id, value);
      router.refresh();
      toast.success("Estado actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    }
  }

  return (
    <Select defaultValue={status} onValueChange={handleChange}>
      <SelectTrigger
        className={`h-7 w-36 border-transparent bg-transparent px-2 text-xs font-medium shadow-none hover:border-border hover:bg-muted/40 focus:ring-0 ${colorClass[status] ?? ""}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className={`text-xs ${colorClass[opt.value] ?? ""}`}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
