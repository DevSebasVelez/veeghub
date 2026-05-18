"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { registerDriveFile } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function DriveUploader({
  folderId,
  clientId,
  projectId,
}: {
  folderId: string | null;
  clientId?: string | null;
  projectId?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [, startTransition] = useTransition();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      const presignRes = await fetch(
        `/api/admin/drive/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`,
      );
      if (!presignRes.ok) throw new Error("Error al obtener URL de subida");
      const { url, key } = (await presignRes.json()) as {
        url: string;
        key: string;
      };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () =>
          xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload fallido: ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Error de red al subir"));
        xhr.open("PUT", url);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        xhr.send(file);
      });

      const formData = new FormData();
      formData.set("name", file.name);
      formData.set("objectKey", key);
      formData.set("mimeType", file.type || "application/octet-stream");
      formData.set("size", String(file.size));
      if (folderId) formData.set("folderId", folderId);
      if (clientId) formData.set("clientId", clientId);
      if (projectId) formData.set("projectId", projectId);

      startTransition(async () => {
        await registerDriveFile(formData);
        router.refresh();
        toast.success(`"${file.name}" subido correctamente.`);
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al subir el archivo",
      );
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant="default"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="size-4" />
        {uploading ? `Subiendo ${progress}%` : "Subir archivo"}
      </Button>
      {uploading ? (
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
