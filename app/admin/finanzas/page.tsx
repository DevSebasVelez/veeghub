import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

import { PaymentDialog, ReceivableDialog } from "@/components/admin/dialogs/receivable-dialog";
import { forReceivableDialog } from "@/lib/admin/serialize";
import { getPage, Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
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

const PAGE_SIZE = 10;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  const { page: pageParam, tab } = await searchParams;
  const page = getPage(pageParam);
  const showAll = tab === "todos";

  const [
    clients,
    projects,
    pendingAgg,
    collectedAgg,
    overdueCount,
    allReceivables,
    paymentHistory,
  ] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
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
      orderBy: { paidAt: "desc" },
      take: 20,
      include: {
        receivable: {
          select: {
            title: true,
            client: { select: { name: true } },
          },
        },
      },
    }),
  ]);

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

  return (
    <div className="space-y-6">
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
          <ReceivableDialog clients={clients} projects={projects} mode="create" />
        </div>
      </div>

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

      <Card className="rounded-lg border-emerald-100 bg-emerald-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Hitos de cobro</CardTitle>
              <CardDescription>
                Entradas, avances, entregas finales o pagos únicos.
              </CardDescription>
            </div>
            <div className="flex gap-1 rounded-lg border bg-background p-1">
              <Link
                href="/admin/finanzas"
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  !showAll
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Pendientes
              </Link>
              <Link
                href="/admin/finanzas?tab=todos"
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  showAll
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Todos
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hito</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.project?.name ?? "Sin proyecto"}
                    </div>
                  </TableCell>
                  <TableCell>{item.client.name}</TableCell>
                  <TableCell>
                    <StatusBadge value={item.status} />
                  </TableCell>
                  <TableCell>
                    {formatCurrency(item.amount.toString())}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(item.paidAmount.toString())}
                  </TableCell>
                  <TableCell>
                    {item.dueDate ? (
                      <span
                        className={
                          !showAll &&
                          item.dueDate < new Date() &&
                          item.status !== "PAID"
                            ? "font-medium text-destructive"
                            : ""
                        }
                      >
                        {formatDate(item.dueDate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <ReceivableDialog
                      receivable={forReceivableDialog(item)}
                      clients={clients}
                      projects={projects}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!receivables.length ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {showAll
                      ? "Aún no hay hitos registrados."
                      : "No hay cuentas por cobrar pendientes."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/admin/finanzas"
            searchParams={{ tab: tab ?? "" }}
          />
        </CardContent>
      </Card>

      {paymentHistory.length > 0 ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Historial de pagos</CardTitle>
            <CardDescription>Últimos 20 pagos registrados.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hito</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentHistory.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.receivable.title}
                    </TableCell>
                    <TableCell>{payment.receivable.client.name}</TableCell>
                    <TableCell className="font-medium text-emerald-600">
                      {formatCurrency(payment.amount.toString())}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.method ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payment.paidAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
