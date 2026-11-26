import { IDEA_STAGE_BADGES, IDEA_STAGE_DOTS, IDEA_STAGE_LABELS, type IdeaStage } from "@/lib/marketing/constants";
import { ToneTag, type Tone } from "@/components/admin/tone";
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

const CATEGORY_TONES: Array<[RegExp, Tone]> = [
  [/principal/i, "violet"],
  [/enterprise|largo/i, "indigo"],
  [/venta/i, "orange"],
  [/universal/i, "sky"],
  [/ingenier|\bia\b/i, "teal"],
];

/** Each bank category keeps one tone everywhere (cards, filters, ficha). */
export function categoryTone(category: string | null | undefined): Tone {
  if (!category) return "zinc";
  return CATEGORY_TONES.find(([pattern]) => pattern.test(category))?.[1] ?? "pink";
}

export function IdeaCategoryTag({ category }: { category: string | null | undefined }) {
  if (!category) return null;
  return <ToneTag tone={categoryTone(category)}>{category}</ToneTag>;
}
