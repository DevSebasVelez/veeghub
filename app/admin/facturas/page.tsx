import Link from "next/link";
import { ExternalLink, Send } from "lucide-react";

import { sendInvoiceEmail } from "@/lib/admin/actions/invoices/actions";
import { InvoiceStatusFilter } from "@/app/admin/facturas/invoice-status-filter";
import {
  CreateInvoiceDialog,
  InvoiceEditDialog,
} from "@/components/admin/dialogs/invoice-dialog";
import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { forInvoiceDialog } from "@/lib/admin/serialize";
import { getInvoicesPageData } from "@/lib/admin/queries/invoices";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { page: pageParam, status: statusFilter } = await searchParams;
  const {
    page,
    pageSize,
    clientsForCreate,
    clientsForEdit,
    invoices,
    total,
    serializeRecv,
  } = await getInvoicesPageData({ pageParam, statusFilter });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            Facturas SRI
          </h1>
          <p className="text-sm text-muted-foreground">
            XML autorizado, RIDE PDF y envío por email con Resend.
          </p>
        </div>
        <CreateInvoiceDialog clientsWithContext={clientsForCreate} />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Facturas</CardTitle>
            <InvoiceStatusFilter value={statusFilter} />
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
                // Offer hitos that are free or already on THIS invoice.
                const editCtx = clientForEdit
                  ? [
                      {
                        ...clientForEdit,
                        receivables: clientForEdit.receivables
                          .filter(
                            (r) =>
                              r.invoiceId === null ||
                              r.invoiceId === invoice.id,
                          )
                          .map(serializeRecv),
                      },
                    ]
                  : [];

                return (
                  <div
                    key={invoice.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6"
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
                          <span className="min-w-0 truncate text-xs text-muted-foreground">
                            {invoice.project.name}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="min-w-0 max-w-full truncate">
                          {invoice.client.name}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(invoice.total.toString())}
                        </span>
                        {invoice.issueDate ? (
                          <span>{formatDateOnly(invoice.issueDate)}</span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
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
                          <span className="min-w-0 max-w-full truncate text-muted-foreground">
                            Enviado {formatDate(lastEmail.sentAt)} →{" "}
                            {lastEmail.to}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                      {invoice.xmlFile && invoice.rideFile ? (
                        <form
                          action={sendInvoiceEmail}
                          className="grid w-full gap-2 sm:flex sm:w-auto"
                        >
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
                            className="h-9 w-full min-w-0 text-sm sm:h-8 sm:w-44"
                            required
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                          >
                            <Send className="size-3.5" />
                            Enviar
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sube XML y RIDE para enviar
                        </span>
                      )}
                      <div className="flex items-center justify-end gap-1">
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
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-4 pb-4 sm:px-6">
            <Pagination
              page={page}
              pageSize={pageSize}
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
