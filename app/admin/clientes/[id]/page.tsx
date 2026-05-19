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
import { InvoiceEditDialog } from "@/components/admin/dialogs/invoice-dialog";
import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import { ReceivableDialog } from "@/components/admin/dialogs/receivable-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { InlineStatusSelect } from "@/components/admin/inline-status-select";
import { DriveView } from "@/components/admin/drive-view";
import { DriveUploader } from "@/components/admin/drive-uploader";
import { CreateFolderDialog } from "@/components/admin/dialogs/folder-dialog";
import {
  forClientDialog,
  forCredentialDialog,
  forInvoiceDialog,
  forProjectDialog,
  forReceivableDialog,
  forDriveViewFile,
  forDriveViewFolder,
} from "@/lib/admin/serialize";
import { getPage, Pagination } from "@/components/admin/pagination";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAGE_SIZE = 10;

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    invoicesPage?: string;
    credentialsPage?: string;
    tab?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const invoicesPage = getPage(query.invoicesPage);
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
    driveFiles,
    driveFolders,
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
      where: { clientId: id, status: { notIn: ["PAID", "CANCELLED"] } },
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
      orderBy: { name: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.driveFolder.findMany({
      where: { clientId: id },
      orderBy: { name: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { children: true, files: true } },
      },
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

  const totalPending = receivables.reduce(
    (sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.paidAmount)),
    0,
  );
  const allReceivableOptions = receivables.map((r) => ({
    id: r.id,
    name: r.title,
  }));

  return (
    <div className="space-y-5">
      {/* Compact header */}
      <Card className="rounded-lg border-sky-100 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cliente
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {client.name}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {client.legalName ? (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 shrink-0" />
                    {client.legalName}
                    {client.taxId ? ` · ${client.taxId}` : ""}
                  </span>
                ) : null}
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-1.5 hover:text-foreground"
                  >
                    <Mail className="size-3.5 shrink-0" />
                    {client.email}
                  </a>
                ) : null}
                {client.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" />
                    {client.phone}
                  </span>
                ) : null}
              </div>
              {/* Inline stats */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{client._count.projects}</span> proyectos
                </span>
                <span>
                  <span className="font-semibold text-foreground">{client._count.receivables}</span> hitos
                </span>
                <span>
                  <span className="font-semibold text-foreground">{client._count.invoices}</span> facturas
                </span>
                <span>
                  <span className="font-semibold text-foreground">{client._count.files}</span> archivos
                </span>
                {totalPending > 0 ? (
                  <span className="font-semibold text-amber-600">
                    {formatCurrency(totalPending.toFixed(2))} pendiente
                  </span>
                ) : null}
              </div>
            </div>
            <ClientEditDialog client={forClientDialog(client)} />
          </div>
        </CardContent>
      </Card>

      {/* Projects + Finance side by side */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Projects */}
        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Proyectos</CardTitle>
              <ProjectDialog
                clients={allClients}
                mode="create"
                fixedClientId={id}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-3">
            {projects.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Sin proyectos.
              </p>
            ) : (
              <div className="divide-y">
                {projects.map((project) => {
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
                      className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
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
                          <div className="text-xs text-muted-foreground">
                            {done}/{totalTasks} tareas completadas
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
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
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending receivables */}
        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Hitos pendientes</CardTitle>
              <ReceivableDialog
                clients={allClients}
                projects={allProjects}
                mode="create"
                fixedClientId={id}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-3">
            {receivables.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Sin hitos pendientes.
              </p>
            ) : (
              <div className="divide-y">
                {receivables.map((r) => {
                  const remaining = Number(r.amount) - Number(r.paidAmount);
                  return (
                    <div
                      key={r.id}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <InlineStatusSelect id={r.id} status={r.status} />
                          {r.project?.name ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {r.project.name}
                            </span>
                          ) : null}
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
                          {r.dueDate ? ` · ${formatDate(r.dueDate)}` : ""}
                        </div>
                      </div>
                      <div className="sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                        <ReceivableDialog
                          receivable={forReceivableDialog(r)}
                          clients={allClients}
                          projects={allProjects}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Facturas, Drive, Credenciales */}
      <Tabs defaultValue={query.tab ?? "invoices"} className="gap-4">
        <TabsList>
          <TabsTrigger value="invoices">
            Facturas{invoicesTotal > 0 ? ` (${invoicesTotal})` : ""}
          </TabsTrigger>
          <TabsTrigger value="drive">
            Drive{client._count.files > 0 ? ` (${client._count.files})` : ""}
          </TabsTrigger>
          <TabsTrigger value="credentials">
            Credenciales
            {credentialsTotal > 0 ? ` (${credentialsTotal})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* Facturas tab */}
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
                      className="group flex items-center gap-4 px-5 py-3"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {invoice.invoiceNumber ?? "Sin número"}
                          </span>
                          <StatusBadge value={invoice.status} />
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(invoice.issueDate)}</span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(invoice.total.toString())}
                          </span>
                          {invoice.project ? (
                            <span>· {invoice.project.name}</span>
                          ) : null}
                          <span
                            className={
                              invoice.xmlFile ? "text-emerald-600" : ""
                            }
                          >
                            XML{invoice.xmlFile ? " ✓" : ""}
                          </span>
                          <span
                            className={invoice.rideFile ? "text-blue-600" : ""}
                          >
                            RIDE{invoice.rideFile ? " ✓" : ""}
                          </span>
                        </div>
                      </div>
                      <div className="sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                        <InvoiceEditDialog
                          invoice={forInvoiceDialog(invoice)}
                          clients={allClients}
                          projects={allProjects}
                          receivables={allReceivableOptions}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-5 pb-4 pt-2">
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

        {/* Drive tab */}
        <TabsContent value="drive">
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <CreateFolderDialog
                parentId={null}
                clients={allClients}
                projects={allProjects}
                defaultClientId={id}
              />
              <DriveUploader folderId={null} clientId={id} />
            </div>
            <DriveView
              folders={driveFolders.map(forDriveViewFolder)}
              files={driveFiles.map(forDriveViewFile)}
              clients={allClients}
              projects={allProjects}
            />
          </div>
        </TabsContent>

        {/* Credenciales tab */}
        <TabsContent value="credentials">
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Credenciales</CardTitle>
                <CredentialDialog
                  clients={allClients}
                  projects={allProjects}
                  mode="create"
                  fixedClientId={id}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-3">
              {credentials.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin credenciales.
                </p>
              ) : (
                <div className="divide-y">
                  {credentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
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
                          {cred.url ? (
                            <a
                              href={cred.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-foreground hover:underline"
                            >
                              {cred.url}
                            </a>
                          ) : null}
                          {cred.username ? ` · ${cred.username}` : ""}
                          {cred.project ? ` · ${cred.project.name}` : ""}
                        </div>
                      </div>
                      <div className="sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                        <CredentialDialog
                          credential={forCredentialDialog(cred)}
                          clients={allClients}
                          projects={allProjects}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-5 pb-2">
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
