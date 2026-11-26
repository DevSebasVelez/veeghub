"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileVideo, Loader2, Pencil, Trash2 } from "lucide-react";

import { deleteAsset, updateAsset } from "@/lib/admin/actions/marketing/actions";
import type { AssetDTO } from "@/lib/admin/queries/marketing";
import { formatBytes } from "@/lib/admin/format";
import { ASSET_KIND_LABELS, ASSET_KINDS } from "@/lib/marketing/constants";
import { ImageViewer } from "@/components/admin/marketing/image-viewer";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { FormSelect } from "@/components/admin/form-select";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AssetCard({ asset }: { asset: AssetDTO }) {
  const router = useRouter();
  const [viewing, setViewing] = useState<number | null>(null);
  const isImage = asset.mime.startsWith("image/");

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => (isImage ? setViewing(0) : window.open(`/api/admin/marketing/assets/${asset.id}`, "_blank", "noopener"))}
        aria-label={`Ver ${asset.name}`}
        className="block aspect-[4/3] w-full bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        {asset.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed R2 URL
          <img src={asset.url} alt={asset.alt ?? asset.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <FileVideo className="size-8" />
          </div>
        )}
      </button>
      {isImage ? <ImageViewer images={[asset]} index={viewing} onIndexChange={setViewing} /> : null}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="truncate text-sm font-medium" title={asset.r2Key}>
          {asset.name}
        </div>
        <div className="text-xs text-muted-foreground">
          {ASSET_KIND_LABELS[asset.kind]}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
          {asset.size ? ` · ${formatBytes(asset.size)}` : ""}
          {asset.usedIn ? ` · en ${asset.usedIn} post${asset.usedIn === 1 ? "" : "s"}` : ""}
        </div>
        {asset.tags.length ? (
          <div className="flex flex-wrap gap-1">
            {asset.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex gap-1 pt-1">
          <EditAssetDialog asset={asset} />
          <Button asChild variant="ghost" size="icon-sm" className="max-sm:size-10" aria-label={`Descargar ${asset.name}`}>
            <a href={`/api/admin/marketing/assets/${asset.id}?descargar=1`}>
              <Download className="size-3.5" />
            </a>
          </Button>
          <ConfirmationDialog
            title="¿Eliminar este archivo?"
            description="Se borra de la biblioteca y de R2. No se puede deshacer."
            confirmLabel="Eliminar"
            destructive
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${asset.name}`} className="text-destructive hover:text-destructive max-sm:size-10">
                <Trash2 className="size-3.5" />
              </Button>
            }
            onConfirm={async () => {
              const result = await deleteAsset(asset.id);
              if (!result.ok) {
                toast.error(result.error ?? "No se pudo eliminar.");
                return;
              }
              toast.success("Archivo eliminado.");
              router.refresh();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function EditAssetDialog({ asset }: { asset: AssetDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await updateAsset(asset.id, new FormData(event.currentTarget));
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Guardado.");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="max-sm:size-10" aria-label={`Editar ${asset.name}`}>
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar recurso</DialogTitle>
          <DialogDescription className="break-all">{asset.r2Key}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input name="name" defaultValue={asset.name} required />
            </Field>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <FormSelect
                name="kind"
                defaultValue={asset.kind}
                options={ASSET_KINDS.map((value) => ({ value, label: ASSET_KIND_LABELS[value] }))}
              />
            </Field>
            <Field>
              <FieldLabel>Etiquetas</FieldLabel>
              <Input name="tags" defaultValue={asset.tags.join(", ")} placeholder="industria:salud, visor" />
            </Field>
            <Field>
              <FieldLabel>Texto alternativo</FieldLabel>
              <Input name="alt" defaultValue={asset.alt ?? ""} placeholder="Render 3D de la planta" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
