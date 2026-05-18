import { startOfMonth, subMonths, format, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { FaChartLine, FaCircleDollarToSlot } from "react-icons/fa6";

import { CashFlowChart, MonthlyBillingChart } from "@/components/admin/charts";
import { StatusBadge } from "@/components/admin/status-badge";
import { ReportMonthFilter } from "@/app/admin/reportes/report-month-filter";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const months = Array.from({ length: 12 }, (_, index) =>
    startOfMonth(subMonths(new Date(), 11 - index)),
  );
  const monthOptions = months.map((date) => ({
    value: format(date, "yyyy-MM"),
    label: format(date, "MMMM yyyy", { locale: es }),
  }));
  const selectedMonth =
    month ?? monthOptions.at(-1)?.value ?? format(new Date(), "yyyy-MM");
  const selectedDate = new Date(`${selectedMonth}-01T00:00:00`);
  const selectedStart = startOfMonth(selectedDate);
  const selectedEnd = endOfMonth(selectedDate);
  const [
    invoices,
    payments,
    receivables,
    selectedInvoices,
    selectedPayments,
    pendingReceivables,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { issueDate: { gte: months[0] } },
      include: { client: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: months[0] } },
      include: { receivable: { include: { client: true, project: true } } },
    }),
    prisma.receivable.findMany({
      where: { createdAt: { gte: months[0] } },
    }),
    prisma.invoice.findMany({
      where: { issueDate: { gte: selectedStart, lte: selectedEnd } },
      include: { client: true, project: true },
      orderBy: { issueDate: "desc" },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: selectedStart, lte: selectedEnd } },
      include: { receivable: { include: { client: true, project: true } } },
      orderBy: { paidAt: "desc" },
    }),
    prisma.receivable.findMany({
      where: {
        status: { not: "PAID" },
      },
      include: { client: true, project: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
  ]);
  const monthlyData = months.map((date) => {
    const key = format(date, "yyyy-MM");
    const monthInvoices = invoices.filter((invoice) =>
      invoice.issueDate ? format(invoice.issueDate, "yyyy-MM") === key : false,
    );
    const monthPayments = payments.filter(
      (payment) => format(payment.paidAt, "yyyy-MM") === key,
    );
    const monthReceivables = receivables.filter(
      (item) => format(item.createdAt, "yyyy-MM") === key,
    );
    const invoiced = monthInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total),
      0,
    );
    const collected = monthPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const pending = monthReceivables.reduce(
      (sum, item) => sum + Number(item.amount) - Number(item.paidAmount),
      0,
    );

    return {
      month: format(date, "MMM", { locale: es }),
      invoiced,
      collected,
      pending,
    };
  });
  const selectedInvoiced = selectedInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total),
    0,
  );
  const selectedCollected = selectedPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const outstandingReceivables = pendingReceivables.filter(
    (item) => Number(item.amount) - Number(item.paidAmount) > 0,
  );
  const totalPending = outstandingReceivables.reduce(
    (sum, item) => sum + Number(item.amount) - Number(item.paidAmount),
    0,
  );
  const overdue = outstandingReceivables.filter(
    (item) => item.dueDate && item.dueDate < new Date(),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-normal">
            <FaChartLine className="text-blue-600" />
            Reportes
          </h1>
          <p className="text-sm text-muted-foreground">
            Facturación, cobros reales y cuentas por cobrar por mes.
          </p>
        </div>
        <ReportMonthFilter value={selectedMonth} options={monthOptions} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric
          label="Facturado en el mes"
          value={formatCurrency(selectedInvoiced)}
          tone="blue"
        />
        <Metric
          label="Cobrado en el mes"
          value={formatCurrency(selectedCollected)}
          tone="emerald"
        />
        <Metric
          label="Total por cobrar"
          value={formatCurrency(totalPending)}
          tone="amber"
        />
        <Metric label="Vencidos" value={`${overdue.length} hitos`} tone="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Facturado vs cobrado</CardTitle>
            <CardDescription>
              Comparativo mensual de los últimos 12 meses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyBillingChart data={monthlyData} />
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Flujo de cobros</CardTitle>
            <CardDescription>
              Cobros recibidos contra pendiente generado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={monthlyData} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaCircleDollarToSlot className="text-amber-600" />
            Cuentas por cobrar críticas
          </CardTitle>
          <CardDescription>
            Pendientes abiertos ordenados por fecha de vencimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Hito</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead className="pr-6">Vence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingReceivables.slice(0, 10).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6">
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
                      {formatCurrency(
                        Number(item.amount) - Number(item.paidAmount),
                      )}
                    </TableCell>
                    <TableCell className="pr-6">
                      {formatDate(item.dueDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Facturas del mes</CardTitle>
            <CardDescription>
              Emitidas en el periodo seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Factura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="pr-6">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="pl-6">
                        {invoice.invoiceNumber ?? "Sin número"}
                      </TableCell>
                      <TableCell>{invoice.client.name}</TableCell>
                      <TableCell>
                        {formatCurrency(invoice.total.toString())}
                      </TableCell>
                      <TableCell className="pr-6">
                        <StatusBadge value={invoice.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Cobros del mes</CardTitle>
            <CardDescription>
              Pagos registrados en el periodo seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Hito</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead className="pr-6">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="pl-6">
                        {payment.receivable.title}
                      </TableCell>
                      <TableCell>{payment.receivable.client.name}</TableCell>
                      <TableCell>
                        {formatCurrency(payment.amount.toString())}
                      </TableCell>
                      <TableCell className="pr-6">
                        {formatDate(payment.paidAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "emerald" | "amber" | "red";
}) {
  const styles = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    emerald:
      "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    amber:
      "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    red: "border-red-100 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  };

  return (
    <Card className={`rounded-lg ${styles[tone]}`}>
      <CardContent className="p-4">
        <div className="text-sm opacity-80">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
