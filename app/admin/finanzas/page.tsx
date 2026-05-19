import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Trash2 } from "lucide-react";

import { deletePayment } from "@/app/admin/actions";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { InlineStatusSelect } from "@/components/admin/inline-status-select";
import {
  EditPaymentDialog,
  PaymentDialog,
  ReceivableDialog,
} from "@/components/admin/dialogs/receivable-dialog";
import { forReceivableDialog } from "@/lib/admin/serialize";
import { getPage, Pagination } from "@/components/admin/pagination";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
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
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 15;

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

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    section?: string;
    year?: string;
  }>;
}) {
  const { page: pageParam, tab, section, year: yearParam } = await searchParams;

  const page = getPage(pageParam);
  const showAll = tab === "todos";
  const isPagosSection = section === "pagos";
  const currentYear = new Date().getFullYear();
  const selectedYear = yearParam ? parseInt(yearParam) : currentYear;

  const [
    clients,
    projects,
    pendingAgg,
    collectedAgg,
    overdueCount,
    allReceivables,
    paymentHistory,
    availableYears,
  ] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.receivable.aggregate({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      _sum: { amount: true, paidAmount: true },
    }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.receivable.count({
      where: {
        status: { notIn: ["PAID", "CANCELLED"] },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.receivable.findMany({
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.findMany({
      where: {
        paidAt: {
          gte: new Date(`${selectedYear}-01-01`),
          lt: new Date(`${selectedYear + 1}-01-01`),
        },
      },
      orderBy: { paidAt: "desc" },
      include: {
        receivable: {
          select: {
            id: true,
            title: true,
            client: { select: { name: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    }),
    // Get distinct years from payments
    prisma.payment.findMany({
      select: { paidAt: true },
      orderBy: { paidAt: "asc" },
      distinct: ["paidAt"],
    }),
  ]);

  // Compute available years from payment dates
  const years = [
    ...new Set(availableYears.map((p) => new Date(p.paidAt).getFullYear())),
  ].sort((a, b) => b - a);
  if (!years.includes(currentYear)) years.unshift(currentYear);

  const visibleReceivables = showAll
    ? allReceivables
    : allReceivables.filter(
        (r) =>
          r.status !== "PAID" &&
          r.status !== "CANCELLED" &&
          Number(r.amount) - Number(r.paidAmount) > 0,
      );

  const total = visibleReceivables.length;
  const receivables = visibleReceivables.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const pendingReceivablesForPayment = allReceivables.filter(
    (r) => r.status !== "PAID" && r.status !== "CANCELLED",
  );

  const totalPending =
    Number(pendingAgg._sum.amount ?? 0) -
    Number(pendingAgg._sum.paidAmount ?? 0);
  const totalCollected = Number(collectedAgg._sum.amount ?? 0);

  // Group payments by month
  const paymentsByMonth: Record<
    string,
    { key: string; total: number; payments: typeof paymentHistory }
  > = {};
  for (const payment of paymentHistory) {
    const d = new Date(payment.paidAt);
    const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    if (!paymentsByMonth[key]) {
      paymentsByMonth[key] = { key, total: 0, payments: [] };
    }
    paymentsByMonth[key].payments.push(payment);
    paymentsByMonth[key].total += Number(payment.amount);
  }
  const monthGroups = Object.values(paymentsByMonth);
  const yearTotal = paymentHistory.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
          <p className="text-sm text-muted-foreground">
            Hitos de cobro, pagos parciales y cuentas por cobrar.
          </p>
        </div>
        <div className="flex gap-2">
          <PaymentDialog
            receivables={pendingReceivablesForPayment.map((r) => ({
              id: r.id,
              title: r.title,
              client: { name: r.client.name },
            }))}
          />
          <ReceivableDialog
            clients={clients}
            projects={projects}
            mode="create"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por cobrar</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalPending.toFixed(2))}
            </div>
            <p className="text-xs text-muted-foreground">
              Saldo pendiente en hitos activos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total cobrado</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totalCollected.toFixed(2))}
            </div>
            <p className="text-xs text-muted-foreground">
              Suma de todos los pagos registrados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {overdueCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Hitos con fecha de vencimiento pasada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 rounded-lg border bg-background p-1 w-fit">
        <Link
          href="/admin/finanzas"
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            !isPagosSection
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Hitos
        </Link>
        <Link
          href="/admin/finanzas?section=pagos"
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            isPagosSection
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Pagos
        </Link>
      </div>

      {/* HITOS section */}
      {!isPagosSection ? (
        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Hitos de cobro</CardTitle>
                <CardDescription>
                  Entradas, avances, entregas finales o pagos únicos.
                </CardDescription>
              </div>
              <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
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
            <div className="overflow-x-auto">
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
                              {formatDate(item.dueDate)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground opacity-40">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <ReceivableDialog
                            receivable={forReceivableDialog(item)}
                            clients={clients}
                            projects={projects}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!receivables.length ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {showAll
                          ? "Aún no hay hitos registrados."
                          : "No hay hitos pendientes de cobro."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <div className="px-6 pb-4">
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                basePath="/admin/finanzas"
                searchParams={{ tab: tab ?? "" }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* PAGOS section */}
      {isPagosSection ? (
        <div className="space-y-4">
          {/* Year filter + total */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-lg border bg-background p-1">
              {years.map((y) => (
                <Link
                  key={y}
                  href={`/admin/finanzas?section=pagos&year=${y}`}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    y === selectedYear
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {y}
                </Link>
              ))}
            </div>
            {yearTotal > 0 ? (
              <div className="text-sm text-muted-foreground">
                Total {selectedYear}:{" "}
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(yearTotal.toFixed(2))}
                </span>
              </div>
            ) : null}
          </div>

          {monthGroups.length === 0 ? (
            <Card className="rounded-lg">
              <CardContent className="py-16 text-center text-muted-foreground">
                No hay pagos registrados en {selectedYear}.
              </CardContent>
            </Card>
          ) : (
            monthGroups.map((group) => (
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
                          <TableHead className="pl-6">Hito</TableHead>
                          <TableHead>Proyecto</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="pr-6 text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="pl-6 font-medium">
                              {payment.receivable.title}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {payment.receivable.project?.name ?? (
                                <span className="italic opacity-40">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {payment.receivable.client.name}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {payment.method ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {payment.reference ?? "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">
                              {formatCurrency(payment.amount.toString())}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(payment.paidAt)}
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              <div className="flex items-center justify-end gap-1">
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
                                <DeletePaymentButton
                                  id={payment.id}
                                  amount={formatCurrency(
                                    payment.amount.toString(),
                                  )}
                                />
                              </div>
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
      ) : null}
    </div>
  );
}

function DeletePaymentButton({ id, amount }: { id: string; amount: string }) {
  return (
    <ConfirmationDialog
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      }
      title="Eliminar pago"
      description={`¿Eliminar el pago de ${amount}? El saldo del hito se recalculará automáticamente.`}
      confirmLabel="Eliminar"
      destructive
      onConfirm={async () => {
        "use server";
        await deletePayment(id);
      }}
    />
  );
}
