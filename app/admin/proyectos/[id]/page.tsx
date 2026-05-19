import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  ExternalLink,
  HardDrive,
  KeyRound,
} from "lucide-react";
import { FaGithub } from "react-icons/fa6";

import { CredentialDialog } from "@/components/admin/dialogs/credential-dialog";
import { CredentialViewDialog } from "@/components/admin/dialogs/credential-view-dialog";
import { CreateFolderDialog } from "@/components/admin/dialogs/folder-dialog";
import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import {
  ReceivableDialog,
  SinglePaymentDialog,
} from "@/components/admin/dialogs/receivable-dialog";
import { TaskDialog } from "@/components/admin/dialogs/task-dialog";
import { CommentSection } from "@/components/admin/comment-section";
import { DriveUploader } from "@/components/admin/drive-uploader";
import { DriveView } from "@/components/admin/drive-view";
import { ProjectAvatar } from "@/components/admin/entity-avatar";
import { StatusBadge } from "@/components/admin/status-badge";
import { TaskCheckbox } from "@/components/admin/task-checkbox";
import {
  forCredentialDialog,
  forDriveViewFile,
  forDriveViewFolder,
  forProjectDialog,
  forReceivableDialog,
  forTaskDialog,
} from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const priorityColor: Record<string, string> = {
  URGENT: "text-destructive border-destructive/30 bg-destructive/10",
  HIGH: "text-orange-600 border-orange-300 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950",
  MEDIUM:
    "text-blue-600 border-blue-300 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950",
  LOW: "text-muted-foreground border-border bg-muted/30",
};

const priorityLabel: Record<string, string> = {
  URGENT: "Urgente",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

const priorityOrder: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

async function getDriveBreadcrumb(folderId: string | null) {
  const crumbs: Array<{ id: string; name: string }> = [];
  let cur: string | null = folderId;
  while (cur) {
    const f = await prisma.driveFolder.findUnique({
      where: { id: cur },
      select: { id: true, name: true, parentId: true },
    });
    if (!f) break;
    crumbs.unshift({ id: f.id, name: f.name });
    cur = f.parentId;
  }
  return crumbs;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; folder?: string }>;
}) {
  const { id } = await params;
  const { tab, folder: driveFolderParam } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      tasks: {
        orderBy: [{ status: "asc" }, { priority: "asc" }, { dueDate: "asc" }],
      },
      receivables: {
        include: { client: true },
        orderBy: { createdAt: "desc" },
      },
      credentials: {
        include: { client: true, project: true },
        orderBy: { updatedAt: "desc" },
      },
      comments: {
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { files: true } },
    },
  });

  if (!project) notFound();

  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Drive data — contextual folder navigation
  const driveFolderId = driveFolderParam ?? null;
  const driveFolderBase = `/admin/proyectos/${id}?tab=archivos`;

  const [driveFiles, driveFolders, driveBreadcrumb] = await Promise.all([
    prisma.driveFile.findMany({
      where: driveFolderId
        ? { folderId: driveFolderId }
        : { projectId: id, folderId: null },
      orderBy: { name: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.driveFolder.findMany({
      where: driveFolderId
        ? { parentId: driveFolderId }
        : { projectId: id, parentId: null },
      orderBy: { name: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { children: true, files: true } },
      },
    }),
    getDriveBreadcrumb(driveFolderId),
  ]);

  const pendingTasks = project.tasks
    .filter((t) => t.status !== "DONE")
    .sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2),
    );
  const doneTasks = project.tasks.filter((t) => t.status === "DONE");
  const progress = project.tasks.length
    ? Math.round((doneTasks.length / project.tasks.length) * 100)
    : 0;

  const pendingBalance = project.receivables.reduce(
    (sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.paidAmount)),
    0,
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="rounded-lg border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <ProjectAvatar name={project.name} size="lg" />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={project.status} />
                  {project.client ? (
                    <Link
                      href={`/admin/clientes/${project.client.id}`}
                      className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {project.client.name}
                    </Link>
                  ) : null}
                  {project.stack ? (
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {project.stack}
                    </span>
                  ) : null}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {project.name}
                </h1>
                {project.description ? (
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {project.budget ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-0.5 text-xs ring-1 ring-border">
                      <span className="text-muted-foreground">Presupuesto</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(project.budget.toString())}
                      </span>
                    </span>
                  ) : null}
                  {project.dueDate ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-0.5 text-xs ring-1 ring-border">
                      <CalendarDays className="size-3 text-muted-foreground" />
                      <span className="font-medium">
                        {formatDate(project.dueDate)}
                      </span>
                    </span>
                  ) : null}
                  {pendingBalance > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800">
                      {formatCurrency(pendingBalance.toFixed(2))} por cobrar
                    </span>
                  ) : null}
                  {project.tasks.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-0.5 text-xs ring-1 ring-border">
                      <span className="font-semibold text-foreground">
                        {doneTasks.length}/{project.tasks.length}
                      </span>
                      <span className="text-muted-foreground">tareas</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {project.repositoryUrl ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={project.repositoryUrl} target="_blank">
                    <FaGithub className="size-4" />
                    Repo
                  </Link>
                </Button>
              ) : null}
              {project.productionUrl ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={project.productionUrl} target="_blank">
                    <ExternalLink className="size-4" />
                    Live
                  </Link>
                </Button>
              ) : null}
              <ProjectDialog
                project={forProjectDialog(project)}
                clients={clients}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={tab ?? "tareas"} className="gap-0">
        <TabsList className="mb-4 h-auto flex-wrap gap-1 rounded-lg p-1">
          <TabsTrigger value="tareas" className="rounded-md">
            Tareas{project.tasks.length > 0 ? ` (${project.tasks.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="notas" className="rounded-md">
            Notas
            {project.comments.length > 0 ? ` (${project.comments.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="archivos" className="rounded-md">
            Archivos
            {project._count.files > 0 ? ` (${project._count.files})` : ""}
          </TabsTrigger>
          <TabsTrigger value="cobros" className="rounded-md">
            Cobros
            {project.receivables.length > 0
              ? ` (${project.receivables.length})`
              : ""}
          </TabsTrigger>
          <TabsTrigger value="credenciales" className="rounded-md">
            Credenciales
            {project.credentials.length > 0
              ? ` (${project.credentials.length})`
              : ""}
          </TabsTrigger>
        </TabsList>

        {/* Tareas */}
        <TabsContent value="tareas" className="mt-0">
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>Tareas</CardTitle>
                  {project.tasks.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {doneTasks.length}/{project.tasks.length} completadas
                    </span>
                  ) : null}
                </div>
                <TaskDialog
                  projects={projects}
                  mode="create"
                  fixedProjectId={id}
                />
              </div>
              {project.tasks.length > 0 ? (
                <Progress value={progress} className="mt-2 h-1.5" />
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              {project.tasks.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No hay tareas aún.{" "}
                  <span className="text-foreground">Crea la primera.</span>
                </div>
              ) : (
                <div className="divide-y">
                  {pendingTasks.map((task) => {
                    const isOverdue =
                      task.dueDate &&
                      new Date(task.dueDate) < new Date() &&
                      task.status !== "DONE";
                    return (
                      <div
                        key={task.id}
                        className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                      >
                        <TaskCheckbox id={task.id} done={false} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-5">
                            {task.title}
                          </div>
                          {task.description ? (
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {task.description}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs",
                              priorityColor[task.priority] ?? "",
                            )}
                          >
                            {priorityLabel[task.priority]}
                          </span>
                          {task.dueDate ? (
                            <span
                              className={cn(
                                "text-xs",
                                isOverdue
                                  ? "font-medium text-destructive"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatDate(task.dueDate)}
                            </span>
                          ) : null}
                          <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <TaskDialog
                              task={forTaskDialog(task)}
                              projects={projects}
                              fixedProjectId={id}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {doneTasks.length > 0 ? (
                    <>
                      <div className="flex items-center gap-3 px-5 py-2">
                        <Separator className="flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {doneTasks.length} completada
                          {doneTasks.length !== 1 ? "s" : ""}
                        </span>
                        <Separator className="flex-1" />
                      </div>
                      {doneTasks.map((task) => (
                        <div
                          key={task.id}
                          className="group flex items-start gap-3 px-5 py-2.5 transition-colors hover:bg-muted/20"
                        >
                          <TaskCheckbox id={task.id} done={true} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-muted-foreground line-through">
                              {task.title}
                            </div>
                          </div>
                          <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <TaskDialog
                              task={forTaskDialog(task)}
                              projects={projects}
                              fixedProjectId={id}
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notas */}
        <TabsContent value="notas" className="mt-0">
          <Card className="rounded-lg">
            <CardContent className="p-5">
              <CommentSection
                comments={project.comments.map((c) => ({
                  id: c.id,
                  body: c.body,
                  createdAt: c.createdAt.toISOString(),
                }))}
                projectId={id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Archivos — drive contextual */}
        <TabsContent value="archivos" className="mt-0">
          <div className="space-y-3">
            {/* Drive breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="size-3.5" />
              <Link
                href={`/admin/proyectos/${id}?tab=archivos`}
                className={
                  driveBreadcrumb.length === 0
                    ? "font-medium text-foreground"
                    : "hover:text-foreground"
                }
              >
                Archivos
              </Link>
              {driveBreadcrumb.map((crumb, i) => (
                <Fragment key={crumb.id}>
                  <ChevronRight className="size-3.5 shrink-0" />
                  <Link
                    href={`${driveFolderBase}&folder=${crumb.id}`}
                    className={
                      i === driveBreadcrumb.length - 1
                        ? "max-w-48 truncate font-medium text-foreground"
                        : "max-w-32 truncate hover:text-foreground"
                    }
                  >
                    {crumb.name}
                  </Link>
                </Fragment>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <CreateFolderDialog parentId={driveFolderId} projectId={id} />
              <DriveUploader folderId={driveFolderId} projectId={id} />
            </div>

            <DriveView
              folders={driveFolders.map(forDriveViewFolder)}
              files={driveFiles.map(forDriveViewFile)}
              clients={clients}
              projects={projects}
              folderBase={driveFolderBase}
            />
          </div>
        </TabsContent>

        {/* Cobros */}
        <TabsContent value="cobros" className="mt-0">
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Cobros</CardTitle>
                <ReceivableDialog
                  clients={clients}
                  projects={projects}
                  mode="create"
                  fixedClientId={project.client?.id ?? undefined}
                  fixedProjectId={id}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-3">
              {project.receivables.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Sin hitos de cobro.
                </p>
              ) : (
                <div className="divide-y">
                  {project.receivables.map((r) => {
                    const remaining = Number(r.amount) - Number(r.paidAmount);
                    const isPaid = remaining <= 0;
                    return (
                      <div
                        key={r.id}
                        className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <StatusBadge value={r.status} />
                          </div>
                          <div className="mt-0.5 truncate text-sm font-medium">
                            {r.title}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{formatCurrency(r.amount.toString())}</span>
                            {remaining > 0 && remaining < Number(r.amount) ? (
                              <span className="text-amber-600">
                                · {formatCurrency(remaining.toFixed(2))}{" "}
                                pendiente
                              </span>
                            ) : null}
                            {isPaid ? (
                              <span className="text-emerald-600">· Pagado</span>
                            ) : null}
                            {r.client?.name ? (
                              <span>· {r.client.name}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          {!isPaid ? (
                            <SinglePaymentDialog
                              receivable={{
                                id: r.id,
                                title: r.title,
                                amount: formatCurrency(r.amount.toString()),
                                remaining: formatCurrency(remaining.toFixed(2)),
                              }}
                            />
                          ) : null}
                          <ReceivableDialog
                            receivable={forReceivableDialog(r)}
                            clients={clients}
                            projects={projects}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credenciales */}
        <TabsContent value="credenciales" className="mt-0">
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-4" />
                  Credenciales
                </CardTitle>
                <CredentialDialog
                  clients={clients}
                  projects={projects}
                  mode="create"
                  fixedClientId={project.client?.id ?? undefined}
                  fixedProjectId={id}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-3">
              {project.credentials.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Sin credenciales registradas.
                </p>
              ) : (
                <div className="divide-y">
                  {project.credentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                    >
                      <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {cred.title}
                          </span>
                          <StatusBadge value={cred.kind} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {cred.url ? (
                            <a
                              href={cred.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-foreground hover:underline"
                            >
                              {cred.url}
                            </a>
                          ) : null}
                          {cred.username ? ` · ${cred.username}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <CredentialViewDialog
                          credential={{
                            id: cred.id,
                            title: cred.title,
                            kind: cred.kind,
                            url: cred.url,
                            username: cred.username,
                            accessMethod: cred.accessMethod,
                            secretPreview: cred.secretPreview,
                            notes: cred.notes,
                          }}
                        />
                        <CredentialDialog
                          credential={forCredentialDialog(cred)}
                          clients={clients}
                          projects={projects}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
