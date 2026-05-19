"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FaFile,
  FaFileCode,
  FaFilePdf,
  FaFileZipper,
  FaFolder,
  FaImage,
} from "react-icons/fa6";
import { Download, Eye, Grid2X2, List, Pencil, Trash2 } from "lucide-react";

import { deleteFolder, deleteDriveFile } from "@/app/admin/actions";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { DriveFileEditDialog } from "@/components/admin/dialogs/drive-file-dialog";
import { FolderEditDialog } from "@/components/admin/dialogs/folder-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes } from "@/lib/admin/format";

type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  clientId: string | null;
  projectId: string | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  _count?: { children: number; files: number };
};

type FileItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  clientId: string | null;
  projectId: string | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
};

type Client = { id: string; name: string };
type Project = { id: string; name: string };

function fileIcon(mimeType: string, size: "sm" | "lg" = "sm") {
  const cls = size === "lg" ? "size-10" : "size-5";
  if (mimeType.startsWith("image/"))
    return <FaImage className={`${cls} text-blue-500`} />;
  if (mimeType === "application/pdf")
    return <FaFilePdf className={`${cls} text-red-500`} />;
  if (mimeType.includes("zip") || mimeType.includes("compressed"))
    return <FaFileZipper className={`${cls} text-yellow-500`} />;
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript")
  )
    return <FaFileCode className={`${cls} text-green-500`} />;
  return <FaFile className={`${cls} text-muted-foreground`} />;
}

function isPreviewable(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

function FilePreviewModal({
  file,
  onClose,
}: {
  file: FileItem | null;
  onClose: () => void;
}) {
  if (!file) return null;

  const downloadUrl = `/admin/drive/download/${file.id}`;
  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">{file.name}</DialogTitle>
          <DialogDescription>
            {file.mimeType} · {formatBytes(file.size)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 overflow-auto">
          {isImage ? (
            <img
              src={downloadUrl}
              alt={file.name}
              className="max-h-[60vh] max-w-full rounded-lg object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={downloadUrl}
              className="h-[60vh] w-full rounded-lg border"
              title={file.name}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-10">
              {fileIcon(file.mimeType, "lg")}
              <p className="text-sm text-muted-foreground">
                Vista previa no disponible
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button asChild>
              <a href={downloadUrl} download={file.name}>
                <Download className="size-4" />
                Descargar
              </a>
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FolderCard({
  folder,
  clients,
  projects,
  onDelete,
}: {
  folder: FolderItem;
  clients: Client[];
  projects: Project[];
  onDelete: () => void;
}) {
  const subtitle = folder.project?.name ?? folder.client?.name ?? null;
  const count = (folder._count?.children ?? 0) + (folder._count?.files ?? 0);

  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-amber-200 hover:bg-amber-50/60 dark:hover:border-amber-800 dark:hover:bg-amber-950/30">
      <Link
        href={`/admin/drive?folder=${folder.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
          <FaFolder className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{folder.name}</div>
          {subtitle ? (
            <div className="truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
          {count > 0 ? (
            <div className="text-xs text-muted-foreground">
              {count} elemento{count !== 1 ? "s" : ""}
            </div>
          ) : null}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-1 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
        <FolderEditDialog
          folder={folder}
          clients={clients}
          projects={projects}
        />
        <ConfirmationDialog
          trigger={
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
              <Trash2 className="size-3.5" />
            </Button>
          }
          title="Eliminar carpeta"
          description={`¿Eliminar "${folder.name}"? Se eliminarán también sus archivos y subcarpetas.`}
          confirmLabel="Eliminar"
          destructive
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}

function FileCard({
  file,
  clients,
  projects,
  onPreview,
  onDelete,
}: {
  file: FileItem;
  clients: Client[];
  projects: Project[];
  onPreview: () => void;
  onDelete: () => void;
}) {
  const downloadUrl = `/admin/drive/download/${file.id}`;
  const canPreview = isPreviewable(file.mimeType);
  const isImage = file.mimeType.startsWith("image/");

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border bg-background transition-colors hover:border-primary/30 hover:shadow-sm">
      <button
        type="button"
        onClick={canPreview ? onPreview : undefined}
        className={`flex h-28 items-center justify-center bg-muted/40 ${canPreview ? "cursor-pointer" : "cursor-default"}`}
      >
        {isImage ? (
          <img
            src={downloadUrl}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          fileIcon(file.mimeType, "lg")
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-2.5">
        <div className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatBytes(file.size)}
        </div>
      </div>
      <div className="flex items-center gap-1 border-t px-2.5 py-1.5 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
        {canPreview ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onPreview}
          >
            <Eye className="size-3.5" />
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
          <a href={downloadUrl} download={file.name}>
            <Download className="size-3.5" />
          </a>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <DriveFileEditDialog
            file={file}
            clients={clients}
            projects={projects}
          />
          <ConfirmationDialog
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                <Trash2 className="size-3.5" />
              </Button>
            }
            title="Eliminar archivo"
            description={`¿Eliminar "${file.name}"?`}
            confirmLabel="Eliminar"
            destructive
            onConfirm={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function GridView({
  folders,
  files,
  clients,
  projects,
  onPreview,
  onDeleteFolder,
  onDeleteFile,
}: {
  folders: FolderItem[];
  files: FileItem[];
  clients: Client[];
  projects: Project[];
  onPreview: (f: FileItem) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteFile: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          clients={clients}
          projects={projects}
          onDelete={() => onDeleteFolder(folder.id)}
        />
      ))}
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          clients={clients}
          projects={projects}
          onPreview={() => onPreview(file)}
          onDelete={() => onDeleteFile(file.id)}
        />
      ))}
    </div>
  );
}

function ListView({
  folders,
  files,
  clients,
  projects,
  onPreview,
  onDeleteFolder,
  onDeleteFile,
}: {
  folders: FolderItem[];
  files: FileItem[];
  clients: Client[];
  projects: Project[];
  onPreview: (f: FileItem) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteFile: (id: string) => void;
}) {
  const downloadUrl = (id: string) => `/admin/drive/download/${id}`;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Tamaño</TableHead>
          <TableHead>Contexto</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {folders.map((folder) => (
          <TableRow key={folder.id} className="group">
            <TableCell>
              <Link
                href={`/admin/drive?folder=${folder.id}`}
                className="flex items-center gap-2 font-medium hover:underline"
              >
                <FaFolder className="size-4 shrink-0 text-amber-500" />
                {folder.name}
              </Link>
              {(folder.project?.name ?? folder.client?.name) ? (
                <div className="ml-6 text-xs text-muted-foreground">
                  {folder.project?.name ?? folder.client?.name}
                </div>
              ) : null}
            </TableCell>
            <TableCell className="text-muted-foreground">—</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {folder.project?.name ?? folder.client?.name ?? "General"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                <FolderEditDialog
                  folder={folder}
                  clients={clients}
                  projects={projects}
                />
                <ConfirmationDialog
                  trigger={
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  }
                  title="Eliminar carpeta"
                  description={`¿Eliminar "${folder.name}"?`}
                  confirmLabel="Eliminar"
                  destructive
                  onConfirm={() => onDeleteFolder(folder.id)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
        {files.map((file) => (
          <TableRow key={file.id} className="group">
            <TableCell>
              <div className="flex items-center gap-2">
                {fileIcon(file.mimeType)}
                <span className="font-medium">{file.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatBytes(file.size)}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {file.project?.name ?? file.client?.name ?? "General"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                {isPreviewable(file.mimeType) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPreview(file)}
                  >
                    <Eye className="size-4" />
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" asChild>
                  <a href={downloadUrl(file.id)} download={file.name}>
                    <Download className="size-4" />
                  </a>
                </Button>
                <DriveFileEditDialog
                  file={file}
                  clients={clients}
                  projects={projects}
                />
                <ConfirmationDialog
                  trigger={
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  }
                  title="Eliminar archivo"
                  description={`¿Eliminar "${file.name}"?`}
                  confirmLabel="Eliminar"
                  destructive
                  onConfirm={() => onDeleteFile(file.id)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
        {folders.length === 0 && files.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={4}
              className="h-24 text-center text-muted-foreground"
            >
              Esta carpeta está vacía.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

export function DriveView({
  folders,
  files,
  clients,
  projects,
}: {
  folders: FolderItem[];
  files: FileItem[];
  clients: Client[];
  projects: Project[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [preview, setPreview] = useState<FileItem | null>(null);

  const isEmpty = folders.length === 0 && files.length === 0;

  async function handleDeleteFolder(id: string) {
    try {
      await deleteFolder(id);
      router.refresh();
      toast.success("Carpeta eliminada.");
    } catch {
      toast.error("Error al eliminar carpeta");
    }
  }

  async function handleDeleteFile(id: string) {
    try {
      await deleteDriveFile(id);
      router.refresh();
      toast.success("Archivo eliminado.");
    } catch {
      toast.error("Error al eliminar archivo");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1">
        <Button
          variant={view === "grid" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setView("grid")}
          aria-label="Vista cuadrícula"
        >
          <Grid2X2 className="size-4" />
        </Button>
        <Button
          variant={view === "list" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setView("list")}
          aria-label="Vista lista"
        >
          <List className="size-4" />
        </Button>
      </div>

      {isEmpty ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
          <FaFolder className="size-8 text-muted-foreground/40" />
          <p className="text-sm">Esta carpeta está vacía</p>
        </div>
      ) : view === "grid" ? (
        <GridView
          folders={folders}
          files={files}
          clients={clients}
          projects={projects}
          onPreview={setPreview}
          onDeleteFolder={handleDeleteFolder}
          onDeleteFile={handleDeleteFile}
        />
      ) : (
        <ListView
          folders={folders}
          files={files}
          clients={clients}
          projects={projects}
          onPreview={setPreview}
          onDeleteFolder={handleDeleteFolder}
          onDeleteFile={handleDeleteFile}
        />
      )}

      <FilePreviewModal file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
