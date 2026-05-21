import Link from "next/link";
import { CheckSquare, ExternalLink } from "lucide-react";

import { TaskDialog } from "@/components/admin/dialogs/task-dialog";
import { TaskCheckbox } from "@/components/admin/task-checkbox";
import { TaskTitleEditor } from "@/components/admin/task-title-editor";
import { TaskFilters } from "@/components/admin/task-filters";
import { forTaskDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatDate } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ proyecto?: string; completadas?: string }>;
}) {
  const query = await searchParams;
  const projectFilter = query.proyecto ?? "all";
  const showDone = query.completadas === "1";

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: {
        ...(projectFilter !== "all" ? { projectId: projectFilter } : {}),
        ...(showDone ? {} : { status: { not: "DONE" } }),
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  const byProject = tasks.reduce<
    Record<
      string,
      {
        project: { id: string; name: string };
        pending: typeof tasks;
        done: typeof tasks;
      }
    >
  >((acc, task) => {
    const key = task.project.id;
    if (!acc[key]) acc[key] = { project: task.project, pending: [], done: [] };
    if (task.status === "DONE") {
      acc[key].done.push(task);
    } else {
      acc[key].pending.push(task);
    }
    return acc;
  }, {});

  const groups = Object.values(byProject).sort((a, b) =>
    a.project.name.localeCompare(b.project.name),
  );

  const pendingTotal = tasks.filter((t) => t.status !== "DONE").length;
  const doneTotal = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CheckSquare className="size-6" />
            Tareas
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pendingTotal} pendiente{pendingTotal !== 1 ? "s" : ""}
            {showDone && doneTotal > 0
              ? ` · ${doneTotal} completada${doneTotal !== 1 ? "s" : ""}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TaskFilters
            projects={projects}
            currentProject={projectFilter}
            showDone={showDone}
          />
          <TaskDialog projects={projects} mode="create" />
        </div>
      </div>

      {/* Lista */}
      {groups.length === 0 ? (
        <Card className="rounded-lg">
          <CardContent className="py-20 text-center text-muted-foreground">
            {showDone ? "No hay tareas." : "No hay tareas pendientes."}
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.project.id} className="rounded-lg">
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <Link
                    href={`/admin/proyectos/${group.project.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {group.project.name}
                  </Link>
                </CardTitle>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {group.pending.length} pendiente
                    {group.pending.length !== 1 ? "s" : ""}
                    {showDone && group.done.length > 0
                      ? ` · ${group.done.length} hecha${group.done.length !== 1 ? "s" : ""}`
                      : ""}
                  </span>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-7"
                  >
                    <Link href={`/admin/proyectos/${group.project.id}`}>
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 pb-2">
              <div className="divide-y">
                {/* Pendientes */}
                {group.pending.map((task) => {
                  const isOverdue =
                    task.dueDate && new Date(task.dueDate) < new Date();
                  return (
                    <div
                      key={task.id}
                      className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <TaskCheckbox id={task.id} done={false} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <TaskTitleEditor
                              id={task.id}
                              title={task.title}
                              done={false}
                            />
                            {task.description ? (
                              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                {task.description}
                              </div>
                            ) : null}
                          </div>
                          <div className="shrink-0 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <TaskDialog
                              task={forTaskDialog(task)}
                              projects={projects}
                            />
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Completadas */}
                {showDone && group.done.length > 0 ? (
                  <>
                    <div className="flex items-center gap-3 px-5 py-2">
                      <Separator className="flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {group.done.length} completada
                        {group.done.length !== 1 ? "s" : ""}
                      </span>
                      <Separator className="flex-1" />
                    </div>
                    {group.done
                      .sort(
                        (a, b) =>
                          (priorityOrder[a.priority] ?? 2) -
                          (priorityOrder[b.priority] ?? 2),
                      )
                      .map((task) => (
                        <div
                          key={task.id}
                          className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/20"
                        >
                          <TaskCheckbox id={task.id} done={true} />
                          <div className="min-w-0 flex-1">
                            <TaskTitleEditor
                              id={task.id}
                              title={task.title}
                              done={true}
                            />
                          </div>
                          <div className="shrink-0 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <TaskDialog
                              task={forTaskDialog(task)}
                              projects={projects}
                            />
                          </div>
                        </div>
                      ))}
                  </>
                ) : null}

                {/* Grupo vacío */}
                {group.pending.length === 0 && !showDone ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    Sin tareas pendientes.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
