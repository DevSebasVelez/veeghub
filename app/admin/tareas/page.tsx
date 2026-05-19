import Link from "next/link";
import { CheckSquare, ExternalLink } from "lucide-react";

import { TaskDialog } from "@/components/admin/dialogs/task-dialog";
import { TaskCheckbox } from "@/components/admin/task-checkbox";
import { StatusBadge } from "@/components/admin/status-badge";
import { forTaskDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatDate } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default async function TareasPage() {
  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      orderBy: [
        { priority: "asc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  const byProject = tasks.reduce<
    Record<string, { project: { id: string; name: string }; tasks: typeof tasks }>
  >((acc, task) => {
    const key = task.project.id;
    if (!acc[key]) acc[key] = { project: task.project, tasks: [] };
    acc[key].tasks.push(task);
    return acc;
  }, {});

  const groups = Object.values(byProject);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CheckSquare className="size-6" />
            Tareas pendientes
          </h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} tarea{tasks.length !== 1 ? "s" : ""} sin completar en{" "}
            {groups.length} proyecto{groups.length !== 1 ? "s" : ""}.
          </p>
        </div>
        <TaskDialog projects={projects} mode="create" />
      </div>

      {groups.length === 0 ? (
        <Card className="rounded-lg">
          <CardContent className="py-20 text-center text-muted-foreground">
            No hay tareas pendientes.
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.project.id} className="rounded-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <Link
                    href={`/admin/proyectos/${group.project.id}`}
                    className="hover:underline underline-offset-4"
                  >
                    {group.project.name}
                  </Link>
                </CardTitle>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {group.tasks.length} tarea{group.tasks.length !== 1 ? "s" : ""}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/proyectos/${group.project.id}`}>
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <div className="divide-y">
                {group.tasks.map((task) => {
                  const isOverdue =
                    task.dueDate && new Date(task.dueDate) < new Date();
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
                        <StatusBadge value={task.status} />
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
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
