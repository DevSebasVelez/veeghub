import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { sendInvoiceEmail } from "@/app/admin/actions";
import {
  CreateInvoiceDialog,
  InvoiceEditDialog,
} from "@/components/admin/dialogs/invoice-dialog";
import { getPage, Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { forInvoiceDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

  const [clientsWithContext, clientsForEdit, invoices, total] =
    await Promise.all([
      // For create: only open receivables (no invoice yet)
      prisma.client.findMany({
        orderBy: { name: "asc" },
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
      // For edit: all receivables
      prisma.client.findMany({
        orderBy: { name: "asc" },
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
        <CreateInvoiceDialog clientsWithContext={clientsWithContext} />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Facturas</CardTitle>
            <div className="flex flex-wrap gap-1 rounded-lg border bg-background p-1">
              {STATUS_FILTERS.map((f) => (
                <Link
                  key={f.value}
                  href={
                    f.value
                      ? `/admin/facturas?status=${f.value}`
                      : "/admin/facturas"
                  }
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
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
                const clientForEdit = clientsForEdit.find(
                  (c) => c.id === invoice.clientId,
                );
                const editCtx = clientForEdit
                  ? [clientForEdit]
                  : clientsForEdit;

                return (
                  <div
                    key={invoice.id}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={invoice.status} />
                        <Link
                          href={`/admin/facturas/${invoice.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {invoice.invoiceNumber ?? "Sin número"}
                        </Link>
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
                          <span>{formatDateOnly(invoice.issueDate)}</span>
                        ) : null}
                      </div>
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

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="size-8"
                      >
                        <Link href={`/admin/facturas/${invoice.id}`}>
                          <ExternalLink className="size-4" />
                        </Link>
                      </Button>
                      <InvoiceEditDialog
                        invoice={forInvoiceDialog(invoice)}
                        clientsWithContext={editCtx}
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
