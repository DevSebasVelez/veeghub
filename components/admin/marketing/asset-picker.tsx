"use client";

import { useMemo, useState } from "react";
import { Check, ImagePlus } from "lucide-react";

import type { AssetDTO } from "@/lib/admin/queries/marketing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Picks library images for a post. Order of selection is the order in the
 * post; the editor can reorder afterwards.
 */
export function AssetPicker({
  library,
  selected,
  onChange,
}: {
  library: AssetDTO[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const images = library.filter((asset) => asset.mime.startsWith("image/"));
    if (!q) return images;
    return images.filter(
      (asset) =>
        asset.name.toLowerCase().includes(q) ||
        asset.r2Key.toLowerCase().includes(q) ||
        asset.tags.some((tag) => tag.includes(q)),
    );
  }, [library, query]);

  function toggle(id: string) {
    setDraft((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(selected);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ImagePlus className="size-3.5" />
          Elegir de la biblioteca
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Biblioteca</DialogTitle>
          <DialogDescription>
            Toca para agregar o quitar. El número es el orden en el post.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o etiqueta (manufactura, render…)"
        />
        {visible.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {visible.map((asset) => {
              const position = draft.indexOf(asset.id);
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => toggle(asset.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border text-left transition-shadow",
                    position !== -1 && "ring-2 ring-primary",
                  )}
                >
                  <div className="aspect-[4/3] bg-muted">
                    {asset.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed R2 URL
                      <img src={asset.url} alt={asset.alt ?? asset.name} loading="lazy" className="size-full object-cover" />
                    ) : null}
                  </div>
                  <div className="truncate px-1.5 py-1 text-xs" title={asset.r2Key}>
                    {asset.name}
                  </div>
                  {position !== -1 ? (
                    <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {position + 1}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay imágenes{query ? " con ese filtro" : " en la biblioteca"}.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            <Check className="size-4" />
            Usar {draft.length} imagen{draft.length === 1 ? "" : "es"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
