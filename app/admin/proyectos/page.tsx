import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckSquare2 } from "lucide-react";

import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import { TaskDialog } from "@/components/admin/dialogs/task-dialog";
import { ProjectAvatar } from "@/components/admin/entity-avatar";
import { getPage, Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { forProjectDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProjectsFilters } from "./projects-filters";

const PAGE_SIZE = 15;

type ProjectRow = {
  id: string;
  name: string;
  clientId: string | null;
  status: string;
  description: string | null;
  stack: string | null;
  repositoryUrl: string | null;
  productionUrl: string | null;
  stagingUrl: string | null;
  budget: { toString(): string } | null;
  startDate: Date | null;
  dueDate: Date | null;
  client: { name: string } | null;
  tasks: { id: string; status: string }[];
  receivables: { amount: unknown; paidAmount: unknown; status: string }[];
  _count: { tasks: number; files: number };
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    clientId?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const page = getPage(params.page);
  const q = params.q ?? "";
  const status = params.status ?? "";
  const clientId = params.clientId ?? "";
  const view = params.view === "list" ? "list" : "grid";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
  };

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
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        description: true,
        stack: true,
        repositoryUrl: true,
        productionUrl: true,
        stagingUrl: true,
        budget: true,
        startDate: true,
        dueDate: true,
        client: { select: { name: true } },
        tasks: { select: { id: true, status: true } },
        receivables: {
          select: { amount: true, paidAmount: true, status: true },
          where: { status: { notIn: ["PAID", "CANCELLED"] } },
        },
        _count: { select: { tasks: true, files: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  const filterParams = {
    q: q || null,
    status: status || null,
    clientId: clientId || null,
    view: view !== "grid" ? view : null,
  };

  const isFiltered = !!(q || status || clientId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} proyecto{total !== 1 ? "s" : ""}
            {isFiltered ? " encontrados" : " en total"}.
          </p>
        </div>
        <div className="flex gap-2">
          <TaskDialog projects={allProjects} mode="create" />
          <ProjectDialog clients={clients} mode="create" />
        </div>
      </div>

      <Suspense>
        <ProjectsFilters clients={clients} view={view} />
      </Suspense>

      {view === "grid" ? (
        <GridView projects={projects} clients={clients} />
      ) : (
        <ListView projects={projects} clients={clients} />
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath="/admin/proyectos"
        searchParams={filterParams}
      />
    </div>
  );
}

function projectStats(project: ProjectRow) {
  const doneTasks = project.tasks.filter((t) => t.status === "DONE").length;
  const totalTasks = project.tasks.length;
  const progress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const pendingBalance = project.receivables.reduce(
    (sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.paidAmount)),
    0,
  );
  return { doneTasks, totalTasks, progress, pendingBalance };
}

function GridView({
  projects,
  clients,
}: {
  projects: ProjectRow[];
  clients: Array<{ id: string; name: string }>;
}) {
  if (!projects.length) return <EmptyState />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const { doneTasks, totalTasks, progress, pendingBalance } =
          projectStats(project);
        return (
          <Card
            key={project.id}
            className="group flex flex-col rounded-xl transition-shadow hover:shadow-md"
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
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {formatCurrency(pendingBalance.toFixed(2))} pendiente
                  </span>
                ) : null}
                {project.dueDate ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {formatDateOnly(project.dueDate)}
                  </span>
                ) : null}
                {project._count.files > 0 ? (
                  <span>{project._count.files} archivos</span>
                ) : null}
              </div>

              <div className="mt-auto pt-1">
                <Button asChild variant="outline" size="sm" className="w-full">
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
    </div>
  );
}

function ListView({
  projects,
  clients,
}: {
  projects: ProjectRow[];
  clients: Array<{ id: string; name: string }>;
}) {
  if (!projects.length) return <EmptyState />;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Proyecto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Progreso</TableHead>
              <TableHead>Por cobrar</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead className="pr-5 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const { doneTasks, totalTasks, progress, pendingBalance } =
                projectStats(project);
              return (
                <TableRow key={project.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <ProjectAvatar name={project.name} size="sm" />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/proyectos/${project.id}`}
                          className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {project.name}
                        </Link>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.client?.name ?? (
                      <span className="italic">Sin cliente</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={project.status} />
                  </TableCell>
                  <TableCell>
                    {totalTasks > 0 ? (
                      <div className="flex min-w-24 items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {doneTasks}/{totalTasks}
                        </span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckSquare2 size={13} />0
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pendingBalance > 0 ? (
                      <span className="font-mono text-sm font-medium text-amber-600 dark:text-amber-400">
                        {formatCurrency(pendingBalance.toFixed(2))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.dueDate ? (
                      formatDateOnly(project.dueDate)
                    ) : (
                      <span className="text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <ProjectDialog
                        project={forProjectDialog(project)}
                        clients={clients}
                      />
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                      >
                        <Link href={`/admin/proyectos/${project.id}`}>
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-20 text-sm text-muted-foreground">
      No se encontraron proyectos.
    </div>
  );
}
