import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  XCircle,
} from "lucide-react";

import { deleteWithholding } from "@/lib/admin/actions/withholdings/actions";
import { ConfirmActionButton } from "@/components/admin/finance/confirm-action-button";
import { WithholdingDialog } from "@/components/admin/dialogs/withholding-dialog";
import { WITHHOLDING_KIND_LABELS } from "@/components/admin/finance/labels";
import { checkInvoiceTotals } from "@/lib/admin/finance/calc";
import { fromCents, sumCents } from "@/lib/admin/finance/money";

import { InvoiceEditDialog } from "@/components/admin/dialogs/invoice-dialog";
import { SendInvoiceForm } from "@/components/admin/send-invoice-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { forInvoiceDialog, forWithholdingDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      receivables: {
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, amount: true },
      },
      xmlFile: true,
      rideFile: true,
      emailLogs: { orderBy: { createdAt: "desc" } },
      withholdings: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!invoice) notFound();

  const totalsCheck = checkInvoiceTotals(invoice);
  const withheldTotal = fromCents(
    sumCents(invoice.withholdings, (w) => w.amount),
  );

  // Data for edit dialog
  const clientCtxEdit = await prisma.client.findUnique({
    where: { id: invoice.clientId },
    select: {
      id: true,
      name: true,
      projects: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      receivables: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          projectId: true,
          amount: true,
          invoiceId: true,
        },
      },
    },
  });
  // Offer hitos that are free or already on this invoice; Decimal -> string.
  const editCtx = clientCtxEdit
    ? [
        {
          ...clientCtxEdit,
          receivables: clientCtxEdit.receivables
            .filter((r) => r.invoiceId === null || r.invoiceId === invoice.id)
            .map((r) => ({
              id: r.id,
              title: r.title,
              projectId: r.projectId,
              amount: r.amount.toString(),
            })),
        },
      ]
    : [];

  const canSend = !!(invoice.xmlFile && invoice.rideFile);
  const defaultEmail =
    invoice.client.billingEmail ?? invoice.client.email ?? "";

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1.5">
          <Link
            href="/admin/facturas"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Facturas
          </Link>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="min-w-0 wrap-break-word text-2xl font-semibold tracking-tight">
              {invoice.invoiceNumber ?? "Factura sin número"}
            </h1>
            <StatusBadge value={invoice.status} />
          </div>
          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Link
              href={`/admin/clientes/${invoice.client.id}`}
              className="min-w-0 max-w-full truncate hover:text-foreground hover:underline"
            >
              {invoice.client.name}
            </Link>
            {invoice.project ? (
              <Link
                href={`/admin/proyectos/${invoice.project.id}`}
                className="min-w-0 max-w-full truncate hover:text-foreground hover:underline"
              >
                {invoice.project.name}
              </Link>
            ) : null}
            {invoice.issueDate ? (
              <span>{formatDateOnly(invoice.issueDate)}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <InvoiceEditDialog
            invoice={forInvoiceDialog(invoice)}
            clientsWithContext={editCtx}
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main: details + files */}
        <div className="space-y-5">
          {/* Amounts */}
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Montos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Subtotal
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {invoice.subtotal
                      ? formatCurrency(invoice.subtotal.toString())
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    IVA
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {invoice.taxAmount
                      ? formatCurrency(invoice.taxAmount.toString())
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatCurrency(invoice.total.toString())}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
                <span>
                  Tarifa IVA aplicada:{" "}
                  <span className="font-medium text-foreground">
                    {invoice.vatRate != null
                      ? `${Number(invoice.vatRate.toString())}%`
                      : "no registrada"}
                  </span>
                </span>
                {totalsCheck.complete && totalsCheck.difference !== "0.00" ? (
                  <span className="text-amber-600">
                    Subtotal + IVA difiere del total en{" "}
                    {formatCurrency(totalsCheck.difference)}
                  </span>
                ) : null}
              </div>

              {invoice.accessKey ? (
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Clave de acceso SRI
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {invoice.accessKey}
                  </p>
                </div>
              ) : null}

              {invoice.receivables.length > 0 ? (
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {invoice.receivables.length === 1
                      ? "Hito cubierto"
                      : `Hitos cubiertos (${invoice.receivables.length})`}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {invoice.receivables.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <span className="min-w-0 wrap-break-word font-medium">
                          {r.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(r.amount.toString())}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Withholdings: informative, never counted as cash received */}
          <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Retenciones recibidas</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Informativas: no cuentan como cobro ni cambian el saldo de
                  los hitos.
                </p>
              </div>
              <WithholdingDialog invoiceId={invoice.id} mode="create" />
            </CardHeader>
            <CardContent>
              {invoice.withholdings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin retenciones registradas.
                </p>
              ) : (
                <ul className="divide-y">
                  {invoice.withholdings.map((w) => (
                    <li
                      key={w.id}
                      className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">
                          {WITHHOLDING_KIND_LABELS[w.kind]}
                          {w.percentage != null
                            ? ` · ${Number(w.percentage.toString())}%`
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            w.receiptNumber,
                            w.issueDate ? formatDateOnly(w.issueDate) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Sin comprobante"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <span className="font-semibold">
                          {formatCurrency(w.amount.toString())}
                        </span>
                        <div className="flex items-center gap-1">
                          <WithholdingDialog
                            invoiceId={invoice.id}
                            withholding={forWithholdingDialog(w)}
                          />
                          <ConfirmActionButton
                            icon="trash"
                            title="Eliminar retención"
                            description={`¿Eliminar la retención de ${formatCurrency(w.amount.toString())}?`}
                            confirmLabel="Eliminar"
                            destructive
                            successMessage="Retención eliminada."
                            action={deleteWithholding.bind(null, w.id)}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                  <li className="flex justify-between pt-2 text-sm">
                    <span className="text-muted-foreground">Total retenido</span>
                    <span className="font-semibold">
                      {formatCurrency(withheldTotal)}
                    </span>
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>

          {/* XML + RIDE */}
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Documentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* XML */}
              <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">XML autorizado</p>
                    {invoice.xmlFile ? (
                      <p className="break-all text-xs text-muted-foreground sm:break-normal">
                        {invoice.xmlFile.name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">
                        No subido
                      </p>
                    )}
                  </div>
                </div>
                {invoice.xmlFile ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <a
                      href={`/admin/drive/download/${invoice.xmlFile.id}?download=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="size-3.5" />
                      Descargar
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Pendiente
                  </span>
                )}
              </div>

              {/* RIDE */}
              <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-5 shrink-0 text-blue-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">RIDE PDF</p>
                    {invoice.rideFile ? (
                      <p className="break-all text-xs text-muted-foreground sm:break-normal">
                        {invoice.rideFile.name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">
                        No subido
                      </p>
                    )}
                  </div>
                </div>
                {invoice.rideFile ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <a
                      href={`/admin/drive/download/${invoice.rideFile.id}?download=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="size-3.5" />
                      Descargar
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Pendiente
                  </span>
                )}
              </div>

              {!canSend ? (
                <p className="text-xs text-muted-foreground">
                  Sube XML y RIDE para poder enviar la factura por email.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: email + history */}
        <div className="min-w-0 space-y-5">
          {/* Send email */}
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-4" />
                Enviar por email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canSend ? (
                <>
                  {/* Template preview badge */}
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-800/50 dark:bg-indigo-950/30">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                        <span className="text-[10px] font-bold text-white">
                          V
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                          Plantilla VEEGSOFT profesional
                        </p>
                        <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-400">
                          Se enviará un email con diseño enterprise que incluye
                          N° factura, monto, proyecto y los documentos adjuntos.
                        </p>
                      </div>
                    </div>
                  </div>

                  <SendInvoiceForm
                    invoiceId={invoice.id}
                    defaultTo={defaultEmail}
                    defaultSubject={`Factura ${invoice.invoiceNumber ?? ""} · ${invoice.client.name}`.trim()}
                  />
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Adjunta el XML y RIDE para habilitar el envío.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Email history */}
          {invoice.emailLogs.length > 0 ? (
            <Card className="rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Historial de envíos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoice.emailLogs.map((log) => (
                  <div key={log.id} className="space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      {log.status === "FAILED" ? (
                        <XCircle className="size-3.5 shrink-0 text-destructive" />
                      ) : (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                      )}
                      <p className="truncate text-sm font-medium">{log.to}</p>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {log.sentAt ? formatDate(log.sentAt) : "—"}
                      </span>
                    </div>
                    {log.cc ? (
                      <p className="pl-5 text-xs text-muted-foreground">
                        CC: {log.cc}
                      </p>
                    ) : null}
                    {log.status === "FAILED" && log.error ? (
                      <p className="pl-5 text-xs text-destructive">
                        {log.error}
                      </p>
                    ) : null}
                    <Separator />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
