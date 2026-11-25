import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, ExternalLink } from "lucide-react";

import { StatusBadge } from "@/components/admin/marketing/post-chip";
import { PostEditor } from "@/components/admin/marketing/post-editor";
import { PostStatusActions, PublishKit } from "@/components/admin/marketing/post-actions";
import { getAssets, getCampaignOptions, getPostDetail } from "@/lib/admin/queries/marketing";
import { CHANNELS } from "@/lib/marketing/constants";
import { cn } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, campaigns, library] = await Promise.all([
    getPostDetail(id),
    getCampaignOptions(),
    getAssets(),
  ]);

  if (!post) notFound();

  const channel = CHANNELS[post.channel];
  const campaign = campaigns.find((c) => c.id === post.campaignId);
  const showKit = ["APROBADO", "PROGRAMADO", "FALLIDO", "PUBLICADO"].includes(post.status);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/marketing/calendario"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Calendario
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{post.title}</h2>
          <StatusBadge status={post.status} />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:order-2">
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="text-sm font-semibold">Estado</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Nada sale sin «Aprobar». Aprobar usa la última versión guardada.
            </p>
            <div className="mt-4">
              <PostStatusActions post={post} />
            </div>
            {post.status === "PROGRAMADO" ? (
              <p className="mt-3 flex gap-1.5 rounded-xl bg-orange-500/10 p-3 text-sm text-orange-700 dark:text-orange-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Ya llegó la hora. Publícalo y márcalo publicado con su URL.
              </p>
            ) : null}
            {post.error ? (
              <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{post.error}</p>
            ) : null}
          </section>

          {showKit ? (
            <section className="rounded-2xl border bg-card p-5">
              <h3 className="text-sm font-semibold">Publicar a mano</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {channel.short} aún no tiene API: copia, descarga y abre.
              </p>
              <div className="mt-4">
                <PublishKit post={post} />
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border bg-card px-5 py-3">
            <div className="divide-y">
              <Row label="Canal">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", channel.dot)} />
                  {channel.label}
                </span>
              </Row>
              <Row label="Fecha">{post.scheduledLabel ?? "Sin fecha"}</Row>
              <Row label="Campaña">{campaign?.name ?? "Sin campaña"}</Row>
              <Row label="Imágenes">{post.assets.length}</Row>
              {post.approvedLabel ? <Row label="Aprobado">{post.approvedLabel}</Row> : null}
              {post.publishedLabel ? <Row label="Publicado">{post.publishedLabel}</Row> : null}
              {post.externalUrl ? (
                <Row label="Enlace">
                  <a
                    href={post.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Ver post <ExternalLink className="size-3.5" />
                  </a>
                </Row>
              ) : null}
            </div>
          </section>
        </aside>

        <section className="rounded-2xl border bg-card p-5 sm:p-6 lg:order-1">
          <PostEditor
            key={post.status + post.scheduledLocal}
            post={post}
            campaigns={campaigns}
            library={library}
          />
        </section>
      </div>
    </div>
  );
}
