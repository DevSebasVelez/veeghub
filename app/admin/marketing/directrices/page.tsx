import { BookOpenText } from "lucide-react";

import { IconTile } from "@/components/admin/tone";
import {
  GuidelineEditor,
  NewGuidelineDialog,
  SeedGuidelinesButton,
} from "@/components/admin/marketing/guideline-editor";
import { formatDate } from "@/lib/admin/format";
import { getGuidelines } from "@/lib/admin/queries/marketing";
import { GUIDELINE_SEEDS } from "@/lib/marketing/guidelines-seed";

export default async function GuidelinesPage() {
  const guidelines = await getGuidelines();
  const keys = new Set(guidelines.map((g) => g.key));
  const missing = GUIDELINE_SEEDS.filter((seed) => !keys.has(seed.key)).length;
  const active = guidelines.filter((g) => g.active).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Las reglas de marca de VeegSoft. Toda generación con IA las recibe como prefijo fijo, en
          este orden; las inactivas no se envían. {guidelines.length ? `${active} de ${guidelines.length} activas.` : ""}
        </p>
        <div className="flex gap-2">
          {missing ? <SeedGuidelinesButton missing={missing} /> : null}
          <NewGuidelineDialog />
        </div>
      </div>

      {guidelines.length ? (
        <>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {guidelines.map((g) => (
              <a key={g.id} href={`#${g.key}`} className="text-muted-foreground hover:text-foreground hover:underline">
                {g.title}
              </a>
            ))}
          </nav>
          <div className="space-y-3">
            {guidelines.map((g) => (
              <GuidelineEditor
                key={`${g.id}-${g.updatedAt.getTime()}`}
                guideline={{
                  id: g.id,
                  key: g.key,
                  title: g.title,
                  content: g.content,
                  active: g.active,
                  updatedLabel: formatDate(g.updatedAt),
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          <IconTile icon={BookOpenText} tone="teal" size="lg" className="mx-auto mb-4" />
          Todavía no hay directrices. Carga las de base: salen de <code>veegsoft-web/CLAUDE.md</code>,
          la guía de LinkedIn y GBP y la guía de estilo de reels.
        </div>
      )}
    </div>
  );
}
