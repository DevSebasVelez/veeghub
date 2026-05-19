import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  Send,
  XCircle,
} from "lucide-react";

import { sendInvoiceEmail } from "@/app/admin/actions";
import { InvoiceEditDialog } from "@/components/admin/dialogs/invoice-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { forInvoiceDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

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
      receivable: true,
      xmlFile: true,
      rideFile: true,
      emailLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!invoice) notFound();

  // Data for edit dialog
  const clientCtxEdit = await prisma.client.findUnique({
    where: { id: invoice.clientId },
    select: {
      id: true,
      name: true,
      projects: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      receivables: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, projectId: true },
      },
    },
  });

  const canSend = !!(invoice.xmlFile && invoice.rideFile);
  const defaultEmail =
    invoice.client.billingEmail ?? invoice.client.email ?? "";

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <Link
            href="/admin/facturas"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Facturas
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {invoice.invoiceNumber ?? "Factura sin número"}
            </h1>
            <StatusBadge value={invoice.status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Link
              href={`/admin/clientes/${invoice.client.id}`}
              className="hover:text-foreground hover:underline"
            >
              {invoice.client.name}
            </Link>
            {invoice.project ? (
              <Link
                href={`/admin/proyectos/${invoice.project.id}`}
                className="hover:text-foreground hover:underline"
              >
                {invoice.project.name}
              </Link>
            ) : null}
            {invoice.issueDate ? (
              <span>{formatDate(invoice.issueDate)}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <InvoiceEditDialog
            invoice={forInvoiceDialog(invoice)}
            clientsWithContext={clientCtxEdit ? [clientCtxEdit] : []}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
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

              {invoice.receivable ? (
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Hito vinculado
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {invoice.receivable.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(invoice.receivable.amount.toString())}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* XML + RIDE */}
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Documentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* XML */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium">XML autorizado</p>
                    {invoice.xmlFile ? (
                      <p className="text-xs text-muted-foreground">
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
                  <Button asChild variant="outline" size="sm">
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
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">RIDE PDF</p>
                    {invoice.rideFile ? (
                      <p className="text-xs text-muted-foreground">
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
                  <Button asChild variant="outline" size="sm">
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
        <div className="space-y-5">
          {/* Send email */}
          <Card className="rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-4" />
                Enviar por email
              </CardTitle>
            </CardHeader>
            <CardContent>
              {canSend ? (
                <form action={sendInvoiceEmail} className="space-y-4">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Para</FieldLabel>
                      <Input
                        name="to"
                        type="email"
                        defaultValue={defaultEmail}
                        placeholder="cliente@email.com"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel>CC (opcional)</FieldLabel>
                      <Input
                        name="cc"
                        type="email"
                        placeholder="copia@email.com"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Asunto</FieldLabel>
                      <Input
                        name="subject"
                        defaultValue={`Factura ${invoice.invoiceNumber ?? ""} - ${invoice.client.name}`.trim()}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Mensaje</FieldLabel>
                      <Textarea
                        name="body"
                        rows={3}
                        defaultValue={`Hola ${invoice.client.name},\n\nAdjunto el XML autorizado y el RIDE PDF de la factura emitida.\n\nSaludos.`}
                      />
                    </Field>
                  </FieldGroup>
                  <Button type="submit" className="w-full" size="sm">
                    <Send className="size-3.5" />
                    Enviar factura
                  </Button>
                </form>
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
                    <div className="flex items-center gap-2">
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
