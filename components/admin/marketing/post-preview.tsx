"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, ImageIcon, Loader2, Share2 } from "lucide-react";

import type { PostDetailDTO } from "@/lib/admin/queries/marketing";
import { CHANNELS } from "@/lib/marketing/constants";
import { buildUtmUrl, renderFirstComment } from "@/lib/marketing/utm";
import { CopyButton } from "@/components/admin/marketing/copy-button";
import { ImageViewer, assetSrc } from "@/components/admin/marketing/image-viewer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Touch devices with the Web Share API: the share sheet sends files to the channel's app. */
function detectShare() {
  return (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ text: "x" }) &&
    window.matchMedia("(pointer: coarse)").matches
  );
}
const noSubscribe = () => () => {};

/** Statuses where publishing is the next step: the channel button is the main action. */
const READY = ["APROBADO", "PROGRAMADO", "FALLIDO"];

function Block({
  label,
  helper,
  text,
  copyLabel,
  mono,
}: {
  label: string;
  helper?: string;
  text: string;
  copyLabel: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{label}</h3>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        <CopyButton text={text} label={copyLabel} className="shrink-0" />
      </div>
      <p
        className={cn(
          "select-text whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-[15px] leading-6 [overflow-wrap:anywhere]",
          mono && "text-sm",
        )}
      >
        {text}
      </p>
    </div>
  );
}

/**
 * What the post looks like and everything needed to publish it by hand
 * (decision 7): copy the text and the comment, see and download the images,
 * and on a phone share them straight to the channel's app.
 */
export function PostPreview({ post }: { post: PostDetailDTO }) {
  const channel = CHANNELS[post.channel];
  const [viewing, setViewing] = useState<number | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const canShare = useSyncExternalStore(noSubscribe, detectShare, () => false);
  const [sharing, setSharing] = useState(false);

  const utmUrl = buildUtmUrl({
    linkUrl: post.linkUrl,
    channel: post.channel,
    campaignSlug: post.campaignSlug,
    postId: post.id,
  });
  const comment = channel.linkInComment ? renderFirstComment(post.firstComment, utmUrl) : null;
  const ready = READY.includes(post.status);
  const images = post.assets.filter((asset) => asset.mime.startsWith("image/"));
  const assetKey = post.assets.map((asset) => asset.id).join(",");

  // Phones only: fetch the images up front, because iOS refuses navigator.share
  // if it is called after an await that outlived the tap.
  useEffect(() => {
    if (!canShare || !images.length) return;
    let cancelled = false;

    Promise.all(
      images.map(async (asset) => {
        const response = await fetch(`${assetSrc(asset.id)}?archivo=1`);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        return new File([blob], asset.name, { type: asset.mime });
      }),
    )
      .then((loaded) => {
        if (!cancelled && navigator.canShare({ files: loaded })) setFiles(loaded);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the attached images change
  }, [assetKey, canShare]);

  async function share() {
    setSharing(true);
    try {
      // Most apps drop the shared text when images go along: leave it on the
      // clipboard so it is one paste away.
      navigator.clipboard.writeText(post.body).catch(() => null);
      await navigator.share(files?.length ? { files, text: post.body } : { text: post.body });
      toast.success("Texto copiado: pégalo en la publicación.");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error("No se pudo compartir. Usa «Copiar texto» y «Descargar».");
      }
    } finally {
      setSharing(false);
    }
  }

  function downloadAll() {
    // Staggered: browsers drop simultaneous downloads started by one click.
    post.assets.forEach((asset, index) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = `${assetSrc(asset.id)}?descargar=1`;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 400);
    });
  }

  const shareWaiting = canShare && images.length > 0 && !files;

  return (
    <div className="space-y-6">
      <Block
        label="Texto"
        helper={`${post.body.length.toLocaleString("es-EC")}${channel.maxChars ? ` / ${channel.maxChars.toLocaleString("es-EC")}` : ""} caracteres`}
        text={post.body}
        copyLabel="Copiar texto"
      />

      {comment ? (
        <Block
          label="Primer comentario"
          helper="Pégalo apenas publiques: el enlace va aquí, no en el post."
          text={comment}
          copyLabel="Copiar comentario"
          mono
        />
      ) : utmUrl ? (
        <Block label="Enlace" helper="Con su UTM." text={utmUrl} copyLabel="Copiar enlace" mono />
      ) : null}

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Imágenes</h3>
            <p className="text-xs text-muted-foreground">
              {post.assets.length
                ? "En este orden. Toca una para verla completa."
                : "Este post sale sólo con texto."}
            </p>
          </div>
          {post.assets.length ? (
            <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 px-3 sm:h-8" onClick={downloadAll}>
              <Download className="size-4" />
              Descargar{post.assets.length > 1 ? ` ${post.assets.length}` : ""}
            </Button>
          ) : null}
        </div>

        {post.assets.length ? (
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {post.assets.map((asset) => {
              const imageIndex = images.findIndex((image) => image.id === asset.id);
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    disabled={imageIndex < 0}
                    onClick={() => setViewing(imageIndex)}
                    className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    aria-label={`Ver ${asset.name}`}
                  >
                    {imageIndex >= 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed R2 URL
                      <img
                        src={asset.url ?? assetSrc(asset.id)}
                        alt={asset.alt ?? asset.name}
                        loading="lazy"
                        className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-6" />
                      </span>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-background/90 px-1.5 text-xs font-medium tabular-nums text-foreground">
                      {post.assets.indexOf(asset) + 1}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
        {canShare ? (
          <Button
            type="button"
            variant={ready ? "default" : "outline"}
            className="h-11 sm:h-9"
            onClick={share}
            disabled={sharing || shareWaiting}
          >
            {sharing || shareWaiting ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
            {shareWaiting ? "Preparando imágenes…" : `Compartir${images.length ? " con imágenes" : ""}`}
          </Button>
        ) : null}
        <Button
          asChild
          variant={ready && !canShare ? "default" : "outline"}
          className="h-11 sm:h-9"
        >
          <a href={channel.openUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Abrir {channel.short}
          </a>
        </Button>
      </div>

      <ImageViewer images={images} index={viewing} onIndexChange={setViewing} />
    </div>
  );
}
