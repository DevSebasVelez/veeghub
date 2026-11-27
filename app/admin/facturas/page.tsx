import Link from "next/link";
import { CircleCheck, FileText, FileUp, Hourglass, Plus, Receipt, Send } from "lucide-react";

import { InvoiceStatusFilter } from "@/app/admin/facturas/invoice-status-filter";
import {
  CreateInvoiceDialog,
  InvoiceEditDialog,
} from "@/components/admin/dialogs/invoice-dialog";
import { InvoicesNav } from "@/components/admin/finance/invoices-nav";
import { Pagination } from "@/components/admin/pagination";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { IconTile, KpiCard } from "@/components/admin/tone";
import { forInvoiceDialog } from "@/lib/admin/serialize";
import { getInvoiceStats, getInvoicesPageData } from "@/lib/admin/queries/invoices";
import { dayKeyInAppZone, formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

function DocChip({ label, present }: { label: string; present: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        present
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          present ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
      />
      {label}
    </span>
  );
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { page: pageParam, status: statusFilter } = await searchParams;
  const year = Number(dayKeyInAppZone(new Date()).slice(0, 4));

  const [
    { page, pageSize, clientsForCreate, clientsForEdit, invoices, total, serializeRecv },
    stats,
  ] = await Promise.all([
    getInvoicesPageData({ pageParam, statusFilter }),
    getInvoiceStats(year),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <p className="text-sm text-muted-foreground">
            Facturas electrónicas del SRI: XML autorizado, RIDE y envío al cliente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateInvoiceDialog
            clientsWithContext={clientsForCreate}
            trigger={
              <Button type="button" variant="outline" size="sm" className="max-sm:h-10">
                <FileUp className="size-3.5" />
                Registrar del SRI
              </Button>
            }
          />
          <Button asChild size="sm" className="max-sm:h-10 max-sm:px-4">
            <Link href="/admin/facturas/nueva">
              <Plus className="size-3.5" />
              Nueva factura
            </Link>
          </Button>
        </div>
      </div>

      <InvoicesNav active="facturas" />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          icon={Receipt}
          tone="blue"
          label={`Facturado en ${year}`}
          value={formatCurrency(stats.billedTotal)}
          helper={`${stats.billedCount} ${stats.billedCount === 1 ? "factura emitida" : "facturas emitidas"}`}
          href="/admin/facturas"
          active={!statusFilter}
        />
        <KpiCard
          icon={Send}
          tone="orange"
          label="Por enviar"
          value={String(stats.toSendCount)}
          helper={
            stats.toSendCount
              ? `${formatCurrency(stats.toSendTotal)} sin enviar al cliente`
              : "Todo enviado"
          }
          href="/admin/facturas?status=READY_TO_SEND"
          active={statusFilter === "READY_TO_SEND"}
        />
        <KpiCard
          icon={Hourglass}
          tone="amber"
          label="Por cobrar"
          value={formatCurrency(stats.toCollectTotal)}
          helper={`${stats.toCollectCount} ${stats.toCollectCount === 1 ? "enviada sin pagar" : "enviadas sin pagar"}`}
          href="/admin/facturas?status=SENT"
          active={statusFilter === "SENT"}
        />
        <KpiCard
          icon={CircleCheck}
          tone="emerald"
          label="Pagadas"
          value={formatCurrency(stats.paidTotal)}
          helper={`${stats.paidCount} ${stats.paidCount === 1 ? "factura cobrada" : "facturas cobradas"}`}
          href="/admin/facturas?status=PAID"
          active={statusFilter === "PAID"}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Todas las facturas</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {stats.missingDocs
                ? `${stats.missingDocs} ${stats.missingDocs === 1 ? "factura no tiene" : "facturas no tienen"} XML o RIDE: súbelos para poder enviarlas.`
                : "Las más recientes primero."}
            </p>
          </div>
          <InvoiceStatusFilter value={statusFilter} />
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <IconTile icon={FileText} tone="blue" size="lg" />
            <p className="text-sm font-medium">
              {statusFilter ? "No hay facturas con ese estado" : "Aún no hay facturas"}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Emite una con «Nueva factura», o registra una del facturador del SRI subiendo su XML.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {invoices.map((invoice) => {
              const lastEmail = invoice.emailLogs[0];
              const clientForEdit = clientsForEdit.find((c) => c.id === invoice.clientId);
              // Offer hitos that are free or already on THIS invoice.
              const editCtx = clientForEdit
                ? [
                    {
                      ...clientForEdit,
                      receivables: clientForEdit.receivables
                        .filter((r) => r.invoiceId === null || r.invoiceId === invoice.id)
                        .map(serializeRecv),
                    },
                  ]
                : [];

              return (
                <li
                  key={invoice.id}
                  className="group relative flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40 sm:gap-4"
                >
                  <IconTile icon={FileText} tone="blue" size="sm" className="max-sm:hidden" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/facturas/${invoice.id}`}
                        className="font-mono text-sm font-medium tabular-nums after:absolute after:inset-0"
                      >
                        {invoice.invoiceNumber ?? "Sin número"}
                      </Link>
                      <StatusBadge value={invoice.status} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        invoice.client.name,
                        invoice.project?.name,
                        invoice.issueDate ? formatDateOnly(invoice.issueDate) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DocChip label="XML" present={Boolean(invoice.xmlFile)} />
                      <DocChip label="RIDE" present={Boolean(invoice.rideFile)} />
                      {lastEmail ? (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {lastEmail.status === "FAILED" ? "Falló el envío a" : "Enviada a"} {lastEmail.to}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {formatCurrency(invoice.total.toString())}
                  </p>
                  <div className="relative z-10 shrink-0">
                    <InvoiceEditDialog invoice={forInvoiceDialog(invoice)} clientsWithContext={editCtx} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t px-5 py-3">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/admin/facturas"
            searchParams={{ status: statusFilter ?? "" }}
          />
        </div>
      </section>
    </div>
  );
}
