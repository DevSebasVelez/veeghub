import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight, HardDrive } from "lucide-react";
import { Prisma } from "@/app/generated/prisma/client";

import { CreateFolderDialog } from "@/components/admin/dialogs/folder-dialog";
import { DriveUploader } from "@/components/admin/drive-uploader";
import { DriveView } from "@/components/admin/drive-view";
import { DriveSidebar } from "@/components/admin/drive-sidebar";
import { forDriveViewFile, forDriveViewFolder } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";

type BreadcrumbItem = {
  id: string;
  name: string;
  parentId: string | null;
  clientId: string | null;
  projectId: string | null;
};

async function getBreadcrumb(
  folderId: string | null,
): Promise<BreadcrumbItem[]> {
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

function appendFolder(base: string, folderId: string) {
  return base.includes("?")
    ? `${base}&folder=${folderId}`
    : `${base}?folder=${folderId}`;
}

export default async function DrivePage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; section?: string; id?: string }>;
}) {
  const { folder: folderParam, section, id: sectionId } = await searchParams;
  const folderId = folderParam ?? null;

  let folderWhere: Prisma.DriveFolderWhereInput;
  let fileWhere: Prisma.DriveFileWhereInput;

  if (folderId) {
    folderWhere = { parentId: folderId };
    fileWhere = { folderId };
  } else if (section === "client" && sectionId) {
    folderWhere = { parentId: null, clientId: sectionId };
    fileWhere = { folderId: null, clientId: sectionId };
  } else if (section === "project" && sectionId) {
    folderWhere = { parentId: null, projectId: sectionId };
    fileWhere = { folderId: null, projectId: sectionId };
  } else {
    folderWhere = { parentId: null, clientId: null, projectId: null };
    fileWhere = { folderId: null, clientId: null, projectId: null };
  }

  const [
    breadcrumb,
    folders,
    files,
    clients,
    projects,
    sidebarClients,
    sidebarProjects,
  ] = await Promise.all([
    getBreadcrumb(folderId),
    prisma.driveFolder.findMany({
      where: folderWhere,
      orderBy: { name: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { children: true, files: true } },
      },
    }),
    prisma.driveFile.findMany({
      where: fileWhere,
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
    prisma.client.findMany({
      where: { OR: [{ files: { some: {} } }, { folders: { some: {} } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { OR: [{ files: { some: {} } }, { folders: { some: {} } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const currentFolder = breadcrumb[breadcrumb.length - 1] ?? null;

  const sectionBase =
    section && sectionId
      ? `/admin/drive?section=${section}&id=${sectionId}`
      : "/admin/drive";

  let sectionLabel: string | null = null;
  let sectionHref: string | null = null;
  if (section === "client" && sectionId) {
    const client = clients.find((c) => c.id === sectionId);
    sectionLabel = client?.name ?? null;
    sectionHref = `/admin/drive?section=client&id=${sectionId}`;
  } else if (section === "project" && sectionId) {
    const project = projects.find((p) => p.id === sectionId);
    sectionLabel = project?.name ?? null;
    sectionHref = `/admin/drive?section=project&id=${sectionId}`;
  }

  const contextClientId =
    currentFolder?.clientId ??
    (section === "client" ? (sectionId ?? null) : null);
  const contextProjectId =
    currentFolder?.projectId ??
    (section === "project" ? (sectionId ?? null) : null);

  const isRootActive = !sectionLabel && breadcrumb.length === 0;

  return (
    <div className="min-w-0 space-y-5 md:flex md:gap-6 md:space-y-0">
      <DriveSidebar
        clients={sidebarClients}
        projects={sidebarProjects}
        activeSection={section ?? null}
        activeSectionId={sectionId ?? null}
      />

      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm text-muted-foreground sm:gap-2">
              <Link
                href="/admin/drive"
                className={
                  isRootActive
                    ? "flex shrink-0 items-center gap-1 font-medium text-foreground"
                    : "flex shrink-0 items-center gap-1 hover:text-foreground"
                }
              >
                <HardDrive className="size-3.5" />
                <span className="hidden sm:inline">Drive</span>
              </Link>

              {sectionLabel && sectionHref ? (
                <>
                  <ChevronRight className="size-3.5 shrink-0" />
                  <Link
                    href={sectionHref}
                    className={
                      breadcrumb.length === 0
                        ? "min-w-0 max-w-[42vw] truncate font-medium text-foreground sm:max-w-48"
                        : "min-w-0 max-w-[30vw] truncate hover:text-foreground sm:max-w-32"
                    }
                  >
                    {sectionLabel}
                  </Link>
                </>
              ) : null}

              {breadcrumb.map((crumb, i) => (
                <Fragment key={crumb.id}>
                  <ChevronRight className="size-3.5 shrink-0" />
                  <Link
                    href={appendFolder(sectionBase, crumb.id)}
                    className={
                      i === breadcrumb.length - 1
                        ? "min-w-0 max-w-[42vw] truncate font-medium text-foreground sm:max-w-48"
                        : "min-w-0 max-w-[30vw] truncate hover:text-foreground sm:max-w-32"
                    }
                  >
                    {crumb.name}
                  </Link>
                </Fragment>
              ))}
            </div>

            <h1 className="wrap-break-word text-2xl font-semibold tracking-tight">
              {currentFolder?.name ?? sectionLabel ?? "Mi Drive"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {currentFolder || sectionLabel
                ? `${folders.length} carpeta${folders.length !== 1 ? "s" : ""}, ${files.length} archivo${files.length !== 1 ? "s" : ""}`
                : "Almacenamiento de archivos para proyectos y clientes."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-start">
            <CreateFolderDialog
              parentId={folderId}
              clientId={contextClientId}
              projectId={contextProjectId}
            />
            <DriveUploader
              folderId={folderId}
              clientId={contextClientId}
              projectId={contextProjectId}
            />
          </div>
        </div>

        <DriveView
          folders={folders.map(forDriveViewFolder)}
          files={files.map(forDriveViewFile)}
          clients={clients}
          projects={projects}
          folderBase={sectionBase}
        />
      </div>
    </div>
  );
}
