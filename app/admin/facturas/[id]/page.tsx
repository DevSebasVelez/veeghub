import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  Flag,
  XCircle,
} from "lucide-react";

import { deleteWithholding } from "@/lib/admin/actions/withholdings/actions";
import { ConfirmActionButton } from "@/components/admin/finance/confirm-action-button";
import { WithholdingDialog } from "@/components/admin/dialogs/withholding-dialog";
import { SinglePaymentDialog } from "@/components/admin/dialogs/receivable-dialog";
import { WITHHOLDING_KIND_LABELS } from "@/components/admin/finance/labels";
import { checkInvoiceTotals } from "@/lib/admin/finance/calc";
import { fromCents, sumCents, toCents } from "@/lib/admin/finance/money";
import { setInvoiceReceivables } from "@/lib/admin/actions/invoices/payment-plan";
import { LinkHitosDialog, PaymentPlanDialog } from "@/components/admin/finance/invoice-plan-dialogs";

import { InvoiceEditDialog } from "@/components/admin/dialogs/invoice-dialog";
import { ReconcileInvoiceDialog } from "@/components/admin/dialogs/reconcile-invoice-dialog";
import { SendInvoiceForm } from "@/components/admin/send-invoice-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { forInvoiceDialog, forWithholdingDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/admin/format";
import { IconTile } from "@/components/admin/tone";
import { Button } from "@/components/ui/button";
import { parseAccessKey } from "@/lib/sri/access-key";
import { SriStatusCard } from "@/components/admin/finance/sri-status-card";

// «Emitir» and «Reintentar» are server actions on this page: signing and
// talking to the SRI take up to ~45 s (advanceInvoice's budget).
export const maxDuration = 60;

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
        select: { id: true, title: true, amount: true, paidAmount: true, withheldAmount: true, dueDate: true },
      },
      xmlFile: true,
      rideFile: true,
      emailLogs: { orderBy: { createdAt: "desc" } },
      withholdings: { orderBy: { createdAt: "asc" } },
      sriSubmissions: { orderBy: { createdAt: "desc" }, take: 10 },
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

  // Payment plan of an issued, authorized invoice.
  const canPlan = invoice.source === "ISSUED" && invoice.sriStatus === "AUTHORIZED";
  const plannedCents = sumCents(invoice.receivables, (r) => r.amount);
  const collectedCents =
    sumCents(invoice.receivables, (r) => r.paidAmount) + sumCents(invoice.receivables, (r) => r.withheldAmount);
  const unplannedCents = Math.max(toCents(invoice.total) - plannedCents, 0);
  const freeHitos = canPlan
    ? (
        await prisma.receivable.findMany({
          where: { clientId: invoice.clientId, invoiceId: null, status: { not: "CANCELLED" } },
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, amount: true, project: { select: { name: true } } },
        })
      ).map((h) => ({ id: h.id, title: h.title, amount: h.amount.toString(), project: h.project?.name ?? null }))
    : [];
  const defaultEmail =
    invoice.client.billingEmail ?? invoice.client.email ?? "";

  const keyParts = invoice.accessKey ? parseAccessKey(invoice.accessKey) : null;
  const vatLabel =
    invoice.vatRate != null ? `${Number(invoice.vatRate.toString())} %` : "No registrada";

  const documents = [
    { label: "XML autorizado", hint: "Comprobante electrónico firmado", file: invoice.xmlFile, icon: FileCode2, tone: "emerald" as const },
    { label: "RIDE", hint: "Representación impresa en PDF", file: invoice.rideFile, icon: FileText, tone: "blue" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="min-w-0 space-y-2">
        <Link
          href="/admin/facturas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Facturas
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 font-mono text-2xl font-semibold tracking-tight tabular-nums">
            {invoice.invoiceNumber ?? "Factura sin número"}
          </h1>
          <StatusBadge value={invoice.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/admin/clientes/${invoice.client.id}`} className="hover:text-foreground hover:underline">
            {invoice.client.name}
          </Link>
          {invoice.project ? (
            <>
              {" · "}
              <Link href={`/admin/proyectos/${invoice.project.id}`} className="hover:text-foreground hover:underline">
                {invoice.project.name}
              </Link>
            </>
          ) : null}
          {invoice.issueDate ? ` · ${formatDateOnly(invoice.issueDate)}` : null}
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Side panel: status, key data and actions (top on mobile) */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:order-last">
          {invoice.source === "ISSUED" && invoice.sriStatus && invoice.environment ? (
            <SriStatusCard
              invoiceId={invoice.id}
              status={invoice.sriStatus}
              environment={invoice.environment}
              attempts={invoice.sriAttempts}
              lastError={invoice.sriLastError}
              nextAttemptAt={invoice.sriNextAttemptAt}
              authorizedAt={invoice.authorizedAt}
              submissions={invoice.sriSubmissions}
            />
          ) : null}
          <section className="rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Datos de la factura</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Tal como se registró.</p>
              </div>
              {invoice.source === "ISSUED" ? null : (
                <InvoiceEditDialog invoice={forInvoiceDialog(invoice)} clientsWithContext={editCtx} />
              )}
            </div>
            <dl className="space-y-3 px-5 py-4 text-sm">
              {[
                ["Cliente", invoice.client.name],
                ["Identificación", invoice.client.taxId ?? "—"],
                ["Emisión", invoice.issueDate ? formatDateOnly(invoice.issueDate) : "—"],
                ["Tarifa IVA", vatLabel],
                ["Ambiente", keyParts ? (keyParts.environment === "PRODUCCION" ? "Producción" : "Pruebas") : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
                </div>
              ))}
              <div className="space-y-1 border-t pt-3">
                <dt className="text-xs text-muted-foreground">Clave de acceso</dt>
                <dd className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {invoice.accessKey ?? "Sin clave registrada"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="text-sm font-semibold">Enviar al cliente</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Correo de VeegSoft con el XML y el RIDE adjuntos.
              </p>
            </div>
            <div className="px-5 py-4">
              {canSend ? (
                <SendInvoiceForm
                  invoiceId={invoice.id}
                  defaultTo={defaultEmail}
                  defaultSubject={`Factura ${invoice.invoiceNumber ?? ""} · ${invoice.client.name}`.trim()}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {invoice.source === "ISSUED"
                    ? invoice.sriStatus === "AUTHORIZED"
                      ? "VeegHub está guardando el XML autorizado y el RIDE; en unos minutos podrás enviarla."
                      : "Se podrá enviar cuando el SRI la autorice: VeegHub adjunta el XML y el RIDE solo."
                    : "Sube el XML y el RIDE (con «Editar») para poder enviarla."}
                </p>
              )}
            </div>
          </section>

          {invoice.emailLogs.length > 0 ? (
            <section className="rounded-2xl border bg-card">
              <div className="border-b px-5 py-4">
                <h2 className="text-sm font-semibold">Historial de envíos</h2>
              </div>
              <ul className="divide-y">
                {invoice.emailLogs.map((log) => (
                  <li key={log.id} className="space-y-0.5 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {log.status === "FAILED" ? (
                        <XCircle className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
                      ) : (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <p className="truncate text-sm font-medium">{log.to}</p>
                    </div>
                    <p className="pl-5.5 text-xs text-muted-foreground">
                      {log.sentAt ? formatDate(log.sentAt) : formatDate(log.createdAt)}
                      {log.cc ? ` · CC ${log.cc}` : ""}
                    </p>
                    {log.status === "FAILED" && log.error ? (
                      <p className="pl-5.5 text-xs text-red-600 dark:text-red-400">{log.error}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>

        {/* Content */}
        <div className="min-w-0 space-y-4">
          {/* Amounts */}
          <section className="rounded-2xl border bg-card p-5">
            <p className="text-xs text-muted-foreground">Total facturado</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(invoice.total.toString())}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["Subtotal", invoice.subtotal ? formatCurrency(invoice.subtotal.toString()) : "—"],
                [`IVA · ${vatLabel}`, invoice.taxAmount ? formatCurrency(invoice.taxAmount.toString()) : "—"],
                ["Retenido", invoice.withholdings.length ? formatCurrency(withheldTotal) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            {totalsCheck.complete && totalsCheck.difference !== "0.00" ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Subtotal + IVA difiere del total en {formatCurrency(totalsCheck.difference)}.
              </p>
            ) : null}
          </section>

          {/* Milestones: how the client pays it */}
          <section className="rounded-2xl border bg-card">
            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">{canPlan ? "Pagos de la factura" : "Hitos que cubre"}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {canPlan
                    ? "Hitos con los que el cliente la paga. Se cobran con «Cobrar»; cubierto el total, pasa a «Pagada»."
                    : "Cuando todos se cobran, la factura pasa a «Pagada» sola."}
                </p>
              </div>
              {canPlan ? (
                <div className="flex flex-wrap gap-2">
                  <LinkHitosDialog
                    invoiceId={invoice.id}
                    linkedIds={invoice.receivables.map((r) => r.id)}
                    freeHitos={freeHitos}
                  />
                  <PaymentPlanDialog
                    invoiceId={invoice.id}
                    invoiceNumber={invoice.invoiceNumber ?? ""}
                    balanceCents={unplannedCents}
                    isTest={invoice.environment === "PRUEBAS"}
                  />
                </div>
              ) : null}
            </div>
            {canPlan ? (
              <div className="grid grid-cols-3 gap-3 border-b px-5 py-3 text-xs">
                {[
                  ["Planificado", plannedCents],
                  ["Cobrado", collectedCents],
                  ["Por planificar", unplannedCents],
                ].map(([label, cents]) => (
                  <div key={label as string}>
                    <p className="text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatCurrency(fromCents(cents as number))}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {invoice.receivables.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                {invoice.source === "ISSUED"
                  ? invoice.sriStatus === "AUTHORIZED"
                    ? "Aún no tiene hitos. Crea el plan de pagos (un pago o cuotas) o liga hitos que ya existen."
                    : "Podrás planificar los pagos cuando el SRI la autorice."
                  : "No está ligada a ningún hito. Usa «Editar» para elegir los que cubre."}
              </p>
            ) : (
              <ul className="divide-y">
                {invoice.receivables.map((r) => {
                  const covered = toCents(r.paidAmount) + toCents(r.withheldAmount);
                  const settled = covered >= toCents(r.amount);
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                      <IconTile icon={Flag} tone={settled ? "emerald" : "blue"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            settled ? "Cobrado" : covered > 0 ? `Cobrado ${formatCurrency(fromCents(covered))}` : "Por cobrar",
                            r.dueDate ? `vence ${formatDateOnly(r.dueDate)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCurrency(r.amount.toString())}
                      </p>
                      {canPlan && !settled ? (
                        <SinglePaymentDialog
                          receivable={{
                            id: r.id,
                            title: r.title,
                            amount: formatCurrency(r.amount.toString()),
                            remaining: formatCurrency(fromCents(toCents(r.amount) - covered)),
                          }}
                        />
                      ) : null}
                      {canPlan ? (
                        <ConfirmActionButton
                          icon="trash"
                          compact
                          title="Desligar hito"
                          description={`«${r.title}» deja de cobrar esta factura. El hito y sus pagos se conservan en Cobros.`}
                          confirmLabel="Desligar"
                          successMessage="Hito desligado."
                          action={setInvoiceReceivables.bind(
                            null,
                            invoice.id,
                            invoice.receivables.filter((x) => x.id !== r.id).map((x) => x.id),
                          )}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Documents */}
          <section className="rounded-2xl border bg-card">
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Documentos del SRI</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  El cliente debe recibir los dos.
                </p>
              </div>
              {invoice.source !== "ISSUED" && (invoice.xmlFile || invoice.rideFile) ? (
                <ReconcileInvoiceDialog
                  invoiceId={invoice.id}
                  label={invoice.xmlFile ? "Comparar con el XML" : "Comparar con el RIDE"}
                />
              ) : null}
            </div>
            {(invoice.xmlFile || invoice.rideFile) && !invoice.accessKey ? (
              <p className="border-b bg-amber-50/60 px-5 py-2.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                Falta la clave de acceso. Usa «Comparar» para completar los datos desde el documento.
              </p>
            ) : null}
            <ul className="divide-y">
              {documents.map((doc) => (
                <li key={doc.label} className="flex items-center gap-3 px-5 py-3.5">
                  <IconTile icon={doc.icon} tone={doc.file ? doc.tone : "zinc"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{doc.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.file
                        ? doc.file.name
                        : `${doc.hint} · ${invoice.source === "ISSUED" ? "se guarda al autorizarse" : "pendiente de subir"}`}
                    </p>
                  </div>
                  {doc.file ? (
                    <Button asChild variant="outline" size="icon" className="size-8 rounded-full">
                      <a
                        href={`/admin/drive/download/${doc.file.id}?download=1`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Descargar ${doc.label}`}
                      >
                        <Download className="size-3.5" />
                      </a>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {/* Withholdings: informative, never counted as cash received */}
          <section className="rounded-2xl border bg-card">
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Retenciones recibidas</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  No cuentan como dinero cobrado. Las descontadas cierran el saldo de los hitos.
                </p>
              </div>
              <WithholdingDialog invoiceId={invoice.id} mode="create" />
            </div>
            {invoice.withholdings.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Sin retenciones. Regístralas cuando el cliente te envíe el comprobante de retención.
              </p>
            ) : (
              <ul className="divide-y">
                {invoice.withholdings.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {WITHHOLDING_KIND_LABELS[w.kind]}
                        {w.percentage != null ? ` · ${Number(w.percentage.toString())} %` : ""}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          w.appliesToBalance ? "Descontada del saldo" : "Solo informativa",
                          w.receiptNumber,
                          w.issueDate ? formatDateOnly(w.issueDate) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(w.amount.toString())}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <WithholdingDialog invoiceId={invoice.id} withholding={forWithholdingDialog(w)} />
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
                  </li>
                ))}
                <li className="flex justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">Total retenido</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(withheldTotal)}</span>
                </li>
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
