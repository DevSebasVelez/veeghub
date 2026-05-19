import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, FolderOpen, KeyRound } from "lucide-react";
import { FaGithub } from "react-icons/fa6";

import { CredentialDialog } from "@/components/admin/dialogs/credential-dialog";
import { DriveFileEditDialog } from "@/components/admin/dialogs/drive-file-dialog";
import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import { ReceivableDialog } from "@/components/admin/dialogs/receivable-dialog";
import { TaskDialog } from "@/components/admin/dialogs/task-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { TaskCheckbox } from "@/components/admin/task-checkbox";
import {
  forCredentialDialog,
  forDriveFileDialog,
  forProjectDialog,
  forReceivableDialog,
  forTaskDialog,
} from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatBytes, formatCurrency, formatDate } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
      files: {
        include: { client: true, project: true },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      credentials: {
        include: { client: true, project: true },
        orderBy: { updatedAt: "desc" },
      },
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
    <div className="space-y-6">
      {/* Header */}
      <Card className="rounded-lg border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={project.status} />
                {project.client ? (
                  <Link
                    href={`/admin/clientes/${project.client.id}`}
                    className="text-sm text-muted-foreground hover:underline underline-offset-4"
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
              <div className="flex flex-wrap items-center gap-4 pt-1 text-sm text-muted-foreground">
                {project.budget ? (
                  <span>
                    Presupuesto:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(project.budget.toString())}
                    </span>
                  </span>
                ) : null}
                {project.dueDate ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    Entrega: {formatDate(project.dueDate)}
                  </span>
                ) : null}
                {pendingBalance > 0 ? (
                  <span className="font-medium text-amber-600">
                    {formatCurrency(pendingBalance.toFixed(2))} por cobrar
                  </span>
                ) : null}
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

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Tasks - main column */}
        <div className="space-y-4">
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
                <TaskDialog projects={projects} mode="create" fixedProjectId={id} />
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
                          <div className="sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
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
                          <div className="sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
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

          {/* Files */}
          {project.files.length > 0 ? (
            <Card className="rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderOpen className="size-4" />
                  Archivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {project.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-lg border bg-background p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {file.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatBytes(file.size)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/drive/download/${file.id}`}>
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </Button>
                        <DriveFileEditDialog
                          file={forDriveFileDialog(file)}
                          clients={clients}
                          projects={projects}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Right sidebar: Finance + Credentials */}
        <div className="space-y-4">
          {/* Hitos de cobro */}
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Cobros</CardTitle>
                <ReceivableDialog
                  clients={clients}
                  projects={projects}
                  mode="create"
                  fixedClientId={project.client?.id ?? undefined}
                  fixedProjectId={id}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-0 pb-4 px-4">
              {project.receivables.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sin hitos de cobro.
                </p>
              ) : (
                project.receivables.map((r) => {
                  const remaining = Number(r.amount) - Number(r.paidAmount);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge value={r.status} />
                        </div>
                        <div className="mt-1 truncate text-sm font-medium">
                          {r.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(r.amount.toString())}
                          {remaining > 0 && remaining < Number(r.amount) ? (
                            <span className="ml-1 text-amber-600">
                              · {formatCurrency(remaining.toFixed(2))} pendiente
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ReceivableDialog
                        receivable={forReceivableDialog(r)}
                        clients={clients}
                        projects={projects}
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Credentials */}
          {project.credentials.length > 0 ? (
            <Card className="rounded-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
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
              <CardContent className="space-y-2">
                {project.credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {cred.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {cred.username ?? cred.accessMethod ?? "—"}
                      </div>
                    </div>
                    <CredentialDialog
                      credential={forCredentialDialog(cred)}
                      clients={clients}
                      projects={projects}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
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
              <CardContent>
                <p className="text-center text-sm text-muted-foreground">
                  Sin credenciales registradas.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
