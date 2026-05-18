import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  ExternalLink,
  FileText,
  KeyRound,
  Mail,
  Phone,
} from "lucide-react";

import { ClientEditDialog } from "@/components/admin/dialogs/client-dialog";
import { CredentialDialog } from "@/components/admin/dialogs/credential-dialog";
import { DriveFileEditDialog } from "@/components/admin/dialogs/drive-file-dialog";
import { FolderEditDialog } from "@/components/admin/dialogs/folder-dialog";
import { InvoiceEditDialog } from "@/components/admin/dialogs/invoice-dialog";
import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import { ReceivableDialog } from "@/components/admin/dialogs/receivable-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
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
import prisma from "@/lib/db/prisma";
import { formatBytes, formatCurrency, formatDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAGE_SIZE = 8;

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    invoicesPage?: string;
    filesPage?: string;
    credentialsPage?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
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
    receivables,
    invoices,
    invoicesTotal,
    files,
    filesTotal,
    folders,
    credentials,
    credentialsTotal,
  ] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { clientId: id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        tasks: { select: { id: true, status: true } },
        receivables: {
          select: { amount: true, paidAmount: true, status: true },
          where: { status: { notIn: ["PAID", "CANCELLED"] } },
        },
      },
    }),
    prisma.receivable.findMany({
      where: { clientId: id },
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
      take: 12,
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
    (r) => r.status !== "PAID" && r.status !== "CANCELLED",
  );
  const totalPending = outstandingReceivables.reduce(
    (sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.paidAmount)),
    0,
  );
  const allReceivableOptions = receivables.map((r) => ({
    id: r.id,
    name: r.title,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="rounded-lg border-sky-100 bg-sky-50/50">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cliente
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {client.name}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {client.legalName ? (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5" />
                    {client.legalName}
                    {client.taxId ? ` · ${client.taxId}` : ""}
                  </span>
                ) : null}
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-1.5 hover:text-foreground"
                  >
                    <Mail className="size-3.5" />
                    {client.email}
                  </a>
                ) : null}
                {client.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    {client.phone}
                  </span>
                ) : null}
                {totalPending > 0 ? (
                  <span className="font-medium text-amber-600">
                    {formatCurrency(totalPending.toFixed(2))} pendiente
                  </span>
                ) : null}
              </div>
            </div>
            <ClientEditDialog client={forClientDialog(client)} />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Proyectos", value: client._count.projects },
          { label: "Hitos", value: client._count.receivables },
          { label: "Facturas", value: client._count.invoices },
          { label: "Archivos", value: client._count.files },
          { label: "Credenciales", value: client._count.credentials },
        ].map((s) => (
          <Card key={s.label} className="rounded-lg">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 text-2xl font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Projects + Finance */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Projects */}
        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Proyectos</CardTitle>
              <ProjectDialog clients={allClients} mode="create" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin proyectos.
              </p>
            ) : (
              projects.map((project) => {
                const done = project.tasks.filter(
                  (t) => t.status === "DONE",
                ).length;
                const totalTasks = project.tasks.length;
                const pendingBalance = project.receivables.reduce(
                  (sum, r) =>
                    sum + Math.max(0, Number(r.amount) - Number(r.paidAmount)),
                  0,
                );
                return (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge value={project.status} />
                        {pendingBalance > 0 ? (
                          <span className="text-xs font-medium text-amber-600">
                            {formatCurrency(pendingBalance.toFixed(2))}
                          </span>
                        ) : null}
                      </div>
                      <Link
                        href={`/admin/proyectos/${project.id}`}
                        className="mt-0.5 block truncate text-sm font-medium hover:underline underline-offset-4"
                      >
                        {project.name}
                      </Link>
                      {totalTasks > 0 ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {done}/{totalTasks} tareas completadas
                        </div>
                      ) : null}
                    </div>
                    <div className="ml-3 flex items-center gap-1">
                      <ProjectDialog
                        project={forProjectDialog(project)}
                        clients={allClients}
                      />
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/proyectos/${project.id}`}>
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Finance */}
        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Hitos de cobro</CardTitle>
              <ReceivableDialog
                clients={allClients}
                projects={allProjects}
                mode="create"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {outstandingReceivables.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin hitos pendientes.
              </p>
            ) : (
              outstandingReceivables.map((r) => {
                const remaining = Number(r.amount) - Number(r.paidAmount);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge value={r.status} />
                        <span className="text-xs text-muted-foreground">
                          {r.project?.name}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-sm font-medium">
                        {r.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(r.amount.toString())}
                        {remaining < Number(r.amount) ? (
                          <span className="ml-1 text-amber-600">
                            · {formatCurrency(remaining.toFixed(2))} pendiente
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ReceivableDialog
                      receivable={forReceivableDialog(r)}
                      clients={allClients}
                      projects={allProjects}
                    />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices, Files, Credentials tabs */}
      <Tabs defaultValue="invoices" className="gap-4">
        <TabsList>
          <TabsTrigger value="invoices">
            Facturas
            {client._count.invoices > 0 ? ` (${client._count.invoices})` : ""}
          </TabsTrigger>
          <TabsTrigger value="drive">
            Drive{client._count.files > 0 ? ` (${client._count.files})` : ""}
          </TabsTrigger>
          <TabsTrigger value="credentials">
            Credenciales
            {client._count.credentials > 0
              ? ` (${client._count.credentials})`
              : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card className="rounded-lg">
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sin facturas registradas.
                </p>
              ) : (
                <div className="divide-y">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center gap-4 px-5 py-3"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {invoice.invoiceNumber ?? "Sin número"}
                          </span>
                          <StatusBadge value={invoice.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(invoice.issueDate)} ·{" "}
                          {formatCurrency(invoice.total.toString())}
                          {invoice.project ? ` · ${invoice.project.name}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span
                          className={invoice.xmlFile ? "text-emerald-600" : ""}
                        >
                          XML
                        </span>
                        {" / "}
                        <span
                          className={invoice.rideFile ? "text-blue-600" : ""}
                        >
                          RIDE
                        </span>
                      </div>
                      <InvoiceEditDialog
                        invoice={forInvoiceDialog(invoice)}
                        clients={allClients}
                        projects={allProjects}
                        receivables={allReceivableOptions}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="px-5 pb-4">
                <Pagination
                  page={invoicesPage}
                  pageSize={PAGE_SIZE}
                  total={invoicesTotal}
                  basePath={`/admin/clientes/${id}`}
                  param="invoicesPage"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drive">
          <Card className="rounded-lg">
            <CardContent className="space-y-4 pt-4">
              {folders.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Carpetas
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <Link
                          href={`/admin/drive?folder=${folder.id}`}
                          className="min-w-0 flex-1 text-sm font-medium hover:underline underline-offset-4"
                        >
                          {folder.name}
                          {folder.project ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {folder.project.name}
                            </span>
                          ) : null}
                        </Link>
                        <FolderEditDialog
                          folder={forFolderDialog(folder)}
                          clients={allClients}
                          projects={allProjects}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {files.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Archivos
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between rounded-lg border p-3"
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
                            clients={allClients}
                            projects={allProjects}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {folders.length === 0 && files.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sin archivos ni carpetas.
                </p>
              ) : null}

              <Pagination
                page={filesPage}
                pageSize={PAGE_SIZE}
                total={filesTotal}
                basePath={`/admin/clientes/${id}`}
                param="filesPage"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials">
          <Card className="rounded-lg">
            <CardContent className="p-0">
              {credentials.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sin credenciales.
                </p>
              ) : (
                <div className="divide-y">
                  {credentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="flex items-center gap-4 px-5 py-3"
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
                          {cred.username ?? cred.accessMethod ?? "—"}
                          {cred.project ? ` · ${cred.project.name}` : ""}
                        </div>
                      </div>
                      <CredentialDialog
                        credential={forCredentialDialog(cred)}
                        clients={allClients}
                        projects={allProjects}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="px-5 pb-4">
                <Pagination
                  page={credentialsPage}
                  pageSize={PAGE_SIZE}
                  total={credentialsTotal}
                  basePath={`/admin/clientes/${id}`}
                  param="credentialsPage"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
