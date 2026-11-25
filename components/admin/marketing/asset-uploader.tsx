"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

import { createAsset } from "@/lib/admin/actions/marketing/actions";
import { ASSET_KIND_LABELS, ASSET_KINDS, type AssetKindValue } from "@/lib/marketing/constants";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  const url = URL.createObjectURL(file);
  const done = (value: { width: number; height: number } | null) => {
    URL.revokeObjectURL(url);
    return value;
  };

  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const image = new Image();
      image.onload = () => resolve(done({ width: image.naturalWidth, height: image.naturalHeight }));
      image.onerror = () => resolve(done(null));
      image.src = url;
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => resolve(done({ width: video.videoWidth, height: video.videoHeight }));
      video.onerror = () => resolve(done(null));
      video.src = url;
    } else {
      resolve(done(null));
    }
  });
}

function guessKind(file: File): AssetKindValue {
  if (file.type.startsWith("video/")) return "VIDEO";
  return "IMAGEN";
}

function put(url: string, file: File, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Subida fallida (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Error de red al subir"));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

export function AssetUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AssetKindValue | "auto">("auto");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function upload() {
    const files = [...(inputRef.current?.files ?? [])];
    if (!files.length) {
      toast.error("Elige al menos un archivo.");
      return;
    }

    setBusy(true);
    setProgress(0);
    const total = files.reduce((sum, file) => sum + file.size, 0) || 1;
    let done = 0;
    let ok = 0;

    for (const file of files) {
      try {
        if (!/^(image|video)\//.test(file.type)) throw new Error("sólo imágenes o videos");

        const presign = await fetch(
          `/api/admin/marketing/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
        );
        const body = (await presign.json()) as { url?: string; key?: string; error?: string };
        if (!presign.ok || !body.url || !body.key) throw new Error(body.error ?? "sin URL de subida");

        await put(body.url, file, (loaded) => setProgress(Math.round(((done + loaded) / total) * 100)));
        const dimensions = await readDimensions(file);

        const result = await createAsset({
          r2Key: body.key,
          name: file.name,
          mime: file.type,
          size: file.size,
          width: dimensions?.width ?? null,
          height: dimensions?.height ?? null,
          kind: kind === "auto" ? guessKind(file) : kind,
          tags,
          alt: "",
        });
        if (!result.ok) throw new Error(result.error);
        ok += 1;
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "no se pudo subir"}`);
      } finally {
        done += file.size;
        setProgress(Math.round((done / total) * 100));
      }
    }

    setBusy(false);
    if (ok) {
      toast.success(`${ok} archivo${ok === 1 ? "" : "s"} en la biblioteca.`);
      setOpen(false);
      setTags("");
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="size-3.5" />
          Subir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subir a la biblioteca</DialogTitle>
          <DialogDescription>Imágenes o videos. Se guardan en R2 con sus etiquetas.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Archivos</FieldLabel>
            <Input ref={inputRef} type="file" accept="image/*,video/*" multiple disabled={busy} />
          </Field>
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <Select value={kind} onValueChange={(value) => setKind(value as AssetKindValue | "auto")} disabled={busy}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Según el archivo</SelectItem>
                {ASSET_KINDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ASSET_KIND_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Etiquetas</FieldLabel>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="industria:construccion, render"
              disabled={busy}
            />
            <FieldDescription>Separadas por comas. Se aplican a todos los archivos.</FieldDescription>
          </Field>
          {busy ? <Progress value={progress} /> : null}
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={upload} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
