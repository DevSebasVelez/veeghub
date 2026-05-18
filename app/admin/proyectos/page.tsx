import { FaGithub } from "react-icons/fa6";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import { TaskDialog } from "@/components/admin/dialogs/task-dialog";
import { getPage, Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { forProjectDialog, forTaskDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tasksPage?: string }>;
}) {
  const { page: pageParam, tasksPage: tasksPageParam } = await searchParams;
  const page = getPage(pageParam);
  const tasksPage = getPage(tasksPageParam);
  const [clients, allProjects, projects, total, tasks, tasksTotal] =
    await Promise.all([
      prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.project.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          client: { select: { name: true } },
          tasks: {
            where: { status: { not: "DONE" } },
            orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
            take: 3,
          },
          _count: { select: { tasks: true, receivables: true, files: true } },
        },
      }),
      prisma.project.count(),
      prisma.task.findMany({
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (tasksPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { project: { select: { name: true } } },
      }),
      prisma.task.count(),
    ]);

  const clientOptions = clients;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Control de entregables, stack, links, tareas e hitos de cobro.
          </p>
        </div>
        <div className="flex gap-2">
          <TaskDialog projects={allProjects} mode="create" />
          <ProjectDialog clients={clientOptions} mode="create" />
        </div>
      </div>

      <Card className="rounded-lg border-blue-100 bg-blue-50/30">
        <CardHeader>
          <CardTitle>Proyectos activos y recientes</CardTitle>
          <CardDescription>
            Cada proyecto centraliza tareas, archivos, credenciales y cobros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Tareas abiertas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {project.repositoryUrl ? (
                        <FaGithub className="size-4 text-muted-foreground" />
                      ) : null}
                      <Link
                        href={`/admin/proyectos/${project.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {project.name}
                      </Link>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {project.stack ?? "Stack sin definir"} ·{" "}
                      {formatDate(project.dueDate)}
                    </div>
                  </TableCell>
                  <TableCell>{project.client?.name ?? "Sin cliente"}</TableCell>
                  <TableCell>
                    <StatusBadge value={project.status} />
                  </TableCell>
                  <TableCell>
                    {project.budget
                      ? formatCurrency(project.budget.toString())
                      : "Sin monto"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{project.tasks.length} abiertas</span>
                      {project.tasks.slice(0, 2).map((task) => (
                        <span key={task.id} className="text-xs text-muted-foreground">
                          {task.title}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ProjectDialog
                        project={forProjectDialog(project)}
                        clients={clientOptions}
                      />
                      <Button asChild variant="default" size="sm">
                        <Link href={`/admin/proyectos/${project.id}`}>
                          Abrir
                          <ArrowRight />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!projects.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Aún no hay proyectos.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/admin/proyectos"
            searchParams={{ tasksPage }}
          />
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Tareas</CardTitle>
          <CardDescription>Lista editable de pendientes y entregables.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarea</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.description ?? "Sin descripción"}
                    </div>
                  </TableCell>
                  <TableCell>{task.project.name}</TableCell>
                  <TableCell>
                    <StatusBadge value={task.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={task.priority} />
                  </TableCell>
                  <TableCell>{formatDate(task.dueDate)}</TableCell>
                  <TableCell className="text-right">
                    <TaskDialog task={forTaskDialog(task)} projects={allProjects} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={tasksPage}
            pageSize={PAGE_SIZE}
            total={tasksTotal}
            basePath="/admin/proyectos"
            param="tasksPage"
            searchParams={{ page }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
