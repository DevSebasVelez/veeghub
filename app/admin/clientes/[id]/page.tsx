import Link from "next/link";
import { notFound } from "next/navigation";
import { FaFolderOpen, FaKey, FaRegFileLines } from "react-icons/fa6";

import { ClientEditDialog } from "@/components/admin/dialogs/client-dialog";
import { CredentialDialog } from "@/components/admin/dialogs/credential-dialog";
import { DriveFileEditDialog } from "@/components/admin/dialogs/drive-file-dialog";
import { FolderEditDialog } from "@/components/admin/dialogs/folder-dialog";
import { InvoiceEditDialog } from "@/components/admin/dialogs/invoice-dialog";
import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import { ReceivableDialog } from "@/components/admin/dialogs/receivable-dialog";
import {
  forClientDialog,
  forCredentialDialog,
  forDriveFileDialog,
  forFolderDialog,
  forInvoiceDialog,
  forProjectDialog,
  forReceivableDialog,
} from "@/lib/admin/serialize";
import { getPage, Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import prisma from "@/lib/db/prisma";
import { formatBytes, formatCurrency, formatDate } from "@/lib/admin/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 8;

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    projectsPage?: string;
    receivablesPage?: string;
    invoicesPage?: string;
    filesPage?: string;
    credentialsPage?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const projectsPage = getPage(query.projectsPage);
  const receivablesPage = getPage(query.receivablesPage);
  const invoicesPage = getPage(query.invoicesPage);
  const filesPage = getPage(query.filesPage);
  const credentialsPage = getPage(query.credentialsPage);
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          projects: true,
          receivables: true,
          invoices: true,
          files: true,
          credentials: true,
        },
      },
    },
  });

  if (!client) notFound();

  const [
    allClients,
    allProjects,
    projects,
    projectsTotal,
    receivables,
    invoices,
    invoicesTotal,
    files,
    filesTotal,
    folders,
    credentials,
    credentialsTotal,
  ] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
      skip: (projectsPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.project.count({ where: { clientId: id } }),
    prisma.receivable.findMany({
      where: { clientId: id, status: { not: "PAID" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: { project: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
      skip: (invoicesPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { client: true, project: true, xmlFile: true, rideFile: true },
    }),
    prisma.invoice.count({ where: { clientId: id } }),
    prisma.driveFile.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
      skip: (filesPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { project: true, client: true },
    }),
    prisma.driveFile.count({ where: { clientId: id } }),
    prisma.driveFolder.findMany({
      where: { clientId: id },
      orderBy: { name: "asc" },
      include: { project: true },
      take: 20,
    }),
    prisma.credential.findMany({
      where: { clientId: id },
      orderBy: { updatedAt: "desc" },
      skip: (credentialsPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { client: true, project: true },
    }),
    prisma.credential.count({ where: { clientId: id } }),
  ]);
  const outstandingReceivables = receivables.filter(
    (item) => Number(item.amount) - Number(item.paidAmount) > 0,
  );
  const pagedReceivables = outstandingReceivables.slice(
    (receivablesPage - 1) * PAGE_SIZE,
    receivablesPage * PAGE_SIZE,
  );
  const receivableOptions = receivables.map((item) => ({
    id: item.id,
    name: item.title,
  }));

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-lg border-sky-100 bg-sky-50/60">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Cliente</div>
            <h1 className="text-3xl font-semibold tracking-normal">{client.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {client.legalName ?? "Sin razón social"} ·{" "}
              {client.billingEmail ?? client.email ?? "Sin email de facturación"}
            </p>
          </div>
          <ClientEditDialog client={forClientDialog(client)} />
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        <Summary label="Proyectos" value={client._count.projects} />
        <Summary label="Cobros" value={client._count.receivables} />
        <Summary label="Facturas" value={client._count.invoices} />
        <Summary label="Archivos" value={client._count.files} />
        <Summary label="Credenciales" value={client._count.credentials} />
      </div>

      <Tabs defaultValue="projects" className="gap-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="projects">Proyectos</TabsTrigger>
          <TabsTrigger value="finance">Finanzas</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
          <TabsTrigger value="drive">Drive</TabsTrigger>
          <TabsTrigger value="credentials">Credenciales</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <Card className="rounded-lg">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Proyectos del cliente</CardTitle>
                <CardDescription>Entregables y estado por proyecto.</CardDescription>
              </div>
              <ProjectDialog clients={allClients} mode="create" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-xs text-muted-foreground">{project.stack}</div>
                      </TableCell>
                      <TableCell><StatusBadge value={project.status} /></TableCell>
                      <TableCell>{project.budget ? formatCurrency(project.budget.toString()) : "Sin monto"}</TableCell>
                      <TableCell>{formatDate(project.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        <ProjectDialog project={forProjectDialog(project)} clients={allClients} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={projectsPage} pageSize={PAGE_SIZE} total={projectsTotal} basePath={`/admin/clientes/${id}`} param="projectsPage" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance">
          <Card className="rounded-lg">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Cuentas por cobrar</CardTitle>
                <CardDescription>Hitos y pagos pendientes.</CardDescription>
              </div>
              <ReceivableDialog clients={allClients} projects={allProjects} mode="create" />
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
                  {pagedReceivables.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.title}</TableCell>
                      <TableCell><StatusBadge value={item.status} /></TableCell>
                      <TableCell>{formatCurrency(item.amount.toString())}</TableCell>
                      <TableCell>{formatCurrency(item.paidAmount.toString())}</TableCell>
                      <TableCell className="text-right">
                        <ReceivableDialog receivable={forReceivableDialog(item)} clients={allClients} projects={allProjects} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={receivablesPage} pageSize={PAGE_SIZE} total={outstandingReceivables.length} basePath={`/admin/clientes/${id}`} param="receivablesPage" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FaRegFileLines /> Facturas</CardTitle>
              <CardDescription>XML/RIDE y estado de envío.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.invoiceNumber ?? "Sin número"}</TableCell>
                      <TableCell>{formatCurrency(invoice.total.toString())}</TableCell>
                      <TableCell><StatusBadge value={invoice.status} /></TableCell>
                      <TableCell className="text-right">
                        <InvoiceEditDialog invoice={forInvoiceDialog(invoice)} clients={allClients} projects={allProjects} receivables={receivableOptions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={invoicesPage} pageSize={PAGE_SIZE} total={invoicesTotal} basePath={`/admin/clientes/${id}`} param="invoicesPage" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drive">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FaFolderOpen /> Drive del cliente</CardTitle>
              <CardDescription>Archivos y carpetas asociados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2">
                {folders.map((folder) => (
                  <div key={folder.id} className="flex items-center justify-between rounded-lg border p-3">
                    <Link href={`/admin/drive?folder=${folder.id}`} className="font-medium hover:underline">
                      {folder.name}
                    </Link>
                    <FolderEditDialog folder={forFolderDialog(folder)} clients={allClients} projects={allProjects} />
                  </div>
                ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>{file.name}</TableCell>
                      <TableCell>{formatBytes(file.size)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/drive/download/${file.id}`}>Descargar</Link>
                          </Button>
                          <DriveFileEditDialog file={forDriveFileDialog(file)} clients={allClients} projects={allProjects} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={filesPage} pageSize={PAGE_SIZE} total={filesTotal} basePath={`/admin/clientes/${id}`} param="filesPage" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials">
          <Card className="rounded-lg">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><FaKey /> Credenciales</CardTitle>
                <CardDescription>Accesos filtrados por este cliente.</CardDescription>
              </div>
              <CredentialDialog clients={allClients} projects={allProjects} mode="create" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acceso</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.map((credential) => (
                    <TableRow key={credential.id}>
                      <TableCell>
                        <div className="font-medium">{credential.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {credential.accessMethod}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge value={credential.kind} /></TableCell>
                      <TableCell>{credential.username ?? "Sin usuario"}</TableCell>
                      <TableCell className="text-right">
                        <CredentialDialog credential={forCredentialDialog(credential)} clients={allClients} projects={allProjects} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={credentialsPage} pageSize={PAGE_SIZE} total={credentialsTotal} basePath={`/admin/clientes/${id}`} param="credentialsPage" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
