import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  ChevronRight,
  ExternalLink,
  FileText,
  HardDrive,
  KeyRound,
  Mail,
  Phone,
} from "lucide-react";

import { ClientEditDialog } from "@/components/admin/dialogs/client-dialog";
import { CredentialDialog } from "@/components/admin/dialogs/credential-dialog";
import { CredentialViewDialog } from "@/components/admin/dialogs/credential-view-dialog";
import {
  CreateInvoiceDialog,
  InvoiceEditDialog,
  QuickInvoiceDialog,
} from "@/components/admin/dialogs/invoice-dialog";
import { EditPaymentDialog } from "@/components/admin/dialogs/receivable-dialog";
import { ProjectDialog } from "@/components/admin/dialogs/project-dialog";
import { ReceivableDialog } from "@/components/admin/dialogs/receivable-dialog";
import { ClientAvatar, ProjectAvatar } from "@/components/admin/entity-avatar";
import { CommentSection } from "@/components/admin/comment-section";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

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
    folder?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const invoicesPage = getPage(query.invoicesPage);
  const credentialsPage = getPage(query.credentialsPage);
  const driveFolderId = query.folder ?? null;
  const driveFolderBase = `/admin/clientes/${id}?tab=drive`;

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
          comments: true,
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
    comments,
    clientPayments,
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
      include: {
        project: { select: { name: true, id: true } },
        invoice: { select: { id: true } },
      },
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
      where: driveFolderId
        ? { folderId: driveFolderId }
        : { clientId: id, folderId: null },
      orderBy: { name: "asc" },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.driveFolder.findMany({
      where: driveFolderId
        ? { parentId: driveFolderId }
        : { clientId: id, parentId: null },
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
    prisma.comment.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { receivable: { clientId: id } },
      orderBy: { paidAt: "desc" },
      include: {
        receivable: {
          select: {
            id: true,
            title: true,
            project: { select: { id: true, name: true } },
            invoice: {
              select: { id: true, invoiceNumber: true, status: true },
            },
          },
        },
      },
    }),
  ]);

  // Drive breadcrumb
  const driveBreadcrumb: Array<{ id: string; name: string }> = [];
  let cur: string | null = driveFolderId;
  while (cur) {
    const f = await prisma.driveFolder.findUnique({
      where: { id: cur },
      select: { id: true, name: true, parentId: true },
    });
    if (!f) break;
    driveBreadcrumb.unshift({ id: f.id, name: f.name });
    cur = f.parentId;
  }

  // Invoice context for this client
  const [clientCtxCreate, clientCtxEdit] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        projects: {
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
        receivables: {
          where: { invoice: null, status: { notIn: ["CANCELLED"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, projectId: true },
        },
      },
    }),
    prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        projects: {
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
        receivables: {
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, projectId: true },
        },
      },
    }),
  ]);

  const invoiceCtxCreate = clientCtxCreate ? [clientCtxCreate] : [];
  const invoiceCtxEdit = clientCtxEdit ? [clientCtxEdit] : [];

  const totalPending = receivables.reduce(
    (sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.paidAmount)),
    0,
  );

  const clientPaymentsByMonth: Record<
    string,
    { key: string; total: number; payments: typeof clientPayments }
  > = {};
  for (const payment of clientPayments) {
    const d = new Date(payment.paidAt);
    const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    if (!clientPaymentsByMonth[key])
      clientPaymentsByMonth[key] = { key, total: 0, payments: [] };
    clientPaymentsByMonth[key].payments.push(payment);
    clientPaymentsByMonth[key].total += Number(payment.amount);
  }
  const clientPaymentGroups = Object.values(clientPaymentsByMonth);
  const clientPaymentsTotal = clientPayments.reduce(
    (s, p) => s + Number(p.amount),
    0,
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="rounded-lg border-sky-100 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex gap-3 sm:gap-4">
            <ClientAvatar
              name={client.name}
              size="md"
              className="mt-0.5 shrink-0 sm:size-14 sm:text-lg"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              {/* Etiqueta + acción inline */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cliente
                </span>
                <ClientEditDialog client={forClientDialog(client)} />
              </div>
              {/* Nombre */}
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {client.name}
              </h1>
              {/* Contacto */}
              <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                {client.legalName ? (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {client.legalName}
                      {client.taxId ? ` · ${client.taxId}` : ""}
                    </span>
                  </span>
                ) : null}
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-1.5 hover:text-foreground"
                  >
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </a>
                ) : null}
                {client.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" />
                    {client.phone}
                  </span>
                ) : null}
              </div>
              {/* Estadísticas */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  { label: "proyectos", value: client._count.projects },
                  { label: "hitos", value: client._count.receivables },
                  { label: "facturas", value: client._count.invoices },
                  { label: "archivos", value: client._count.files },
                  { label: "notas", value: client._count.comments },
                ].map(({ label, value }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-0.5 text-xs ring-1 ring-border"
                  >
                    <span className="font-semibold text-foreground">
                      {value}
                    </span>
                    <span className="text-muted-foreground">{label}</span>
                  </span>
                ))}
                {totalPending > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800">
                    {formatCurrency(totalPending.toFixed(2))} pendiente
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={query.tab ?? "resumen"} className="gap-0">
        <div className="-mx-4 mb-4 overflow-x-auto border-b border-border px-4 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden md:mx-0 md:border-0 md:pb-0 md:px-0">
          <TabsList className="h-auto w-max gap-1 rounded-lg p-1">
            <TabsTrigger value="resumen" className="rounded-md">
              Resumen
            </TabsTrigger>
            <TabsTrigger value="notas" className="rounded-md">
              Notas
              {client._count.comments > 0 ? ` (${client._count.comments})` : ""}
            </TabsTrigger>
            <TabsTrigger value="pagos" className="rounded-md">
              Pagos
              {clientPayments.length > 0 ? ` (${clientPayments.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-md">
              Facturas{invoicesTotal > 0 ? ` (${invoicesTotal})` : ""}
            </TabsTrigger>
            <TabsTrigger value="drive" className="rounded-md">
              Drive{client._count.files > 0 ? ` (${client._count.files})` : ""}
            </TabsTrigger>
            <TabsTrigger value="credentials" className="rounded-md">
              Credenciales{credentialsTotal > 0 ? ` (${credentialsTotal})` : ""}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Resumen tab */}
        <TabsContent value="resumen" className="mt-0">
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
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
                          sum +
                          Math.max(0, Number(r.amount) - Number(r.paidAmount)),
                        0,
                      );
                      return (
                        <div
                          key={project.id}
                          className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                        >
                          <ProjectAvatar name={project.name} size="sm" />
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
                              className="mt-0.5 block truncate text-sm font-medium underline-offset-4 hover:underline"
                            >
                              {project.name}
                            </Link>
                            {totalTasks > 0 ? (
                              <div className="text-xs text-muted-foreground">
                                {done}/{totalTasks} tareas completadas
                              </div>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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
                            <div className="flex flex-wrap items-center gap-2">
                              <InlineStatusSelect id={r.id} status={r.status} />
                              {r.project?.name ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {r.project.name}
                                </span>
                              ) : null}
                              {r.invoice ? (
                                <Link
                                  href={`/admin/facturas/${r.invoice.id}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                                >
                                  Facturado
                                </Link>
                              ) : (
                                <span className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground/60">
                                  Sin factura
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate text-sm font-medium">
                              {r.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(r.amount.toString())}
                              {remaining < Number(r.amount) ? (
                                <span className="ml-1 text-amber-600">
                                  · {formatCurrency(remaining.toFixed(2))}{" "}
                                  pendiente
                                </span>
                              ) : null}
                              {r.dueDate ? ` · ${formatDate(r.dueDate)}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            {!r.invoice ? (
                              <QuickInvoiceDialog
                                clientsWithContext={invoiceCtxCreate}
                                fixedClientId={id}
                                fixedProjectId={r.project?.id ?? null}
                                fixedReceivableId={r.id}
                                receivableTitle={r.title}
                              />
                            ) : null}
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
        </TabsContent>

        {/* Notas tab */}
        <TabsContent value="notas" className="mt-0">
          <Card className="rounded-lg">
            <CardContent className="p-5">
              <CommentSection
                comments={comments.map((c) => ({
                  id: c.id,
                  body: c.body,
                  createdAt: c.createdAt.toISOString(),
                }))}
                clientId={id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pagos tab */}
        <TabsContent value="pagos" className="mt-0">
          <div className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Pagos registrados contra hitos de este cliente.
              </p>
              {clientPaymentsTotal > 0 ? (
                <span className="text-sm text-muted-foreground">
                  Total cobrado:{" "}
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(clientPaymentsTotal.toFixed(2))}
                  </span>
                </span>
              ) : null}
            </div>

            {clientPaymentGroups.length === 0 ? (
              <Card className="rounded-lg">
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  Sin pagos registrados.
                </CardContent>
              </Card>
            ) : (
              clientPaymentGroups.map((group) => (
                <Card key={group.key} className="rounded-lg">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{group.key}</CardTitle>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatCurrency(group.total.toFixed(2))}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-5">Hito</TableHead>
                            <TableHead>Proyecto</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Factura</TableHead>
                            <TableHead className="pr-5">Fecha</TableHead>
                            <TableHead className="pr-5 text-right" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="pl-5 font-medium">
                                {payment.receivable.title}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payment.receivable.project ? (
                                  <Link
                                    href={`/admin/proyectos/${payment.receivable.project.id}`}
                                    className="hover:text-foreground hover:underline"
                                  >
                                    {payment.receivable.project.name}
                                  </Link>
                                ) : (
                                  <span className="italic opacity-40">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payment.method ?? (
                                  <span className="italic opacity-40">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payment.reference ?? (
                                  <span className="italic opacity-40">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium text-emerald-600">
                                {formatCurrency(payment.amount.toString())}
                              </TableCell>
                              <TableCell>
                                {payment.receivable.invoice ? (
                                  <Link
                                    href={`/admin/facturas/${payment.receivable.invoice.id}`}
                                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                                  >
                                    {payment.receivable.invoice.invoiceNumber ??
                                      "Factura"}
                                    {payment.receivable.invoice.status ===
                                    "PAID"
                                      ? " ✓"
                                      : ""}
                                  </Link>
                                ) : (
                                  <span className="italic text-xs opacity-40">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(payment.paidAt)}
                              </TableCell>
                              <TableCell className="pr-5 text-right">
                                <EditPaymentDialog
                                  payment={{
                                    id: payment.id,
                                    amount: payment.amount.toString(),
                                    paidAt: payment.paidAt.toISOString(),
                                    method: payment.method,
                                    reference: payment.reference,
                                    notes: payment.notes,
                                    receivableTitle: payment.receivable.title,
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Facturas tab */}
        <TabsContent value="invoices" className="mt-0">
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Facturas</CardTitle>
                <CreateInvoiceDialog
                  clientsWithContext={invoiceCtxCreate}
                  fixedClientId={id}
                />
              </div>
            </CardHeader>
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
                      <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <InvoiceEditDialog
                          invoice={forInvoiceDialog(invoice)}
                          clientsWithContext={invoiceCtxEdit}
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
        <TabsContent value="drive" className="mt-0">
          <div className="space-y-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="size-3.5" />
              <Link
                href={`/admin/clientes/${id}?tab=drive`}
                className={
                  driveBreadcrumb.length === 0
                    ? "font-medium text-foreground"
                    : "hover:text-foreground"
                }
              >
                Archivos
              </Link>
              {driveBreadcrumb.map((crumb, i) => (
                <Fragment key={crumb.id}>
                  <ChevronRight className="size-3.5 shrink-0" />
                  <Link
                    href={`${driveFolderBase}&folder=${crumb.id}`}
                    className={
                      i === driveBreadcrumb.length - 1
                        ? "max-w-48 truncate font-medium text-foreground"
                        : "max-w-32 truncate hover:text-foreground"
                    }
                  >
                    {crumb.name}
                  </Link>
                </Fragment>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              <CreateFolderDialog parentId={driveFolderId} clientId={id} />
              <DriveUploader folderId={driveFolderId} clientId={id} />
            </div>
            <DriveView
              folders={driveFolders.map(forDriveViewFolder)}
              files={driveFiles.map(forDriveViewFile)}
              clients={allClients}
              projects={allProjects}
              folderBase={driveFolderBase}
            />
          </div>
        </TabsContent>

        {/* Credenciales tab */}
        <TabsContent value="credentials" className="mt-0">
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
                      <div className="flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <CredentialViewDialog
                          credential={{
                            id: cred.id,
                            title: cred.title,
                            kind: cred.kind,
                            url: cred.url,
                            username: cred.username,
                            accessMethod: cred.accessMethod,
                            secretPreview: cred.secretPreview,
                            notes: cred.notes,
                          }}
                        />
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
