import Link from "next/link";

import type { Prisma } from "@/app/generated/prisma/client";
import { InlineStatusSelect } from "@/components/admin/inline-status-select";
import {
  ReceivableDialog,
  SinglePaymentDialog,
} from "@/components/admin/dialogs/receivable-dialog";
import { QuickInvoiceDialog } from "@/components/admin/dialogs/invoice-dialog";
import { Pagination } from "@/components/admin/pagination";
import { forReceivableDialog } from "@/lib/admin/serialize";
import { getReceivablesSectionData } from "@/lib/admin/queries/receivables";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function HitosSection({
  pageParam,
  showAll,
}: {
  pageParam?: string;
  showAll: boolean;
}) {
  const { page, pageSize, total, receivables, clients, projects, invoiceCtx } =
    await getReceivablesSectionData({ pageParam, showAll });

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Hitos de cobro</CardTitle>
            <CardDescription>
              Entradas, avances, entregas finales o pagos únicos.
            </CardDescription>
          </div>
          <div className="flex gap-1 self-start rounded-lg border bg-muted/30 p-1">
            <Link
              href="/admin/finanzas"
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                !showAll
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Pendientes
            </Link>
            <Link
              href="/admin/finanzas?tab=todos"
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                showAll
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Todos
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {receivables.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">
            {showAll
              ? "Aún no hay hitos registrados."
              : "No hay hitos pendientes de cobro."}
          </p>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="divide-y md:hidden">
              {receivables.map((item) => (
                <HitoMobileCard
                  key={item.id}
                  item={item}
                  clients={clients}
                  projects={projects}
                  invoiceCtx={invoiceCtx}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36 pl-6">Estado</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Por cobrar</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead className="pr-6 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.map((item) => {
                    const remaining =
                      Number(item.amount) - Number(item.paidAmount);
                    const isOverdue =
                      item.dueDate &&
                      item.dueDate < new Date() &&
                      item.status !== "PAID" &&
                      item.status !== "CANCELLED";
                    const isPaid = remaining <= 0;

                    return (
                      <TableRow key={item.id} className="group">
                        <TableCell className="pl-4">
                          <InlineStatusSelect
                            id={item.id}
                            status={item.status}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.title}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.project?.name ?? (
                            <span className="italic opacity-40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.client.name}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(item.amount.toString())}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              remaining > 0
                                ? "text-amber-600"
                                : "text-emerald-600",
                            )}
                          >
                            {formatCurrency(remaining.toFixed(2))}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.dueDate ? (
                            <span
                              className={cn(
                                "text-sm",
                                isOverdue
                                  ? "font-medium text-destructive"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatDateOnly(item.dueDate)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground opacity-40">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6">
                          <div className="flex items-center justify-end gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            {!item.invoice && item.status !== "CANCELLED" ? (
                              <QuickInvoiceDialog
                                clientsWithContext={invoiceCtx}
                                fixedClientId={item.client.id}
                                fixedProjectId={item.project?.id ?? null}
                                fixedReceivableId={item.id}
                                receivableTitle={item.title}
                              />
                            ) : null}
                            {!isPaid && item.status !== "CANCELLED" ? (
                              <SinglePaymentDialog
                                receivable={{
                                  id: item.id,
                                  title: item.title,
                                  amount: formatCurrency(
                                    item.amount.toString(),
                                  ),
                                  remaining: formatCurrency(
                                    remaining.toFixed(2),
                                  ),
                                }}
                              />
                            ) : null}
                            <ReceivableDialog
                              receivable={forReceivableDialog(item)}
                              clients={clients}
                              projects={projects}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <div className="px-4 pb-4 sm:px-6">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
            basePath="/admin/finanzas"
            searchParams={{ tab: showAll ? "todos" : "" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

type HitoItem = Prisma.ReceivableGetPayload<{
  include: {
    client: { select: { id: true; name: true } };
    project: { select: { id: true; name: true } };
    invoice: { select: { id: true; invoiceNumber: true; status: true } };
  };
}>;

function HitoMobileCard({
  item,
  clients,
  projects,
  invoiceCtx,
}: {
  item: HitoItem;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  invoiceCtx: React.ComponentProps<
    typeof QuickInvoiceDialog
  >["clientsWithContext"];
}) {
  const remaining = Number(item.amount) - Number(item.paidAmount);
  const isPaid = remaining <= 0;
  const isOverdue =
    item.dueDate &&
    item.dueDate < new Date() &&
    item.status !== "PAID" &&
    item.status !== "CANCELLED";

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.project?.name ? `${item.project.name} · ` : ""}
            {item.client.name}
          </p>
        </div>
        <InlineStatusSelect id={item.id} status={item.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Monto{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(item.amount.toString())}
          </span>
        </span>
        <span
          className={cn(
            "font-medium",
            remaining > 0 ? "text-amber-600" : "text-emerald-600",
          )}
        >
          {remaining > 0
            ? `${formatCurrency(remaining.toFixed(2))} por cobrar`
            : "Pagado ✓"}
        </span>
        {item.dueDate ? (
          <span
            className={cn(
              "text-xs",
              isOverdue
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            Vence {formatDateOnly(item.dueDate)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!item.invoice && item.status !== "CANCELLED" ? (
          <QuickInvoiceDialog
            clientsWithContext={invoiceCtx}
            fixedClientId={item.client.id}
            fixedProjectId={item.project?.id ?? null}
            fixedReceivableId={item.id}
            receivableTitle={item.title}
          />
        ) : item.invoice ? (
          <Link
            href={`/admin/facturas/${item.invoice.id}`}
            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
          >
            Factura
            {item.invoice.invoiceNumber ? ` ${item.invoice.invoiceNumber}` : ""}
            {item.invoice.status === "PAID" ? " ✓" : ""}
          </Link>
        ) : null}
        {!isPaid && item.status !== "CANCELLED" ? (
          <SinglePaymentDialog
            receivable={{
              id: item.id,
              title: item.title,
              amount: formatCurrency(item.amount.toString()),
              remaining: formatCurrency(remaining.toFixed(2)),
            }}
          />
        ) : null}
        <ReceivableDialog
          receivable={forReceivableDialog(item)}
          clients={clients}
          projects={projects}
        />
      </div>
    </div>
  );
}
