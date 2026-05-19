import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import { TaskDialog } from "@/components/admin/dialogs/task-dialog";
import { ProjectAvatar } from "@/components/admin/entity-avatar";
import { getPage, Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { forProjectDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const PAGE_SIZE = 12;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = getPage(pageParam);

  const [clients, allProjects, projects, total] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { name: true } },
        tasks: { select: { id: true, status: true } },
        receivables: {
          select: { amount: true, paidAmount: true, status: true },
          where: { status: { notIn: ["PAID", "CANCELLED"] } },
        },
        _count: { select: { tasks: true, files: true } },
      },
    }),
    prisma.project.count(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {total} proyecto{total !== 1 ? "s" : ""} en total.
          </p>
        </div>
        <div className="flex gap-2">
          <TaskDialog projects={allProjects} mode="create" />
          <ProjectDialog clients={clients} mode="create" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const doneTasks = project.tasks.filter(
            (t) => t.status === "DONE",
          ).length;
          const totalTasks = project.tasks.length;
          const progress = totalTasks
            ? Math.round((doneTasks / totalTasks) * 100)
            : 0;
          const pendingBalance = project.receivables.reduce(
            (sum, r) =>
              sum + Math.max(0, Number(r.amount) - Number(r.paidAmount)),
            0,
          );

          return (
            <Card
              key={project.id}
              className="group flex flex-col rounded-lg transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3 p-4 pb-3">
                <ProjectAvatar name={project.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge value={project.status} />
                    {project.client?.name ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {project.client.name}
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/admin/proyectos/${project.id}`}
                    className="line-clamp-2 text-sm font-semibold leading-snug underline-offset-4 hover:underline"
                  >
                    {project.name}
                  </Link>
                </div>
                <ProjectDialog
                  project={forProjectDialog(project)}
                  clients={clients}
                />
              </div>

              <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                {totalTasks > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tareas</span>
                      <span>
                        {doneTasks}/{totalTasks}
                      </span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {pendingBalance > 0 ? (
                    <span className="font-medium text-amber-600">
                      {formatCurrency(pendingBalance.toFixed(2))} pendiente
                    </span>
                  ) : null}
                  {project.dueDate ? (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {formatDate(project.dueDate)}
                    </span>
                  ) : null}
                  {project._count.files > 0 ? (
                    <span>{project._count.files} archivos</span>
                  ) : null}
                </div>

                <div className="mt-auto pt-1">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Link href={`/admin/proyectos/${project.id}`}>
                      Abrir proyecto
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!projects.length ? (
          <div className="col-span-full py-16 text-center text-muted-foreground">
            Aún no hay proyectos.
          </div>
        ) : null}
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath="/admin/proyectos"
      />
    </div>
  );
}
