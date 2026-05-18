import { createProject, createTask } from "@/app/admin/actions";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export default async function ProjectsPage() {
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
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
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Proyectos</h1>
        <p className="text-sm text-muted-foreground">
          Control de entregables, stack, links, tareas e hitos de cobro.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="rounded-lg">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {project.stack ?? "Stack sin definir"} ·{" "}
                        {formatDate(project.dueDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.client?.name ?? "Sin cliente"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{project.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {project.budget
                        ? formatCurrency(project.budget.toString())
                        : "Sin monto"}
                    </TableCell>
                    <TableCell>{project.tasks.length}</TableCell>
                  </TableRow>
                ))}
                {!projects.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Aún no hay proyectos.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Nuevo proyecto</CardTitle>
              <CardDescription>
                Registra un desarrollo o mantenimiento puntual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createProject}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">Nombre</FieldLabel>
                    <Input id="name" name="name" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
                    <select
                      id="clientId"
                      name="clientId"
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="none">Sin cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="status">Estado</FieldLabel>
                    <select
                      id="status"
                      name="status"
                      defaultValue="ACTIVE"
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="LEAD">Lead</option>
                      <option value="ACTIVE">Activo</option>
                      <option value="PAUSED">Pausado</option>
                      <option value="COMPLETED">Completado</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="stack">Stack</FieldLabel>
                    <Input
                      id="stack"
                      name="stack"
                      placeholder="Next.js, Prisma, R2..."
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="budget">Presupuesto</FieldLabel>
                      <Input
                        id="budget"
                        name="budget"
                        type="number"
                        step="0.01"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="dueDate">
                        Entrega estimada
                      </FieldLabel>
                      <Input id="dueDate" name="dueDate" type="date" />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="repositoryUrl">Repositorio</FieldLabel>
                    <Input id="repositoryUrl" name="repositoryUrl" type="url" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="productionUrl">
                      URL producción
                    </FieldLabel>
                    <Input id="productionUrl" name="productionUrl" type="url" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="description">Descripción</FieldLabel>
                    <Textarea id="description" name="description" rows={3} />
                  </Field>
                  <Button type="submit">Crear proyecto</Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Nueva tarea</CardTitle>
              <CardDescription>
                Agrega pendientes rápidos a un proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createTask}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="projectId">Proyecto</FieldLabel>
                    <select
                      id="projectId"
                      name="projectId"
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      required
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="title">Tarea</FieldLabel>
                    <Input id="title" name="title" required />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="priority">Prioridad</FieldLabel>
                      <select
                        id="priority"
                        name="priority"
                        defaultValue="MEDIUM"
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="LOW">Baja</option>
                        <option value="MEDIUM">Media</option>
                        <option value="HIGH">Alta</option>
                        <option value="URGENT">Urgente</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="status">Estado</FieldLabel>
                      <select
                        id="status"
                        name="status"
                        defaultValue="TODO"
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="TODO">Por hacer</option>
                        <option value="IN_PROGRESS">En progreso</option>
                        <option value="BLOCKED">Bloqueada</option>
                      </select>
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="dueDate">Fecha límite</FieldLabel>
                    <Input id="dueDate" name="dueDate" type="date" />
                  </Field>
                  <Button type="submit" disabled={!projects.length}>
                    Crear tarea
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
