import Link from "next/link";
import { notFound } from "next/navigation";
import { FaFolderOpen, FaGithub, FaListCheck } from "react-icons/fa6";

import { CredentialDialog } from "@/components/admin/dialogs/credential-dialog";
import { DriveFileEditDialog } from "@/components/admin/dialogs/drive-file-dialog";
import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import { ReceivableDialog } from "@/components/admin/dialogs/receivable-dialog";
import { TaskDialog } from "@/components/admin/dialogs/task-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  forCredentialDialog,
  forDriveFileDialog,
  forProjectDialog,
  forReceivableDialog,
  forTaskDialog,
} from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatBytes, formatCurrency, formatDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      receivables: { include: { client: true }, orderBy: { createdAt: "desc" } },
      files: { include: { client: true, project: true }, orderBy: { createdAt: "desc" } },
      credentials: { include: { client: true, project: true }, orderBy: { updatedAt: "desc" } },
    },
  });

  if (!project) notFound();

  const [clients, projects] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const doneTasks = project.tasks.filter((t) => t.status === "DONE").length;
  const progress = project.tasks.length
    ? Math.round((doneTasks / project.tasks.length) * 100)
    : 0;
  const pendingBalance = project.receivables.reduce(
    (sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.paidAmount)),
    0,
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border-blue-100 bg-blue-50/40">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <StatusBadge value={project.status} />
                {project.client ? (
                  <Link
                    href={`/admin/clientes/${project.client.id}`}
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {project.client.name}
                  </Link>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {project.description ?? "Sin descripción del proyecto."}
              </p>
            </div>
            <div className="flex gap-2">
              {project.repositoryUrl ? (
                <Button asChild variant="outline">
                  <Link href={project.repositoryUrl} target="_blank">
                    <FaGithub />
                    Repo
                  </Link>
                </Button>
              ) : null}
              <ProjectDialog project={forProjectDialog(project)} clients={clients} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Progreso" value={`${progress}%`} />
        <Metric label="Tareas" value={`${doneTasks}/${project.tasks.length}`} />
        <Metric label="Por cobrar" value={formatCurrency(pendingBalance)} />
        <Metric label="Archivos" value={String(project.files.length)} />
      </div>

      <Card className="rounded-lg">
        <CardContent className="p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>Avance de tareas</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks" className="gap-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          <TabsTrigger value="finance">Finanzas</TabsTrigger>
          <TabsTrigger value="files">Archivos</TabsTrigger>
          <TabsTrigger value="credentials">Credenciales</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card className="rounded-lg">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FaListCheck />
                  Tareas del proyecto
                </CardTitle>
                <CardDescription>Gestiona el backlog sin mezclar otros clientes.</CardDescription>
              </div>
              <TaskDialog projects={projects} mode="create" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {project.tasks.map((task) => (
                  <Card key={task.id} className="rounded-lg bg-background">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{task.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(task.dueDate)}
                          </div>
                        </div>
                        <StatusBadge value={task.priority} />
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {task.description ?? "Sin descripción."}
                      </p>
                      <div className="flex items-center justify-between">
                        <StatusBadge value={task.status} />
                        <TaskDialog task={forTaskDialog(task)} projects={projects} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance">
          <Card className="rounded-lg">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Hitos de cobro</CardTitle>
                <CardDescription>Entradas, avances y pagos finales de este proyecto.</CardDescription>
              </div>
              <ReceivableDialog clients={clients} projects={projects} mode="create" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hito</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Pagado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.receivables.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.title}</TableCell>
                      <TableCell><StatusBadge value={r.status} /></TableCell>
                      <TableCell>{formatCurrency(r.amount.toString())}</TableCell>
                      <TableCell>{formatCurrency(r.paidAmount.toString())}</TableCell>
                      <TableCell className="text-right">
                        <ReceivableDialog
                          receivable={forReceivableDialog(r)}
                          clients={clients}
                          projects={projects}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FaFolderOpen /> Archivos
              </CardTitle>
              <CardDescription>Archivos vinculados a este proyecto.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {project.files.map((file) => (
                  <div key={file.id} className="rounded-lg border bg-background p-4">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                    <div className="mt-3 flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/drive/download/${file.id}`}>Descargar</Link>
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
        </TabsContent>

        <TabsContent value="credentials">
          <Card className="rounded-lg">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Credenciales del proyecto</CardTitle>
                <CardDescription>Accesos directamente relacionados.</CardDescription>
              </div>
              <CredentialDialog clients={clients} projects={projects} mode="create" />
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {project.credentials.map((cred) => (
                <div key={cred.id} className="rounded-lg border bg-background p-4">
                  <div className="font-medium">{cred.title}</div>
                  <div className="mt-1"><StatusBadge value={cred.kind} /></div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {cred.username ?? cred.accessMethod ?? "Sin usuario"}
                  </div>
                  <div className="mt-3">
                    <CredentialDialog
                      credential={forCredentialDialog(cred)}
                      clients={clients}
                      projects={projects}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
