import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight, HardDrive } from "lucide-react";

import { CreateFolderDialog } from "@/components/admin/dialogs/folder-dialog";
import { DriveUploader } from "@/components/admin/drive-uploader";
import { DriveView } from "@/components/admin/drive-view";
import { forDriveViewFile, forDriveViewFolder } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";

type BreadcrumbItem = {
  id: string;
  name: string;
  parentId: string | null;
  clientId: string | null;
  projectId: string | null;
};

async function getBreadcrumb(folderId: string | null): Promise<BreadcrumbItem[]> {
  const crumbs: BreadcrumbItem[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const folder = await prisma.driveFolder.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        name: true,
        parentId: true,
        clientId: true,
        projectId: true,
      },
    });
    if (!folder) break;
    crumbs.unshift(folder);
    currentId = folder.parentId;
  }

  return crumbs;
}

export default async function DrivePage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder: folderParam } = await searchParams;
  const folderId = folderParam ?? null;

  const [breadcrumb, folders, files, clients, projects] = await Promise.all([
    getBreadcrumb(folderId),
    prisma.driveFolder.findMany({
      where: { parentId: folderId },
      orderBy: { name: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { children: true, files: true } },
      },
    }),
    prisma.driveFile.findMany({
      where: { folderId },
      orderBy: { name: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const currentFolder = breadcrumb[breadcrumb.length - 1] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/admin/drive"
              className={
                breadcrumb.length === 0
                  ? "flex items-center gap-1 font-medium text-foreground"
                  : "flex items-center gap-1 hover:text-foreground"
              }
            >
              <HardDrive className="size-3.5" />
              Drive
            </Link>
            {breadcrumb.map((crumb, i) => (
              <Fragment key={crumb.id}>
                <ChevronRight className="size-3.5 shrink-0" />
                <Link
                  href={`/admin/drive?folder=${crumb.id}`}
                  className={
                    i === breadcrumb.length - 1
                      ? "max-w-48 truncate font-medium text-foreground"
                      : "max-w-32 truncate hover:text-foreground"
                  }
                >
                  {crumb.name}
                </Link>
              </Fragment>
            ))}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {currentFolder?.name ?? "Drive"}
          </h1>
          {currentFolder ? (
            <p className="text-sm text-muted-foreground">
              {folders.length} carpeta{folders.length !== 1 ? "s" : ""},{" "}
              {files.length} archivo{files.length !== 1 ? "s" : ""}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Almacenamiento de archivos para proyectos y clientes.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <CreateFolderDialog
            parentId={folderId}
            clients={clients}
            projects={projects}
            defaultClientId={currentFolder?.clientId}
            defaultProjectId={currentFolder?.projectId}
          />
          <DriveUploader
            folderId={folderId}
            clientId={currentFolder?.clientId}
            projectId={currentFolder?.projectId}
          />
        </div>
      </div>

      <DriveView
        folders={folders.map(forDriveViewFolder)}
        files={files.map(forDriveViewFile)}
        clients={clients}
        projects={projects}
      />
    </div>
  );
}
