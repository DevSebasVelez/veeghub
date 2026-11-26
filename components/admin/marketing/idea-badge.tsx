import { IDEA_STAGE_BADGES, IDEA_STAGE_DOTS, IDEA_STAGE_LABELS, type IdeaStage } from "@/lib/marketing/constants";
import { cn } from "@/lib/utils";

export function IdeaStageBadge({ stage }: { stage: IdeaStage }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        IDEA_STAGE_BADGES[stage],
      )}
    >
      <span className={cn("size-1.5 rounded-full", IDEA_STAGE_DOTS[stage])} />
      {IDEA_STAGE_LABELS[stage]}
    </span>
  );
}
