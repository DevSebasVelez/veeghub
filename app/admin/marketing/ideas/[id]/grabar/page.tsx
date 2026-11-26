import { notFound } from "next/navigation";

import { Teleprompter } from "@/components/admin/marketing/teleprompter";
import { getIdeaDetail, getIdeaNeighbors } from "@/lib/admin/queries/marketing";

export default async function RecordIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [idea, neighbors] = await Promise.all([getIdeaDetail(id), getIdeaNeighbors(id)]);
  if (!idea) notFound();

  const base = "/admin/marketing/ideas";

  return (
    <Teleprompter
      key={idea.id}
      idea={{
        id: idea.id,
        title: idea.title,
        beats: idea.beats,
        alternativeHook: idea.alternativeHook,
        stage: idea.stage,
      }}
      backHref={`${base}/${idea.id}`}
      prevHref={neighbors.prev ? `${base}/${neighbors.prev}/grabar` : null}
      nextHref={neighbors.next ? `${base}/${neighbors.next}/grabar` : null}
    />
  );
}
