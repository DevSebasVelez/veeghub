"use client";

import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type ViewerImage = {
  id: string;
  name: string;
  alt: string | null;
};

/** Same-origin URL that redirects to a fresh signed one: never expires on an open page. */
export function assetSrc(id: string) {
  return `/api/admin/marketing/assets/${id}`;
}

/**
 * Full-screen image viewer: arrows or swipe to move, Esc to close, and a
 * download for the image on screen. `index` null means closed.
 */
export function ImageViewer({
  images,
  index,
  onIndexChange,
}: {
  images: ViewerImage[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const touchX = useRef<number | null>(null);
  const open = index !== null && images[index] !== undefined;
  const image = open ? images[index] : null;
  const many = images.length > 1;

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    if (!open || !many) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, many, go]);

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? null : onIndexChange(null))}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-0 rounded-none bg-black p-0 text-white ring-0 sm:h-[92dvh] sm:max-w-[min(92vw,1400px)] sm:rounded-2xl"
        onTouchStart={(event) => (touchX.current = event.touches[0]?.clientX ?? null)}
        onTouchEnd={(event) => {
          const start = touchX.current;
          const end = event.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start === null || end === undefined || !many) return;
          if (Math.abs(end - start) > 50) go(end < start ? 1 : -1);
        }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-medium text-white">{image?.name}</DialogTitle>
            <DialogDescription className="text-xs tabular-nums text-white/60">
              {many && index !== null ? `${index + 1} de ${images.length}` : "Imagen"}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {image ? (
              <Button asChild variant="ghost" size="icon-lg" className="text-white hover:bg-white/10 hover:text-white">
                <a href={`${assetSrc(image.id)}?descargar=1`} aria-label="Descargar esta imagen">
                  <Download className="size-5" />
                </a>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-lg"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => onIndexChange(null)}
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- redirects to a signed R2 URL
            <img
              key={image.id}
              src={assetSrc(image.id)}
              alt={image.alt ?? image.name}
              className="max-h-full max-w-full select-none object-contain"
              draggable={false}
            />
          ) : null}

          {many ? (
            <>
              <Button
                variant="ghost"
                size="icon-lg"
                onClick={() => go(-1)}
                aria-label="Imagen anterior"
                className="absolute left-2 top-1/2 size-11 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white"
              >
                <ChevronLeft className="size-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon-lg"
                onClick={() => go(1)}
                aria-label="Imagen siguiente"
                className="absolute right-2 top-1/2 size-11 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white"
              >
                <ChevronRight className="size-6" />
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
