"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/field";

export type UploadedFile = {
  objectKey: string;
  name: string;
  mimeType: string;
  size: number;
};

type State =
  | { status: "idle" }
  | { status: "uploading"; name: string; progress: number }
  | { status: "done"; file: UploadedFile }
  | { status: "error"; name: string; message: string };

export function InvoiceFileUploader({
  label,
  accept,
  existingName,
  onUpload,
  onClear,
  onBusy,
}: {
  label: string;
  accept: string;
  existingName?: string | null;
  onUpload: (file: UploadedFile) => void;
  onClear: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState({ status: "uploading", name: file.name, progress: 0 });
    onBusy?.(true);

    try {
      const res = await fetch(
        `/api/admin/drive/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`,
      );
      if (!res.ok) throw new Error("Error al obtener URL de subida");
      const { url, key } = (await res.json()) as { url: string; key: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable)
            setState((prev) =>
              prev.status === "uploading"
                ? {
                    ...prev,
                    progress: Math.round((ev.loaded / ev.total) * 100),
                  }
                : prev,
            );
        };
        xhr.onload = () =>
          xhr.status < 300
            ? resolve()
            : reject(new Error(`HTTP ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Error de red"));
        xhr.open("PUT", url);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        xhr.send(file);
      });

      const uploaded: UploadedFile = {
        objectKey: key,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      };
      onUpload(uploaded);
      onBusy?.(false);
      setState({ status: "done", file: uploaded });
    } catch (err) {
      onBusy?.(false);
      setState({
        status: "error",
        name: file.name,
        message: err instanceof Error ? err.message : "Error al subir",
      });
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleClear() {
    onClear();
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>

      {state.status === "idle" ? (
        <div className="space-y-1">
          {existingName ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ {existingName} — selecciona para reemplazar
            </p>
          ) : null}
          <Input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="cursor-pointer"
          />
        </div>
      ) : state.status === "uploading" ? (
        <div className="space-y-1.5 rounded-md border bg-muted/30 p-2.5">
          <p className="truncate text-xs text-muted-foreground">{state.name}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{state.progress}%</p>
        </div>
      ) : state.status === "done" ? (
        <div className="flex items-center gap-2 rounded-md border bg-emerald-50/50 px-3 py-2 dark:bg-emerald-950/20">
          <p className="flex-1 truncate text-xs font-medium text-emerald-600 dark:text-emerald-400">
            ✓ {state.file.name}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={handleClear}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-destructive">{state.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setState({ status: "idle" });
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
