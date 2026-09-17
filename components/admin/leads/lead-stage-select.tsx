"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateLeadStage } from "@/lib/admin/actions/leads/actions";
import { STAGE_LABELS, STAGE_TEXT_COLOR } from "@/components/admin/leads/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS = Object.keys(STAGE_LABELS);

export function LeadStageSelect({
  id,
  stage,
  className = "",
}: {
  id: string;
  stage: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(stage);
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    const previous = value;
    // Optimistic: the board must feel instant while dragging through stages.
    setValue(next);

    startTransition(async () => {
      try {
        await updateLeadStage(id, next);
        router.refresh();
        toast.success(`Movido a ${STAGE_LABELS[next]}.`);
      } catch (err) {
        setValue(previous);
        toast.error(err instanceof Error ? err.message : "Error al mover");
      }
    });
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger
        className={`h-9 w-full border-transparent bg-transparent px-2 text-sm font-medium shadow-none hover:border-border hover:bg-muted/40 focus:ring-0 md:h-7 md:text-xs ${STAGE_TEXT_COLOR[value] ?? ""} ${className}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem
            key={option}
            value={option}
            className={`text-sm md:text-xs ${STAGE_TEXT_COLOR[option] ?? ""}`}
          >
            {STAGE_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
