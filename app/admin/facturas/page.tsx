import { sendInvoiceEmail } from "@/app/admin/actions";
import {
  CreateInvoiceDialog,
  InvoiceEditDialog,
} from "@/components/admin/dialogs/invoice-dialog";
import { getPage, Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { forInvoiceDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const PAGE_SIZE = 12;

const STATUS_FILTERS = [
  { value: "", label: "Todas" },
  { value: "READY_TO_SEND", label: "Por enviar" },
  { value: "SENT", label: "Enviadas" },
  { value: "PAID", label: "Pagadas" },
  { value: "CANCELLED", label: "Canceladas" },
] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { page: pageParam, status: statusFilter } = await searchParams;
  const page = getPage(pageParam);

  const whereStatus =
    statusFilter && statusFilter !== ""
      ? {
          status: statusFilter as
            | "READY_TO_SEND"
            | "SENT"
            | "PAID"
            | "CANCELLED",
        }
      : {};

  const [clients, projects, freeReceivables, allReceivables, invoices, total] =
    await Promise.all([
      prisma.client.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.project.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.receivable.findMany({
        where: { invoice: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, client: { select: { name: true } } },
      }),
      prisma.receivable.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, client: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        where: whereStatus,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          client: true,
          project: true,
          xmlFile: true,
          rideFile: true,
          emailLogs: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      prisma.invoice.count({ where: whereStatus }),
    ]);

  const freeReceivableOptions = freeReceivables.map((r) => ({
    id: r.id,
    name: `${r.title} · ${r.client.name}`,
  }));
  const allReceivableOptions = allReceivables.map((r) => ({
    id: r.id,
    name: `${r.title} · ${r.client.name}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Facturas SRI
          </h1>
          <p className="text-sm text-muted-foreground">
            XML autorizado, RIDE PDF y envío por email con Resend.
          </p>
        </div>
        <CreateInvoiceDialog
          clients={clients}
          projects={projects}
          receivables={freeReceivableOptions}
        />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Facturas</CardTitle>
            {/* Status filter tabs */}
            <div className="flex gap-1 rounded-lg border bg-background p-1">
              {STATUS_FILTERS.map((f) => (
                <Link
                  key={f.value}
                  href={
                    f.value
                      ? `/admin/facturas?status=${f.value}`
                      : "/admin/facturas"
                  }
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    (statusFilter ?? "") === f.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No hay facturas{statusFilter ? " con ese estado" : ""}.
            </div>
          ) : (
            <div className="divide-y">
              {invoices.map((invoice) => {
                const lastEmail = invoice.emailLogs[0];
                return (
                  <div
                    key={invoice.id}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
                  >
                    {/* Left: info */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={invoice.status} />
                        <span className="font-medium">
                          {invoice.invoiceNumber ?? "Sin número"}
                        </span>
                        {invoice.project ? (
                          <span className="text-xs text-muted-foreground">
                            · {invoice.project.name}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>{invoice.client.name}</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(invoice.total.toString())}
                        </span>
                        {invoice.issueDate ? (
                          <span>{formatDate(invoice.issueDate)}</span>
                        ) : null}
                      </div>
                      {/* Files status */}
                      <div className="flex gap-3 text-xs">
                        <span
                          className={
                            invoice.xmlFile
                              ? "font-medium text-emerald-600"
                              : "text-muted-foreground"
                          }
                        >
                          XML {invoice.xmlFile ? "✓" : "pendiente"}
                        </span>
                        <span
                          className={
                            invoice.rideFile
                              ? "font-medium text-blue-600"
                              : "text-muted-foreground"
                          }
                        >
                          RIDE {invoice.rideFile ? "✓" : "pendiente"}
                        </span>
                        {lastEmail ? (
                          <span className="text-muted-foreground">
                            Enviado {formatDate(lastEmail.sentAt)} →{" "}
                            {lastEmail.to}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Right: send form + edit */}
                    <div className="flex shrink-0 items-center gap-2">
                      {invoice.xmlFile && invoice.rideFile ? (
                        <form action={sendInvoiceEmail} className="flex gap-2">
                          <input
                            type="hidden"
                            name="invoiceId"
                            value={invoice.id}
                          />
                          <Input
                            name="to"
                            type="email"
                            defaultValue={
                              invoice.client.billingEmail ??
                              invoice.client.email ??
                              ""
                            }
                            placeholder="cliente@email.com"
                            className="h-8 w-44 text-sm"
                            required
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Enviar
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sube XML y RIDE para enviar
                        </span>
                      )}
                      <InvoiceEditDialog
                        invoice={forInvoiceDialog(invoice)}
                        clients={clients}
                        projects={projects}
                        receivables={allReceivableOptions}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-6 pb-4">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              basePath="/admin/facturas"
              searchParams={{ status: statusFilter ?? "" }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
